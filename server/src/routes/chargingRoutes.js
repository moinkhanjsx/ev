import express from "express";
import authMiddleware from "../middleware/auth.js";
import ChargingRequest from "../models/ChargingRequest.js";
import User from "../models/User.js";
import RequestMessage from "../models/RequestMessage.js";
import { buildCityExactMatchRegex, sanitizeCityForRoom } from "../utils/city.js";

const router = express.Router();

// Fixed token cost for creating a charging request
const TOKEN_COST = 5;
const MAX_MESSAGE_LENGTH = 500;
const MAX_SETTLEMENT_NOTE_LENGTH = 240;
const TOKENS_PER_SHARED_UNIT = 1;

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const sanitizeMessage = (value) => {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_LENGTH);
};

const sanitizeSettlementNote = (value) => {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_SETTLEMENT_NOTE_LENGTH);
};

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

const isParticipant = (request, userId) => {
  if (!request || !userId) return false;
  const requesterMatch = request.requesterId?.toString() === userId.toString();
  const helperMatch = request.helperId?.toString() === userId.toString();
  return requesterMatch || helperMatch;
};

const normalizeSharedUnits = (value) => {
  const parsedValue =
    typeof value === "number" ? value : Number.parseFloat(typeof value === "string" ? value.trim() : value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return Number(parsedValue.toFixed(2));
};

const normalizeLocationCoordinates = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const latitude =
    typeof value.latitude === "number" ? value.latitude : Number.parseFloat(value.latitude);
  const longitude =
    typeof value.longitude === "number" ? value.longitude : Number.parseFloat(value.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  };
};

const calculateSettlementTokens = (sharedUnits) =>
  Number((sharedUnits * TOKENS_PER_SHARED_UNIT).toFixed(2));

const calculateSettlementBalanceAdjustment = (request) => {
  const requestDeposit = Number(request?.tokenCost || 0);
  const tokenAmount = Number(request?.settlement?.tokenAmount || 0);
  return Number((requestDeposit - tokenAmount).toFixed(2));
};

const toParticipantId = (value) =>
  typeof value === "object" && value !== null ? value._id?.toString() || value.toString() : value?.toString();

const buildSettlementResponse = (request) => ({
  status: request?.settlement?.status || "NONE",
  sharedUnits: request?.settlement?.sharedUnits ?? null,
  tokenAmount: request?.settlement?.tokenAmount ?? null,
  helperNote: request?.settlement?.helperNote || "",
  proposedBy: toParticipantId(request?.settlement?.proposedBy),
  proposedAt: request?.settlement?.proposedAt || null,
  confirmedBy: toParticipantId(request?.settlement?.confirmedBy),
  confirmedAt: request?.settlement?.confirmedAt || null,
  depositApplied: Number(request?.tokenCost || 0),
  balanceAdjustment: request?.settlement?.tokenAmount == null ? null : calculateSettlementBalanceAdjustment(request),
  tokensPerUnit: TOKENS_PER_SHARED_UNIT,
});

const buildRequestUpdatePayload = (request) => ({
  id: request?._id,
  _id: request?._id,
  requesterId: toParticipantId(request?.requesterId),
  helperId: toParticipantId(request?.helperId),
  city: request?.city,
  location: request?.location,
  locationCoordinates: request?.locationCoordinates || null,
  status: request?.status,
  tokenCost: Number(request?.tokenCost || 0),
  acceptedAt: request?.acceptedAt || null,
  completedAt: request?.completedAt || null,
  settlement: buildSettlementResponse(request),
});

const emitRequestRoomMessage = (io, requestId, message) => {
  if (!io || !message) return;
  io.to(`request-${requestId}`).emit("chat-message", { requestId, message });
};

