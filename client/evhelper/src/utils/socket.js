import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.currentToken = null;
  }

  /**
   * Initialize socket connection
   * @param {string} serverUrl - Socket server URL
   * @param {string} city - User's city for room joining
   * @param {string} token - Authentication token (optional)
   */
  connect(serverUrl = null, city = null, token = null) {
    // Auto-detect server URL based on environment
    if (!serverUrl) {
      // Prefer explicit socket URL if provided (recommended for split deployments).
      // Examples:
      // - Dev: VITE_SOCKET_URL=http://localhost:5000
      // - Prod (Render): VITE_SOCKET_URL=https://evhelper.onrender.com
      const envSocketUrl = import.meta.env.VITE_SOCKET_URL && import.meta.env.VITE_SOCKET_URL.trim();
      const envApiUrl = import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim();

      if (envSocketUrl) {
        serverUrl = envSocketUrl;
      } else if (envApiUrl && /^https?:\/\//i.test(envApiUrl)) {
        // Derive socket origin from API URL (strip any /api path).
        serverUrl = new URL(envApiUrl).origin;
      } else if (import.meta.env.PROD) {
        // Monolithic deployment: frontend and backend share an origin.
        serverUrl = window.location.origin;
      } else {
        // Local dev default
        serverUrl = 'http://localhost:5000';
      }
    }
    if (this.socket && this.connected) {
      if (token && token !== this.currentToken) {
        this.socket.disconnect();
        this.socket = null;
        this.connected = false;
      } else {
        console.log('Socket already connected');
        return this.socket;
      }
    }

    // Disconnect any existing socket before creating new one
    if (this.socket) {
      this.socket.disconnect();
    }

    // Configure socket options
    const options = {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    };

    // Add authentication if token provided
    if (token) {
      options.auth = {
        token: token
      };
      this.currentToken = token;
    }

    try {
      this.socket = io(serverUrl, options);

      // Connection events
      this.socket.on('connect', () => {
        this.connected = true;
        console.log('Connected to socket server with ID:', this.socket.id);
        
        // Join city room if city provided
        if (city) {
          this.joinCity(city);
        }
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        console.log('Disconnected from socket server:', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      // Built-in event handlers
      this.setupEventHandlers();

      return this.socket;
    } catch (error) {
      console.error('Error initializing socket connection:', error);
      return null;
    }
  }

  /**
   * Join a city-specific room
   * @param {string} city - City name to join
   */
  joinCity(city) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected. Cannot join city room.');
      return false;
    }

    this.socket.emit('join-city', { city });
    console.log(`Attempting to join city room for: ${city}`);
    return true;
  }

  /**
   * Leave current city room
   */
  leaveCity() {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected. Cannot leave city room.');
      return false;
    }

    this.socket.emit('leave-city');
    console.log('Leaving current city room');
    return true;
  }

  /**
   * Send a charging request to users in the same city
   * @param {Object} requestData - Charging request data
   */
  sendChargingRequest(requestData) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected. Cannot send charging request.');
      return false;
    }

    this.socket.emit('charging-request', requestData);
    console.log('Charging request sent:', requestData);
    return true;
  }

  /**
   * Accept a charging request
   * @param {string} requestId - ID of the charging request
   */
  acceptChargingRequest(requestId) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected. Cannot accept charging request.');
      return false;
    }

    this.socket.emit('accept-charging-request', { requestId });
    console.log(`Charging request ${requestId} accepted`);
    return true;
  }

  /**
   * Get active requests in the city
   * @returns {Array} - Array of active requests
   */
  getActiveRequests() {
    // This would typically make an API call
    // For demo purposes, we'll return a mock array
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          {
            _id: '1',
            requesterId: 'user1',
            requesterName: 'John Doe',
            city: 'San Francisco',
            location: 'Downtown',
            urgency: 'high',
            message: 'Need immediate assistance - battery at 2%',
            contactInfo: '555-0123',
            estimatedTime: 15,
            status: 'OPEN',
            tokenCost: 5,
            createdAt: new Date(Date.now() - 300000)
          },
          {
            _id: '2',
            requesterId: 'user2',
            requesterName: 'Jane Smith',
            city: 'San Francisco',
            location: 'Union Square',
            urgency: 'medium',
            message: 'Need help with charging cable',
            contactInfo: '555-0456',
            estimatedTime: 30,
            status: 'OPEN',
            tokenCost: 5,
            createdAt: new Date(Date.now() - 600000)
          }
        ]);
      }, 500);
    });
  }

  /**
   * Setup built-in event handlers
   */
  setupEventHandlers() {
    // City room events
    this.socket.on('city-joined', (data) => {
      console.log('Successfully joined city room:', data);
    });

    this.socket.on('city-left', (data) => {
      console.log('Left city room:', data);
    });

    this.socket.on('user-joined-city', (data) => {
      console.log('New user joined city:', data);
    });

    this.socket.on('user-left-city', (data) => {
      console.log('User left city:', data);
    });

    // Charging request events
    this.socket.on('charging-request', (data) => {
      console.log('New charging request received:', data);
    });

    this.socket.on('charging-request-accepted', (data) => {
      console.log('Your charging request was accepted:', data);
    });

    this.socket.on('request-accepted-notification', (data) => {
      console.log('Charging request accepted notification:', data);
    });

    // Error handling
    this.socket.on('error', (data) => {
      console.error('Socket error:', data);
    });
  }

  /**
   * Add custom event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback function
   */
  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Emit event
   * @param {string} event - Event name
   * @param {Object} data - Payload
   */
  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback function
   */
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.currentToken = null;
      console.log('Socket disconnected manually');
    }
  }

  /**
   * Get connection status
   * @returns {boolean} - Connection status
   */
  isConnected() {
    return this.connected && this.socket?.connected;
  }

  /**
   * Get socket ID
   * @returns {string|null} - Socket ID or null if not connected
   */
  getSocketId() {
    return this.socket?.id || null;
  }
}

// Create and export singleton instance
const socketService = new SocketService();
export default socketService;
