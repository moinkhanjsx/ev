# EV Helper

A full-stack application for EV charging assistance with real-time communication.

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local or cloud instance)

### Quick Start

1. **Install all dependencies:**
   ```bash
   npm run setup
   ```

2. **Configure environment variables:**
   Create a `.env` file in the `server` directory:
   ```
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   NODE_ENV=development
   ```

3. **Run in development mode (separate terminals):**
   
   **Backend**
   ```bash
   cd server
   npm run dev
   ```
   
   **Frontend**
   ```bash
   cd client/evhelper
   npm run dev
   ```
   
   Notes:
   - Backend defaults to port **5000**.
   - Vite usually uses **5173**, but may automatically pick **5174** (or another port) if 5173 is busy. Use the URL printed in the terminal.

### Blynk Hardware Integration

The dashboard includes a live Blynk charging hardware panel backed by server-side routes:

- `GET /api/blynk/device` returns the latest hardware snapshot
- `POST /api/blynk/device/control` writes to mapped Blynk control datastreams

Keep Blynk credentials in `server/.env`, never in the React app. Use `server/.env.example` as the template.

Out of the box, the server will also auto-discover Blynk device-token profiles from `blynkhelper/*.ino`. That is useful for local prototyping when the ESP sketches already contain Blynk auth tokens and virtual pin mappings.

Supported setup modes:

- Auto-discovery from `blynkhelper/*.ino`
- `BLYNK_DEVICE_TOKEN` for the device HTTPS API
- `BLYNK_ACCESS_TOKEN` with `BLYNK_DEVICE_ID` for the Blynk platform API

Map the hardware pins you want to display and control with `BLYNK_DATASTREAMS_JSON`, for example:

```json
[
  { "key": "availableUnits", "label": "Available Units", "pin": "v0", "unit": "units", "valueType": "number" },
  { "key": "chargingPower", "label": "Charging Power", "pin": "v1", "unit": "kW", "valueType": "number" },
  { "key": "chargeRelay", "label": "Charge Relay", "pin": "v3", "writable": true, "kind": "toggle", "onValue": 1, "offValue": 0, "onLabel": "Start Charging", "offLabel": "Stop Charging", "valueType": "number" }
]
```

With the current sketches in `blynkhelper`, the app can already infer:

- `V0` battery voltage
- `V1` battery percentage
- `V2` status text
- `V3` relay control

The app also derives an energy-flow label such as "Receiving Power" or "Sending Power" from the status and relay state. It does not yet measure true kWh / unit transfer unless the hardware publishes those values on additional datastreams.

### Available Scripts

- `npm run server:dev` - Run only backend with nodemon (from repo root)
- `npm run client:dev` - Run only frontend with Vite (from repo root)
- `cd server && npm run dev` - Run backend from the server package
- `cd client/evhelper && npm run dev` - Run frontend from the client package
- `npm run build` - Build the frontend for production
- `npm run start` - Start the production server
- `npm run install-deps` - Install dependencies for all packages

### Production Deployment

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Set environment variable:
   ```
   NODE_ENV=production
   ```

3. Start the server:
   ```bash
   npm start
   ```

The application will serve the React frontend and API from the same server on port 5000.

### Project Structure

```
evhelper/
├── package.json              # Root scripts (no combined dev runner)
├── README.md                 # This file
├── server/                   # Backend Express.js application
│   ├── server.js            # Main server entry point
│   ├── src/
│   │   ├── app.js           # Express app configuration
│   │   ├── config/          # Database configuration
│   │   ├── middleware/      # Authentication middleware
│   │   ├── models/          # MongoDB models
│   │   └── routes/          # API routes
│   └── .env                 # Environment variables
└── client/
    └── evhelper/            # React frontend application
        ├── src/
        │   ├── components/  # React components
        │   ├── pages/       # Page components
        │   ├── context/     # React context providers
        │   └── utils/       # Utility functions
        ├── public/          # Static assets
        └── dist/            # Built production files
```

### Features

- **Real-time Communication**: Socket.io for live charging request updates
- **User Authentication**: JWT-based authentication system
- **City-based Matching**: Connect users and helpers in the same city
- **Charging Request Management**: Create, accept, and track charging requests
- **Responsive Design**: Mobile-friendly React frontend

### API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/charging/requests` - Get charging requests
- `POST /api/charging/request` - Create charging request
- `POST /api/charging/accept/:id` - Accept charging request

### Socket Events

- `join-city` - Join a city-specific room
- `charging-request` - Broadcast new charging request
- `accept-charging-request` - Accept a charging request
- `charging-request-accepted` - Notification when request is accepted