const finalizeSettlementAndComplete = async ({ request, actorId }) => {
  const requesterId = toParticipantId(request?.requesterId);
  const helperId = toParticipantId(request?.helperId);

  if (!requesterId || requesterId !== actorId.toString()) {
    throw createHttpError(403, "Only the requester can confirm the shared charging amount");
  }

  if (!helperId) {
    throw createHttpError(400, "This request does not have an assigned helper");
  }

  if (request.status !== "ACCEPTED") {
    throw createHttpError(400, `Cannot complete request with status: ${request.status}`);
  }

  if (request.settlement?.status !== "PROPOSED" || !request.settlement?.tokenAmount) {
    throw createHttpError(400, "The helper must submit the shared charging amount before confirmation");
  }

  const tokenAmount = Number(request.settlement.tokenAmount);
  const sharedUnits = Number(request.settlement.sharedUnits || 0);
  const balanceAdjustment = calculateSettlementBalanceAdjustment(request);
  const additionalCharge = balanceAdjustment < 0 ? Math.abs(balanceAdjustment) : 0;

  if (additionalCharge > 0 && Number(request.requesterId?.tokenBalance || 0) < additionalCharge) {
    throw createHttpError(
      400,
      `Insufficient tokens. You need ${additionalCharge} more tokens to confirm this settlement.`
    );
  }

  const requesterUpdate = {};
  const requesterHistoryEntry =
    balanceAdjustment < 0
      ? {
          amount: balanceAdjustment,
          type: "payment",
          description: `Additional settlement payment for ${sharedUnits} shared charging units`,
          timestamp: new Date(),
        }
      : balanceAdjustment > 0
        ? {
            amount: balanceAdjustment,
            type: "refund",
            description: `Settlement adjustment refund for ${sharedUnits} shared charging units`,
            timestamp: new Date(),
          }
        : null;

  if (balanceAdjustment !== 0) {
    requesterUpdate.$inc = { tokenBalance: balanceAdjustment };
  }

  if (requesterHistoryEntry) {
    requesterUpdate.$push = { tokenHistory: requesterHistoryEntry };
  }

  const updatedRequester =
    Object.keys(requesterUpdate).length > 0
      ? await User.findByIdAndUpdate(requesterId, requesterUpdate, {
          new: true,
          select: "tokenBalance name email",
        })
      : await User.findById(requesterId).select("tokenBalance name email");

  if (!updatedRequester) {
    throw createHttpError(500, "Failed to update requester balance");
  }

  const updatedHelper = await User.findByIdAndUpdate(
    helperId,
    {
      $inc: { tokenBalance: tokenAmount },
      $push: {
        tokenHistory: {
          amount: tokenAmount,
          type: "reward",
          description: `Received settlement for ${sharedUnits} shared charging units`,
          timestamp: new Date(),
        },
      },
    },
    {
      new: true,
      select: "tokenBalance name email",
    }
  );

  if (!updatedHelper) {
    throw createHttpError(500, "Failed to update helper balance");
  }

  const completedAt = new Date();

  const updatedRequest = await ChargingRequest.findByIdAndUpdate(
    request._id,
    {
      status: "COMPLETED",
      completedAt,
      "settlement.status": "CONFIRMED",
      "settlement.confirmedBy": requesterId,
      "settlement.confirmedAt": completedAt,
    },
    {
      new: true,
    }
  )
    .populate("requesterId", "name email city")
    .populate("helperId", "name email city");

  if (!updatedRequest) {
    throw createHttpError(500, "Failed to update request status");
  }

  await User.findByIdAndUpdate(helperId, {
    isActiveHelper: false,
    currentActiveRequest: null,
  });

  return {
    updatedRequest,
    updatedRequester,
    updatedHelper,
    tokenAmount,
    sharedUnits,
  };
};

const handleSettlementConfirmationRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id.toString();

    const request = await ChargingRequest.findById(requestId).populate(
      "requesterId helperId",
      "name email city tokenBalance"
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Charging request not found",
      });
    }

    const { updatedRequest, updatedRequester, updatedHelper, tokenAmount, sharedUnits } =
      await finalizeSettlementAndComplete({
        request,
        actorId: userId,
      });

    const settlementMessage = await RequestMessage.create({
      requestId,
      senderId: req.user._id,
      senderName: req.user.name || "User",
      senderRole: "requester",
      type: "system",
      text: `Confirmed ${sharedUnits} shared charging units for ${tokenAmount} tokens.`,
      metadata: {
        settlement: buildSettlementResponse(updatedRequest),
      },
    });

    const io = req.app.get("io");
    if (io) {
      const requestPayload = buildRequestUpdatePayload(updatedRequest);
      const roomName = `city-${sanitizeCityForRoom(updatedRequest.city)}`;

      io.to(updatedRequest.requesterId._id.toString()).emit("request-completed", {
        request: requestPayload,
        balances: {
          requester: updatedRequester.tokenBalance,
          helper: updatedHelper.tokenBalance,
        },
        timestamp: new Date().toISOString(),
      });

      io.to(updatedRequest.helperId._id.toString()).emit("request-completed", {
        request: requestPayload,
        balances: {
          requester: updatedRequester.tokenBalance,
          helper: updatedHelper.tokenBalance,
        },
        timestamp: new Date().toISOString(),
      });

      io.to(roomName).emit("request-completed-notification", {
        requestId: updatedRequest._id,
        message: `A charging request has been completed in ${updatedRequest.city}`,
        requesterName: updatedRequest.requesterId.name,
        helperName: updatedRequest.helperId.name,
        status: "COMPLETED",
        completedAt: updatedRequest.completedAt,
        settlement: buildSettlementResponse(updatedRequest),
        timestamp: new Date().toISOString(),
      });

      emitRequestRoomMessage(io, requestId, settlementMessage);
    }

    return res.json({
      success: true,
      message: "Charging request completed successfully",
      request: buildRequestUpdatePayload(updatedRequest),
      balances: {
        requester: updatedRequester.tokenBalance,
        helper: updatedHelper.tokenBalance,
      },
    });
  } catch (error) {
    console.error("Error confirming charging settlement:", error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Failed to confirm charging settlement. Please try again.",
    });
  }
};

