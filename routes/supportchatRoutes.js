const express = require("express");
const router = express.Router();

const supportAuth = require("../middleware/supportAuthmiddleware");

const {
  getChatHistory,
  sendMessage,
  clearChatHistory,
} = require("../controller/supportChatController");

router.get("/history", supportAuth, getChatHistory);

router.post("/message", supportAuth, sendMessage);

router.delete("/clear", supportAuth, clearChatHistory);

module.exports = router;
