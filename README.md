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