const emitRequestLocationUpdate = (io, request) => {
  if (!io || !request?._id) {
    return;
  }

  const payload = {
    request: {
      id: request._id,
      _id: request._id,
      requesterId: toParticipantId(request.requesterId),
      helperId: toParticipantId(request.helperId),
      status: request.status,
      locationCoordinates: request.locationCoordinates || null,
      updatedAt: request.updatedAt || new Date(),
    },
    timestamp: new Date().toISOString(),
  };

  io.to(toParticipantId(request.requesterId)).emit("request-location-updated", payload);

  if (request.helperId) {
    io.to(toParticipantId(request.helperId)).emit("request-location-updated", payload);
  }

  io.to(`request-${request._id}`).emit("request-location-updated", payload);
};

/**
 * POST /api/charging/requests
 * Create a new charging request
 * Requires authentication
 * Deducts 5 tokens from user's balance
 */
router.post("/requests", authMiddleware, async (req, res) => {
  try {
    const {
      location,
      urgency,
      message,
      phoneNumber,
      contactInfo,
      contact,
      estimatedTime,
      timeAvailable,
      locationCoordinates,
    } = req.body;
    const userId = req.user._id;
    const userCity = req.user.city;
    let tokensDeducted = false;

    const rawPhoneNumber = phoneNumber ?? contactInfo ?? contact;
    const normalizedPhoneNumber = typeof rawPhoneNumber === "string" ? rawPhoneNumber.trim() : "";
    const normalizedLocationCoordinates = normalizeLocationCoordinates(locationCoordinates);

    // Validate required fields
    if (!location || !urgency || !normalizedPhoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Location, urgency, and phone number are required fields"
      });
    }

    // Validate phone number format
    const phoneRegex = /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;
    if (!phoneRegex.test(normalizedPhoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid phone number"
      });
    }

    // Validate urgency enum
    const validUrgencyLevels = ["low", "medium", "high"];
    if (!validUrgencyLevels.includes(urgency)) {
      return res.status(400).json({
        success: false,
        message: "Invalid urgency level. Must be: low, medium, or high"
      });
    }

    // Check if user has sufficient tokens
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.tokenBalance < TOKEN_COST) {
      return res.status(400).json({
        success: false,
        message: `Insufficient tokens. You have ${user.tokenBalance} tokens, but ${TOKEN_COST} are required to create a charging request.`
      });
    }

    try {
      // Deduct tokens from user
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $inc: { tokenBalance: -TOKEN_COST },
          $push: {
            tokenHistory: {
              amount: -TOKEN_COST,
              type: "charging_request",
              description: "Created charging request",
              timestamp: new Date()
            }
          }
        },
        {
          new: true,
          select: 'tokenBalance email name city'
        }
      );

      if (!updatedUser) {
        throw new Error("Failed to update user tokens");
      }
      tokensDeducted = true;

      // Create charging request
      const request = await ChargingRequest.create({
        requesterId: userId,
        city: userCity,
        status: "OPEN",
        location: location.trim(),
        ...(normalizedLocationCoordinates ? { locationCoordinates: normalizedLocationCoordinates } : {}),
        urgency: urgency.toLowerCase(),
        message: message ? message.trim() : "",
        phoneNumber: normalizedPhoneNumber,
        estimatedTime: estimatedTime ? parseInt(estimatedTime) : null,
        tokenCost: TOKEN_COST
      });

      console.log(`\n=== NEW REQUEST CREATED ===`);
      console.log(`Request ID: ${request._id}`);
      console.log(`User ID: ${userId}`);
      console.log(`City: "${userCity}"`);
      console.log(`Status: ${request.status}`);
      console.log(`Location: ${request.location}`);
      console.log(`Urgency: ${request.urgency}`);
      console.log(`===========================\n`);

      // Populate requester information for socket event
      const populatedRequest = await ChargingRequest.findById(request._id)
        .populate('requesterId', 'name email city')
        .lean();

      // Emit real-time event to helpers in the same city
      // Note: This will be handled by importing io from server.js
      // For now, we'll emit the event and handle it in the server file
      const io = req.app.get('io');
      if (io) {
        const roomName = `city-${sanitizeCityForRoom(userCity)}`;
        
        io.to(roomName).emit('charging-request', {
          id: request._id,
          requesterId: request.requesterId,
          requesterName: updatedUser.name,
          requesterEmail: updatedUser.email,
          city: request.city,
          location: request.location,
          locationCoordinates: request.locationCoordinates || null,
          urgency: request.urgency,
          message: request.message,
          phoneNumber: request.phoneNumber,
          estimatedTime: request.estimatedTime,
          status: request.status,
          tokenCost: request.tokenCost,
          createdAt: request.createdAt
        });

        console.log(`Charging request ${request._id} broadcasted to city room: ${roomName}`);
      }

      // Return success response
      res.status(201).json({
        success: true,
        message: "Charging request created successfully",
        charging: {
          _id: request._id,
          requesterId: request.requesterId,
          city: request.city,
          status: request.status,
          location: request.location,
          locationCoordinates: request.locationCoordinates || null,
          urgency: request.urgency,
          message: request.message,
          phoneNumber: request.phoneNumber,
          estimatedTime: request.estimatedTime ?? timeAvailable ?? null,
          tokenCost: request.tokenCost,
          remainingTokens: updatedUser.tokenBalance,
          createdAt: request.createdAt
        }
      });

    } catch (error) {
      console.error("Error creating charging request:", error);

      if (tokensDeducted) {
        try {
          await User.findByIdAndUpdate(
            userId,
            {
              $inc: { tokenBalance: TOKEN_COST },
              $push: {
                tokenHistory: {
                  amount: TOKEN_COST,
                  type: "refund",
                  description: "Refunded failed charging request",
                  timestamp: new Date()
                }
              }
            }
          );
          console.warn(`Refunded ${TOKEN_COST} tokens after request creation failed for user ${userId}`);
        } catch (refundError) {
          console.error("Failed to refund tokens after request creation error:", refundError);
        }
      }

      res.status(500).json({
        success: false,
        message: "Failed to create charging request. Please try again."
      });
    }

  } catch (error) {
    console.error("Error creating charging request:", error);
    
    res.status(500).json({
      success: false,
      message: "Internal server error while creating charging request"
    });
  }
});

