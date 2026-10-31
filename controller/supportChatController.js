const axios = require("axios");
const SupportChat = require("../models/supportChatmodel");

const SYSTEM_PROMPT = `
You are Kane Reene, the official Customer Support Representative for Home-Service app.

Your job is to help customers with:
1. Home Shifting services & status
2. Office Shifting
3. Painting & Vehicle shifting services
4. Cleaning & sanitization services
5. Booking and Orders tracking
6. Payment and Refund questions
7. Pickup and Drop locations
8. Furniture, packing and labor details
9. Booking Date and Time changes

Rules:
- Always reply politely, warmly and professionally.
- Keep answers concise, natural, friendly and helpful (2-4 sentences max per message).
- You can understand Marathi, Hindi, and English.
- Reply in the language used by the customer (Marathi if customer speaks Marathi, Hindi if Hindi, English otherwise).
- If customer asks about an order or shifting, ask for their Order ID or advise them to check their Order History tab.
- Never invent fake tracking info or cancel orders without backend confirmation.
- Be encouraging and helpful, using occasional emojis when appropriate.
`;

exports.getChatHistory = async (req, res) => {
  try {
    const messages = await SupportChat.find({
      userId: req.user.userId,
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Get chat history error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load chat history",
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    if (message.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message is too long",
      });
    }

    const userId = req.user.userId;
    const cleanMessage = message.trim();

    // 1. Save user message to database
    const userMessage = await SupportChat.create({
      userId,
      role: "user",
      message: cleanMessage,
    });

    // 2. Fetch recent conversation context
    const previousMessages = await SupportChat.find({
      userId,
    })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    previousMessages.reverse();

    const chatMessages = [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      ...previousMessages.map((item) => ({
        role: item.role,
        content: item.message,
      })),
    ];

    let aiReply = "";
    const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();

    if (apiKey) {
      try {
        const response = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
            messages: chatMessages,
            temperature: 0.6,
            max_tokens: 400,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://home-service.app",
              "X-Title": "Home-Service Support Chat",
            },
            timeout: 25000,
          }
        );

        aiReply = response.data.choices?.[0]?.message?.content?.trim();
      } catch (apiErr) {
        console.error(
          "OpenRouter API error:",
          apiErr.response?.data || apiErr.message
        );
      }
    }

    // Fallback if AI service is temporarily unavailable
    if (!aiReply) {
      aiReply =
        "Thank you for contacting Home-Service Support! Our support team has received your message and is reviewing it. You can check your order status in the Order History section or reply here with any further details.";
    }

    // 3. Save assistant response
    const assistantMessage = await SupportChat.create({
      userId,
      role: "assistant",
      message: aiReply,
    });

    return res.status(200).json({
      success: true,
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    console.error("Support Chat Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to process message. Please try again.",
    });
  }
};

exports.clearChatHistory = async (req, res) => {
  try {
    await SupportChat.deleteMany({
      userId: req.user.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Chat history cleared successfully",
    });
  } catch (error) {
    console.error("Clear chat history error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to clear chat history",
    });
  }
};
