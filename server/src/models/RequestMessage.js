import mongoose from "mongoose";

const DEFAULT_RETENTION_DAYS = 1;

const requestMessageSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChargingRequest",
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    senderName: {
      type: String,
      required: true,
      trim: true
    },
    senderRole: {
      type: String,
      enum: ["requester", "helper", "system"],
      required: true
    },
    type: {
      type: String,
      enum: ["text", "contact", "system"],
      default: "text"
    },
    text: {
      type: String,
      trim: true,
      default: ""
    },
    metadata: {
      type: Object,
      default: {}
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
      index: { expires: 0 }
    }
  },
  {
    timestamps: true
  }
);

const RequestMessage = mongoose.model("RequestMessage", requestMessageSchema);

export default RequestMessage;