/**
 * GET /api/charging/requests
 * Get all charging requests for the authenticated user
 * Requires authentication
 */
router.get("/requests", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, city, page = 1, limit = 10 } = req.query;

    // Build query filter
    const filter = { requesterId: userId };
    
    if (status) {
      filter.status = status.toUpperCase();
    }
    
    if (city) {
      filter.city = city;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get requests with pagination
    const requests = await ChargingRequest.find(filter)
      .populate('helperId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination info
    const total = await ChargingRequest.countDocuments(filter);

    res.json({
      success: true,
      requests: requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalRequests: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error("Error fetching charging requests:", error);
    
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching charging requests"
    });
  }
});

/**
 * GET /api/charging/requests/city/:city
 * Get OPEN charging requests from the specified city ONLY
 * This endpoint should only show requests from the user's city
 * Requires authentication
 */
router.get("/requests/city/:city", authMiddleware, async (req, res) => {
  try {
    const { city } = req.params;
    const userCity = req.user.city;
    const { page = 1, limit = 10 } = req.query;

    console.log(`\n=== Fetching requests for city: "${city}", user city: "${userCity}" ===`);

    const normalizedRequestedCity = city?.toString().trim().toLowerCase();
    const normalizedUserCity = userCity?.toString().trim().toLowerCase();
    if (!normalizedRequestedCity || !normalizedUserCity || normalizedRequestedCity !== normalizedUserCity) {
      return res.status(403).json({
        success: false,
        message: "You can only view requests from your own city."
      });
    }

    // CRITICAL FIX: Only get requests from the specified city
    // Use case-insensitive regex to handle city name variations
    const filter = {
      status: "OPEN",
      city: buildCityExactMatchRegex(userCity)
    };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch open requests from the specified city only
    const requests = await ChargingRequest.find(filter)
      .populate('requesterId', 'name email city')
      .sort({ createdAt: -1 }) // Sort by most recent first
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await ChargingRequest.countDocuments(filter);

    console.log(`Found ${total} OPEN requests in city "${city}"`);
    console.log(`Showing ${requests.length} requests (page ${page})`);

    res.json({
      success: true,
      requests: requests.map(req => ({
        ...req,
        isFromUserCity: true
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalRequests: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error("Error fetching city charging requests:", error);
    
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching city charging requests"
    });
  }
});

/**
 * POST /api/charging/requests/:requestId/accept
 * Accept a charging request
 * Requires authentication
 */
router.post("/requests/:requestId/accept", authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const helperId = req.user._id.toString();

    // SAFETY CHECK: Verify helper is not already active on another request
    const helper = await User.findById(helperId);
    if (!helper) {
      return res.status(404).json({
        success: false,
        message: "Helper user not found"
      });
    }

    if (!helper.city) {
      return res.status(400).json({
        success: false,
        message: "Helper city is missing. Please update your profile."
      });
    }

    if (helper.isActiveHelper && helper.currentActiveRequest) {
      return res.status(400).json({
        success: false,
        message: "You already have an active charging request. Please complete it before accepting another.",
        currentActiveRequest: helper.currentActiveRequest
      });
    }

    // SAFETY CHECK: Use atomic operation with additional constraints to prevent race conditions
    const request = await ChargingRequest.findOneAndUpdate(
      { 
        _id: requestId, 
        status: "OPEN",
        requesterId: { $ne: helperId }, // Prevent accepting own request
        helperId: { $eq: null }, // Ensure no helper is assigned yet
        city: buildCityExactMatchRegex(helper.city) // Ensure same-city acceptance
      },
      { 
        helperId: helperId,
        status: "ACCEPTED",
        acceptedAt: new Date()
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
        return res.status(404).json({
          success: false,
          message: "Charging request not found"
        });
      } else if (existingRequest.status !== "OPEN") {
        return res.status(400).json({
          success: false,
          message: `This request is no longer available (status: ${existingRequest.status})`
        });
      } else if (existingRequest.city?.toLowerCase() !== helper.city?.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: "You can only accept requests from your own city"
        });
      } else if (existingRequest.requesterId.toString() === helperId) {
        return res.status(400).json({
          success: false,
          message: "You cannot accept your own charging request"
        });
      } else if (existingRequest.helperId) {
        return res.status(400).json({
          success: false,
          message: "This request has already been accepted by another helper"
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Unable to accept request at this time. Please try again."
        });
      }
    }

    // SAFETY CHECK: Update helper status atomically
    const updatedHelper = await User.findByIdAndUpdate(
      helperId,
      {
        isActiveHelper: true,
        currentActiveRequest: requestId
      },
      { new: true }
    );

    if (!updatedHelper) {
      throw new Error("Failed to update helper status");
    }

    // Emit real-time event to requester
    const io = req.app.get('io');
    if (io) {
      // Notify the specific requester
      io.to(request.requesterId._id.toString()).emit('charging-request-accepted', {
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

      // Notify the city that request was accepted
      const roomName = `city-${sanitizeCityForRoom(request.city)}`;
      io.to(roomName).emit('request-accepted-notification', {
        requestId: request._id,
        message: `A charging request has been accepted in ${request.city}`,
        timestamp: new Date().toISOString()
      });

      console.log(`Charging request ${requestId} accepted by ${helperId}`);
    }

    res.json({
      success: true,
      message: "Charging request accepted successfully",
      request: {
        id: request._id,
        requesterId: request.requesterId._id,
        helperId: request.helperId._id,
        city: request.city,
        status: request.status,
        acceptedAt: request.acceptedAt
      }
    });

  } catch (error) {
    console.error("Error accepting charging request:", error);
    
    res.status(500).json({
      success: false,
      message: "Internal server error while accepting charging request"
    });
  }
});

/**
 * POST /api/charging/requests/:requestId/settlement
 * Helper proposes the shared charging amount for an accepted request
 */
router.post("/requests/:requestId/settlement", authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id.toString();
    const sharedUnits = normalizeSharedUnits(req.body?.sharedUnits);
    const helperNote = sanitizeSettlementNote(req.body?.helperNote);

    if (!sharedUnits) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid shared charging amount greater than 0.",
      });
    }

    const request = await ChargingRequest.findById(requestId).populate(
      "requesterId helperId",
      "name email city tokenBalance"
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Charging request not found",
      });
    }

    if (!request.helperId || request.helperId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned helper can submit the shared charging amount",
      });
    }

    if (request.status !== "ACCEPTED") {
      return res.status(400).json({
        success: false,
        message: `Cannot submit a settlement for a request with status: ${request.status}`,
      });
    }

    const tokenAmount = calculateSettlementTokens(sharedUnits);
    const proposedAt = new Date();

    const updatedRequest = await ChargingRequest.findByIdAndUpdate(
      requestId,
      {
        "settlement.status": "PROPOSED",
        "settlement.sharedUnits": sharedUnits,
        "settlement.tokenAmount": tokenAmount,
        "settlement.helperNote": helperNote,
        "settlement.proposedBy": req.user._id,
        "settlement.proposedAt": proposedAt,
        "settlement.confirmedBy": null,
        "settlement.confirmedAt": null,
      },
      {
        new: true,
      }
    )
      .populate("requesterId", "name email city")
      .populate("helperId", "name email city");

    const settlementMessage = await RequestMessage.create({
      requestId,
      senderId: req.user._id,
      senderName: req.user.name || "User",
      senderRole: "helper",
      type: "system",
      text: `Proposed ${sharedUnits} shared charging units for ${tokenAmount} tokens.`,
      metadata: {
        settlement: buildSettlementResponse(updatedRequest),
      },
    });

    const io = req.app.get("io");
    if (io) {
      const requestPayload = buildRequestUpdatePayload(updatedRequest);

      io.to(updatedRequest.requesterId._id.toString()).emit("request-settlement-proposed", {
        request: requestPayload,
        timestamp: new Date().toISOString(),
      });

      io.to(updatedRequest.helperId._id.toString()).emit("request-settlement-proposed", {
        request: requestPayload,
        timestamp: new Date().toISOString(),
      });

      emitRequestRoomMessage(io, requestId, settlementMessage);
    }

    return res.json({
      success: true,
      message: "Shared charging amount submitted successfully",
      request: buildRequestUpdatePayload(updatedRequest),
    });
  } catch (error) {
    console.error("Error submitting charging settlement:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit the shared charging amount. Please try again.",
    });
  }
});

