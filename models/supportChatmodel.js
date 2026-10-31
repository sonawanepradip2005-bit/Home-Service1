const mongoose = require("mongoose");

const supportChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    needsHuman: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

supportChatSchema.index({ userId: 1, createdAt: 1 });

module.exports = mongoose.model("SupportChat", supportChatSchema);