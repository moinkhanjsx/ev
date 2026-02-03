import http from "http";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import app from "./src/app.js";
import ChargingRequest from './src/models/ChargingRequest.js';
import User from './src/models/User.js';
import RequestMessage from './src/models/RequestMessage.js';
import { sanitizeCityForRoom } from "./src/utils/city.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
import { Server } from "socket.io";

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// Socket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

// Make io instance available to routes
app.set('io', io);

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  const maskPhone = (phone) => {
    if (!phone || typeof phone !== "string") return "";
    const digits = phone.replace(/\D/g, "");
    if (!digits) return "";
    const tail = digits.slice(-4);
    return `****${tail}`;
  };

  const maskEmail = (email) => {
    if (!email || typeof email !== "string") return "";
    const [user, domain] = email.split("@");
    if (!domain) return email;
    const safeUser = user.length <= 2 ? `${user[0]}*` : `${user[0]}${"*".repeat(Math.min(4, user.length - 1))}`;
    const domainParts = domain.split(".");
    const root = domainParts[0] || "";
    const safeRoot = root.length <= 2 ? `${root[0]}*` : `${root[0]}${"*".repeat(Math.min(4, root.length - 1))}`;
    const rest = domainParts.length > 1 ? `.${domainParts.slice(1).join(".")}` : "";
    return `${safeUser}@${safeRoot}${rest}`;
  };

  // Join a per-user room so we can emit targeted events reliably.
  // (The auth middleware sets socket.userId from JWT.)
  if (socket.userId) {
    socket.join(socket.userId.toString());
  }

  // Fetch user profile data (optional) after auth.
  if (socket.userId) {
    User.findById(socket.userId)
      .then(user => {
        if (user) {
          socket.userCity = user.city;
          socket.userName = user.name;
          socket.userEmail = user.email;
          console.log(`Socket authenticated for user: ${user.name} (${user._id})`);
        }
      })
      .catch(err => console.error('Socket authentication error:', err));
  }

  /**
   * Handle user joining a city-specific room
   * Event: 'join-city'
   * Data: { city: string }
   */
  socket.on("join-city", (data) => {
    try {
      const { city } = data;

      // Validate city input
      if (!city || typeof city !== 'string' || city.trim().length === 0) {
        socket.emit("error", { message: "Invalid city provided" });
        return;
      }

      const sanitizedCity = sanitizeCityForRoom(city);
      const roomName = `city-${sanitizedCity}`;
      console.log(`City sanitization - Original: "${city}" -> Sanitized: "${sanitizedCity}" -> Room: "${roomName}"`);

      // Join city-specific room
      socket.join(roomName);
      
      // Store city info in socket object for reference
      socket.userCity = city;
      socket.roomName = roomName;

      console.log(`User ${socket.id} joined city room: ${roomName}`);

      // Confirm successful room join to client
      socket.emit("city-joined", { 
        city: city, 
        roomName: roomName,
        message: `Successfully joined ${city} room`
      });

      // Notify other users in same city
      socket.to(roomName).emit("user-joined-city", {
        userId: socket.id,
        city: city,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("Error joining city room:", error);
      socket.emit("error", { message: "Failed to join city room" });
    }
  });

  /**
   * Handle leaving city room
   * Event: 'leave-city'
   */
  socket.on("leave-city", () => {
    if (socket.roomName) {
      socket.leave(socket.roomName);
      
      // Notify other users in same city
      socket.to(socket.roomName).emit("user-left-city", {
        userId: socket.id,
        city: socket.userCity,
        timestamp: new Date().toISOString()
      });

      console.log(`User ${socket.id} left city room: ${socket.roomName}`);
      
      // Clear stored city info
      socket.userCity = null;
      socket.roomName = null;
      
      socket.emit("city-left", { message: "Successfully left city room" });
    }
  });

  /**
   * Handle charging requests within a city
   * Event: 'charging-request'
   * Data: charging request object
   */
  socket.on("charging-request", (requestData) => {
    if (socket.roomName) {
      // Broadcast charging request to all users in same city (including sender for confirmation)
      io.to(socket.roomName).emit("charging-request", {
        ...requestData,
        requesterId: socket.id,
        city: socket.userCity,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Charging request broadcasted in ${socket.roomName}`);
    } else {
      socket.emit("error", { message: "You must join a city room first" });
    }
  });

  /**
   * Handle accepting charging requests with race condition protection and duplicate prevention
   * Event: 'accept-charging-request'
   * Data: { requestId: string }
   */
  socket.on("accept-charging-request", async (data) => {
    try {
      const { requestId } = data;
      const helperId = socket.userId; // Assuming userId is stored in socket after auth
      
      if (!socket.roomName) {
        socket.emit("error", { message: "You must join a city room first" });
        return;
      }

      if (!helperId) {
        socket.emit("error", { message: "User not authenticated" });
        return;
      }

      // SAFETY CHECK: Verify helper is not already active on another request
      try {
        const helper = await User.findById(helperId);
        if (!helper) {
          socket.emit("error", { message: "Helper user not found" });
          return;
        }

        if (helper.isActiveHelper && helper.currentActiveRequest) {
          socket.emit("accept-failed", {
            requestId: requestId,
            reason: "You already have an active charging request. Please complete it before accepting another.",
            currentActiveRequest: helper.currentActiveRequest
          });
          return;
        }
      } catch (error) {
        console.error("Error checking helper status:", error);
        socket.emit("error", { message: "Failed to verify helper status" });
        return;
      }

      try {
        // Find and update request with atomic operation and additional constraints
        const request = await ChargingRequest.findOneAndUpdate(
          {
            _id: requestId,
            status: "OPEN", // Only accept OPEN requests
            requesterId: { $ne: helperId }, // Prevent accepting own request
            helperId: { $eq: null } // Ensure no helper is assigned yet
          },
          {
            $set: {
              helperId: helperId,
              status: "ACCEPTED",
              acceptedAt: new Date()
            }
          },
          {
            new: true,
            runValidators: true
          }
        ).populate('requesterId helperId', 'name email city');

        if (!request) {
          // Check why the update failed for better error messaging
          const existingRequest = await ChargingRequest.findById(requestId);
          if (!existingRequest) {
            socket.emit("accept-failed", {
              requestId: requestId,
              reason: "Request not found"
            });
          } else if (existingRequest.status !== "OPEN") {
            socket.emit("accept-failed", {
              requestId: requestId,
              reason: `This request is no longer available (status: ${existingRequest.status})`,
              status: existingRequest.status
            });
          } else if (existingRequest.requesterId.toString() === helperId) {
            socket.emit("accept-failed", {
              requestId: requestId,
              reason: "You cannot accept your own charging request"
            });
          } else if (existingRequest.helperId) {
            socket.emit("accept-failed", {
              requestId: requestId,
              reason: "This request has already been accepted by another helper"
            });
          } else {
            socket.emit("accept-failed", {
              requestId: requestId,
              reason: "Unable to accept request at this time. Please try again."
            });
          }
          return;
        }

        // SAFETY CHECK: Update helper status atomically
        await User.findByIdAndUpdate(
          helperId,
          {
            isActiveHelper: true,
            currentActiveRequest: requestId
          }
        );

        console.log(`Charging request ${requestId} accepted by helper ${helperId}`);

        // Emit real-time notifications
        
        // 1. Notify specific requester that their request was accepted
        io.to(request.requesterId._id.toString()).emit("charging-request-accepted", {
          request: {
            id: request._id,
            helperId: request.helperId._id,
            helperName: request.helperId.name,
            helperEmail: request.helperId.email,
            status: request.status,
            acceptedAt: request.acceptedAt
          },
          timestamp: new Date().toISOString()
        });

        // 2. Notify accepting helper for confirmation
        socket.emit("accept-confirmed", {
          request: {
            id: request._id,
            requesterId: request.requesterId._id,
            requesterName: request.requesterId.name,
            requesterEmail: request.requesterId.email,
            requesterCity: request.requesterId.city,
            status: request.status,
            acceptedAt: request.acceptedAt
          },
          timestamp: new Date().toISOString()
        });

        // 3. Notify all other helpers in same city that this request is no longer available
        socket.to(socket.roomName).emit("request-taken", {
          requestId: requestId,
          message: `Charging request in ${socket.userCity} has been accepted`,
          status: "ACCEPTED",
          acceptedAt: request.acceptedAt,
          timestamp: new Date().toISOString()
        });

        // 4. Broadcast general notification to city
        io.to(socket.roomName).emit("request-accepted-notification", {
          requestId: request._id,
          message: `A charging request has been accepted in ${socket.userCity}`,
          requesterName: request.requesterId.name,
          helperName: request.helperId.name,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error("Error accepting charging request:", error);
        socket.emit("accept-failed", {
          requestId: requestId,
          reason: "Server error while processing request"
        });
      }
    } catch (error) {
      console.error("Socket accept-charging-request error:", error);
      socket.emit("error", { message: "Failed to process request acceptance" });
    }
  });

  /**
   * Join a request-specific room for chat
   * Event: 'join-request'
   * Data: { requestId }
   */
  socket.on("join-request", async (data) => {
    try {
      const { requestId } = data || {};
      if (!requestId) {
        socket.emit("error", { message: "Invalid requestId" });
        return;
      }

      const request = await ChargingRequest.findById(requestId).lean();
      if (!request) {
        socket.emit("error", { message: "Request not found" });
        return;
      }

      const userId = socket.userId?.toString();
      const isRequester = request.requesterId?.toString() === userId;
      const isHelper = request.helperId?.toString() === userId;

      if (!isRequester && !isHelper) {
        socket.emit("error", { message: "Access denied" });
        return;
      }

      if (!["ACCEPTED", "COMPLETED"].includes(request.status)) {
        socket.emit("error", { message: "Chat is available only after acceptance" });
        return;
      }

      const roomName = `request-${requestId}`;
      socket.join(roomName);
      socket.emit("request-joined", { requestId, roomName });
    } catch (error) {
      console.error("Error joining request room:", error);
      socket.emit("error", { message: "Failed to join request room" });
    }
  });

  socket.on("leave-request", (data) => {
    const { requestId } = data || {};
    if (!requestId) return;
    const roomName = `request-${requestId}`;
    socket.leave(roomName);
  });

  /**
   * Send chat message
   * Event: 'chat-message'
   * Data: { requestId, text }
   */
  socket.on("chat-message", async (data) => {
    try {
      const { requestId, text } = data || {};
      if (!requestId || typeof text !== "string") {
        socket.emit("error", { message: "Invalid message payload" });
        return;
      }

      const cleanedText = text.replace(/\s+/g, " ").trim().slice(0, 500);
      if (!cleanedText) {
        socket.emit("error", { message: "Message cannot be empty" });
        return;
      }

      const request = await ChargingRequest.findById(requestId).lean();
      if (!request) {
        socket.emit("error", { message: "Request not found" });
        return;
      }

      const userId = socket.userId?.toString();
      const isRequester = request.requesterId?.toString() === userId;
      const isHelper = request.helperId?.toString() === userId;

      if (!isRequester && !isHelper) {
        socket.emit("error", { message: "Access denied" });
        return;
      }

      if (!["ACCEPTED", "COMPLETED"].includes(request.status)) {
        socket.emit("error", { message: "Chat is available only after acceptance" });
        return;
      }

      const senderRole = isRequester ? "requester" : "helper";
      const message = await RequestMessage.create({
        requestId,
        senderId: userId,
        senderName: socket.userName || "User",
        senderRole,
        type: "text",
        text: cleanedText
      });

      const roomName = `request-${requestId}`;
      io.to(roomName).emit("chat-message", { requestId, message });
    } catch (error) {
      console.error("Error sending chat message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  /**
   * Share masked contact info
   * Event: 'share-contact'
   * Data: { requestId }
   */
  socket.on("share-contact", async (data) => {
    try {
      const { requestId } = data || {};
      if (!requestId) {
        socket.emit("error", { message: "Invalid requestId" });
        return;
      }

      const request = await ChargingRequest.findById(requestId).lean();
      if (!request) {
        socket.emit("error", { message: "Request not found" });
        return;
      }

      const userId = socket.userId?.toString();
      const isRequester = request.requesterId?.toString() === userId;
      const isHelper = request.helperId?.toString() === userId;

      if (!isRequester && !isHelper) {
        socket.emit("error", { message: "Access denied" });
        return;
      }

      if (!["ACCEPTED", "COMPLETED"].includes(request.status)) {
        socket.emit("error", { message: "Contact sharing is available only after acceptance" });
        return;
      }

      const senderRole = isRequester ? "requester" : "helper";
      const maskedPhone = isRequester ? maskPhone(request.phoneNumber) : "";
      const maskedEmail = maskEmail(socket.userEmail);

      const message = await RequestMessage.create({
        requestId,
        senderId: userId,
        senderName: socket.userName || "User",
        senderRole,
        type: "contact",
        text: "Shared contact details",
        metadata: {
          phoneMasked: maskedPhone,
          emailMasked: maskedEmail
        }
      });

      const roomName = `request-${requestId}`;
      io.to(roomName).emit("chat-message", { requestId, message });
    } catch (error) {
      console.error("Error sharing contact:", error);
      socket.emit("error", { message: "Failed to share contact" });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
