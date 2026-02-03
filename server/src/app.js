import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authroutes.js";
import chargingRoutes from "./routes/chargingRoutes.js";
import authMiddleware from "./middleware/auth.js";
import User from "./models/User.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
connectDB();

const app = express();

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5000',
    'https://evhelper-rm37.vercel.app',
    'https://evhelper.onrender.com'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Serve static HTML files from public folder
const publicPath = path.join(__dirname, '../public');
console.log('DEBUG: __dirname =', __dirname);
console.log('DEBUG: publicPath =', publicPath);
console.log('DEBUG: public folder exists?', fs.existsSync(publicPath));
app.use(express.static(publicPath, { 
  setHeaders: (res) => {
    res.set('Cache-Control', 'public, max-age=3600');
  }
}));

app.use("/api/auth", authRoutes);
app.use("/api/charging", chargingRoutes);

// API 404 (keep API responses JSON)
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Fallback: Serve index.html for any non-API route (SPA-style)
// NOTE: Express 5 + path-to-regexp does not accept '*' as a route string.
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Example of protected routes using the auth middleware
// Uncomment and modify these examples as needed:

// Protect a single route:
// app.get("/api/profile", authMiddleware, (req, res) => {
//   res.json({
//     message: "Access granted to protected profile",
//     user: req.user
//   });
// });

// Protect a group of routes:
// app.use("/api/protected", authMiddleware);
// app.get("/api/protected/data", (req, res) => {
//   res.json({
//     message: "This is protected data",
//     user: req.user
//   });
// });

// Example of a protected route that uses user data:
// app.get("/api/user/tokens", authMiddleware, (req, res) => {
//   res.json({
//     tokenBalance: req.user.tokenBalance,
//     name: req.user.name
//   });
// });

export default app;