/**
 * POST /api/charging/requests/:requestId/settlement/confirm
 * Requester confirms the proposed shared charging amount and transfers tokens
 */
router.post("/requests/:requestId/settlement/confirm", authMiddleware, handleSettlementConfirmationRequest);

router.post("/requests/:requestId/location", authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id.toString();
    const normalizedLocationCoordinates = normalizeLocationCoordinates(req.body?.locationCoordinates);

    if (!normalizedLocationCoordinates) {
      return res.status(400).json({
        success: false,
        message: "Valid location coordinates are required.",
      });
    }

    const request = await ChargingRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Charging request not found",
      });
    }

    if (request.requesterId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the requester can update the request location",
      });
    }

    if (!["OPEN", "ACCEPTED"].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot update location for a request with status: ${request.status}`,
      });
    }

    request.locationCoordinates = normalizedLocationCoordinates;
    await request.save();

    const io = req.app.get("io");
    emitRequestLocationUpdate(io, request);

    return res.json({
      success: true,
      message: "Request location updated successfully",
      request: {
        id: request._id,
        _id: request._id,
        locationCoordinates: request.locationCoordinates,
        status: request.status,
      },
    });
  } catch (error) {
    console.error("Error updating request location:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update request location",
    });
  }
});

/**
 * POST /api/charging/requests/:requestId/complete
 * Backward-compatible alias for requester settlement confirmation
 */
router.post("/requests/:requestId/complete", authMiddleware, handleSettlementConfirmationRequest);

/**
 * POST /api/charging/requests/:requestId/cancel
 * Cancel a charging request
 * Refund tokens to requester
 * Only requester can cancel
 */
router.post("/requests/:requestId/cancel", authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id.toString();

    // Find the request
    const request = await ChargingRequest.findById(requestId)
      .populate('requesterId', 'name email city tokenBalance');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Charging request not found"
      });
    }

    // Authorization check: Only requester can cancel
    if (request.requesterId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the requester can cancel this request"
      });
    }

    // Status check: Only OPEN or ACCEPTED requests can be canceled
    if (request.status !== "OPEN" && request.status !== "ACCEPTED") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel request with status: ${request.status}`
      });
    }

    try {
      // Refund tokens to requester
      const updatedUser = await User.findByIdAndUpdate(
        request.requesterId._id,
        {
          $inc: { tokenBalance: TOKEN_COST },
          $push: {
            tokenHistory: {
              amount: TOKEN_COST,
              type: "refund",
              description: "Refunded canceled charging request",
              timestamp: new Date()
            }
          }
        },
        {
          new: true,
          select: 'tokenBalance name email'
        }
      );

      if (!updatedUser) {
        throw new Error("Failed to refund tokens");
      }

      // Update request status to CANCELED
      const updatedRequest = await ChargingRequest.findByIdAndUpdate(
        requestId,
        {
          status: "CANCELED",
          canceledAt: new Date()
        },
        {
          new: true,
          populate: { path: 'requesterId', select: 'name email city' }
        }
      );

      if (!updatedRequest) {
        throw new Error("Failed to update request status");
      }

      // SAFETY CHECK: Reset helper status if request was accepted
      if (request.helperId) {
        await User.findByIdAndUpdate(
          request.helperId._id,
          {
            isActiveHelper: false,
            currentActiveRequest: null
          }
        );
      }

      console.log(`Charging request ${requestId} canceled. Tokens refunded to ${request.requesterId._id}`);

      // Emit real-time notifications
      const io = req.app.get('io');
      if (io) {
        const roomName = `city-${sanitizeCityForRoom(request.city)}`;

        // 1. Notify requester of cancellation confirmation
        io.to(request.requesterId._id.toString()).emit('request-canceled', {
          request: {
            id: updatedRequest._id,
            status: updatedRequest.status,
            canceledAt: updatedRequest.canceledAt,
            tokenAmount: TOKEN_COST
          },
          newBalance: updatedUser.tokenBalance,
          timestamp: new Date().toISOString()
        });

        // 2. Notify city that request was canceled
        io.to(roomName).emit('request-canceled-notification', {
          requestId: updatedRequest._id,
          message: `A charging request has been canceled in ${request.city}`,
          requesterName: updatedRequest.requesterId.name,
          status: "CANCELED",
          canceledAt: updatedRequest.canceledAt,
          timestamp: new Date().toISOString()
        });

        // 3. If request was accepted, notify helper that it was canceled
        if (request.helperId) {
          io.to(request.helperId.toString()).emit('request-canceled-by-requester', {
            request: {
              id: updatedRequest._id,
              requesterName: updatedRequest.requesterId.name,
              status: updatedRequest.status,
              canceledAt: updatedRequest.canceledAt
            },
            timestamp: new Date().toISOString()
          });
        }
      }

      res.json({
        success: true,
        message: "Charging request canceled successfully",
        request: {
          id: updatedRequest._id,
          requesterId: updatedRequest.requesterId._id,
          city: updatedRequest.city,
          status: updatedRequest.status,
          canceledAt: updatedRequest.canceledAt,
          tokenAmount: TOKEN_COST
        },
        newBalance: updatedUser.tokenBalance
      });

    } catch (error) {
      console.error("Error canceling charging request:", error);

      res.status(500).json({
        success: false,
        message: "Failed to cancel charging request. Please try again."
      });
    }

  } catch (error) {
    console.error("Error canceling charging request:", error);
    
    res.status(500).json({
      success: false,
      message: "Internal server error while canceling charging request"
    });
  }
});

