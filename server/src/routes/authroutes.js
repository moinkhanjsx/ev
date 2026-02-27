import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const router = express.Router();

/**
 * REGISTER
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, city } = req.body;

    if (!name || !email || !password || !city) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      city,
      tokenBalance: 50, // initial tokens
    });

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        city: user.city,
        tokenBalance: user.tokenBalance,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed" });
  }
});

/**
 * LOGIN
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        city: user.city,
        tokenBalance: user.tokenBalance,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

/**
 * GOOGLE LOGIN
 */
router.post("/google", async (req, res) => {
  try {
    const { credential, city } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: "Google login is not configured" });
    }

    if (!credential) {
      return res.status(400).json({ message: "Missing Google credential" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const name = payload?.name || "EV Helper User";

    if (!email) {
      return res.status(400).json({ message: "Google account email not available" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      if (!city || !city.trim()) {
        return res.status(400).json({
          message: "City required for new Google users",
          code: "CITY_REQUIRED"
        });
      }

      const hashedPassword = await bcrypt.hash(jwt.sign({ email }, process.env.JWT_SECRET), 10);

      user = await User.create({
        name,
        email,
        password: hashedPassword,
        city: city.trim(),
        tokenBalance: 50
      });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Google login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        city: user.city,
        tokenBalance: user.tokenBalance
      }
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({ message: "Google login failed" });
  }
});

export default router;
