import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  getBlynkSnapshot,
  sendBlynkControl
} from "../services/blynk.js";

const router = express.Router();

router.get("/device", authMiddleware, async (req, res) => {
  try {
    const snapshot = await getBlynkSnapshot();
    res.json({
      success: true,
      ...snapshot
    });
  } catch (error) {
    console.error("Error fetching Blynk device snapshot:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch Blynk device snapshot."
    });
  }
});

router.post("/device/control", authMiddleware, async (req, res) => {
  try {
    const snapshot = await sendBlynkControl(req.body || {});

    const io = req.app.get("io");
    if (io) {
      io.emit("blynk-status", snapshot);
    }

    res.json({
      success: true,
      message: "Blynk command sent successfully.",
      snapshot
    });
  } catch (error) {
    console.error("Error sending Blynk control command:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to send Blynk control command."
    });
  }
});

export default router;