/**
 * POST /api/charging/requests/:requestId/complete-requester
 * Backward-compatible alias for requester settlement confirmation
 */
router.post("/requests/:requestId/complete-requester", authMiddleware, handleSettlementConfirmationRequest);

/**
 * GET /api/charging/requests/helper
 * Get all ACCEPTED charging requests for the authenticated helper
 * Requires authentication
 */
router.get("/requests/helper", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    // Build query filter for helper's accepted requests
    const filter = { 
      helperId: userId, 
      status: "ACCEPTED"
    };

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get accepted requests with pagination
    const requests = await ChargingRequest.find(filter)
      .populate('requesterId', 'name email city location urgency phoneNumber')
      .sort({ acceptedAt: -1 }) // Most recently accepted first
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await ChargingRequest.countDocuments(filter);

    res.json({
      success: true,
      requests: requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalRequests: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error("Error fetching helper requests:", error);
    
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching helper requests"
    });
  }
});

/**
 * GET /api/charging/requests/:requestId
 * Get a single request (requester/helper only)
 */
router.get("/requests/:requestId", authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id.toString();

    const request = await ChargingRequest.findById(requestId)
      .populate('requesterId', 'name email city')
      .populate('helperId', 'name email city')
      .lean();

    if (!request) {
      return res.status(404).json({ success: false, message: "Charging request not found" });
    }

    if (!isParticipant(request, userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.json({ success: true, request });
  } catch (error) {
    console.error("Error fetching request:", error);
    res.status(500).json({ success: false, message: "Failed to fetch request" });
  }
});

/**
 * GET /api/charging/requests/:requestId/messages
 * Get chat messages for a request (requester/helper only)
 */
router.get("/requests/:requestId/messages", authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id.toString();

    const request = await ChargingRequest.findById(requestId).lean();
    if (!request) {
      return res.status(404).json({ success: false, message: "Charging request not found" });
    }

    if (!isParticipant(request, userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const messages = await RequestMessage.find({ requestId })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching request messages:", error);
    res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
});

/**
 * POST /api/charging/requests/:requestId/messages
 * Send a chat message (requester/helper only)
 */
router.post("/requests/:requestId/messages", authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id.toString();
    const text = sanitizeMessage(req.body?.text);

    if (!text) {
      return res.status(400).json({ success: false, message: "Message cannot be empty" });
    }

    const request = await ChargingRequest.findById(requestId).lean();
    if (!request) {
      return res.status(404).json({ success: false, message: "Charging request not found" });
    }

    if (!isParticipant(request, userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (!["ACCEPTED", "COMPLETED"].includes(request.status)) {
      return res.status(400).json({ success: false, message: "Chat is available only after a request is accepted" });
    }

    const senderRole = request.requesterId.toString() === userId ? "requester" : "helper";

    const message = await RequestMessage.create({
      requestId,
      senderId: userId,
      senderName: req.user.name || "User",
      senderRole,
      type: "text",
      text
    });

    const io = req.app.get("io");
    if (io) {
      const roomName = `request-${requestId}`;
      io.to(roomName).emit("chat-message", { requestId, message });
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Error sending chat message:", error);
    res.status(500).json({ success: false, message: "Failed to send message" });
  }
});

/**
 * POST /api/charging/requests/:requestId/share-contact
 * Share masked contact info in chat (requester/helper only)
 */
router.post("/requests/:requestId/share-contact", authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id.toString();

    const request = await ChargingRequest.findById(requestId).lean();
    if (!request) {
      return res.status(404).json({ success: false, message: "Charging request not found" });
    }

    if (!isParticipant(request, userId)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (!["ACCEPTED", "COMPLETED"].includes(request.status)) {
      return res.status(400).json({ success: false, message: "Contact sharing is available only after acceptance" });
    }

    const senderRole = request.requesterId.toString() === userId ? "requester" : "helper";
    const maskedEmail = maskEmail(req.user.email);
    const maskedPhone = senderRole === "requester" ? maskPhone(request.phoneNumber) : "";

    const message = await RequestMessage.create({
      requestId,
      senderId: userId,
      senderName: req.user.name || "User",
      senderRole,
      type: "contact",
      text: "Shared contact details",
      metadata: {
        phoneMasked: maskedPhone,
        emailMasked: maskedEmail
      }
    });

    const io = req.app.get("io");
    if (io) {
      const roomName = `request-${requestId}`;
      io.to(roomName).emit("chat-message", { requestId, message });
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Error sharing contact:", error);
    res.status(500).json({ success: false, message: "Failed to share contact" });
  }
});

export default router;
