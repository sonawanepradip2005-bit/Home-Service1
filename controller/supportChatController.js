const axios = require("axios");
const SupportChat = require("../models/supportChatmodel");

const SYSTEM_PROMPT = `
You are Kane Reene, the friendly and helpful Customer Support Representative for Home-Service mobile app.

Your job is to assist users with:
1. Home Shifting & Office Shifting orders
2. Adding/modifying furniture, boxes, or shifting items
3. Painting, Cleaning, and Vehicle Shifting services
4. Checking order history and tracking active bookings
5. Payment questions and refunds
6. Change of shifting date or pickup/drop locations

CRITICAL FORMATTING RULES:
- You are chatting in a mobile chat app. NEVER write long essays, markdown headers (#, ##), or long bullet lists.
- ALWAYS respond in 2 or 3 short, natural chat bubbles (like WhatsApp or iMessage).
- Separate each chat bubble with the delimiter: ---BUBBLE---
- Each bubble should be 1 or 2 concise, conversational sentences with friendly tone and emojis.
- If user speaks Marathi or Hindi, reply in their language using 2 friendly bubbles separated by ---BUBBLE---.

Example 1:
User: "Hey, I need help !"
Your response:
Good morning! Welcome to Home-Service Support 😊
---BUBBLE---
How can I help you today? Feel free to ask about Shifting, Cleaning, or your bookings!

Example 2:
User: "I ordered today, but I forgot to add some furniture, so How can I add more?"
Your response:
Ok, you just need to search for History in the app menu and there you can see your order details.
---BUBBLE---
You can edit or add items to your booking there super fast 🔥
`;

const getSmartFallbackBubbles = (message) => {
  const lower = (message || "").toLowerCase();

  if (
    lower.includes("furniture") ||
    lower.includes("add") ||
    lower.includes("item") ||
    lower.includes("box")
  ) {
    return [
      "Ok, you just need to search for History in the app menu and there you can see your order details.",
      "You can edit or add furniture items to your booking there super fast 🔥",
    ];
  }

  if (
    lower.includes("track") ||
    lower.includes("status") ||
    lower.includes("where") ||
    lower.includes("driver")
  ) {
    return [
      "You can view real-time shifting updates directly from your History tab 📍",
      "Your assigned driver and vehicle details will be visible right on the order tracking map 🚚",
    ];
  }

  if (
    lower.includes("pay") ||
    lower.includes("price") ||
    lower.includes("cost") ||
    lower.includes("refund")
  ) {
    return [
      "All pricing is clearly broken down before booking, with no hidden fees 💳",
      "For refund requests or invoice copies, please share your Order ID and we'll process it right away!",
    ];
  }

  if (
    lower.includes("marathi") ||
    lower.includes("kasa") ||
    lower.includes("kay") ||
    lower.includes("namaskar") ||
    lower.includes("madat")
  ) {
    return [
      "नमस्कार! Home-Service सपोर्टमध्ये आपले स्वागत आहे 🙏",
      "तुम्हाला शिफ्टिंग, क्लिनिंग किंवा बुकिंगबद्दल काय मदत हवी आहे, कृपया सांगा!",
    ];
  }

  return [
    "Thank you for contacting Home-Service Support 👋",
    "Our team has received your message and an agent will assist you shortly. Is there anything specific you would like to know?",
  ];
};

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
      messages: messages || [],
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

    const userId = req.user.userId;
    const cleanMessage = message.trim();

    // 1. Save user message to database
    const userMessage = await SupportChat.create({
      userId,
      role: "user",
      message: cleanMessage,
    });

    // 2. Fetch recent conversation context for AI
    const previousMessages = await SupportChat.find({ userId })
      .sort({ createdAt: -1 })
      .limit(12)
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
    const modelToUse = process.env.OPENROUTER_MODEL || "openrouter/free";

    if (apiKey) {
      try {
        const response = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: modelToUse,
            messages: chatMessages,
            temperature: 0.6,
            max_tokens: 350,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://home-service.app",
              "X-Title": "Home-Service Support Chat",
            },
            timeout: 20000,
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

    // 3. Process reply into multiple natural chat bubbles
    let replyBubbles = [];

    if (aiReply) {
      if (aiReply.includes("---BUBBLE---")) {
        replyBubbles = aiReply
          .split("---BUBBLE---")
          .map((b) => b.trim())
          .filter(Boolean);
      } else if (aiReply.includes("\n\n")) {
        replyBubbles = aiReply
          .split(/\n\s*\n/)
          .map((b) => b.trim())
          .filter(Boolean);
      } else {
        // If single long paragraph, split into 2 bubbles if multiple sentences
        const sentences = aiReply.match(/[^.!?]+[.!?]+(?:\s+|$)/g);
        if (sentences && sentences.length >= 2) {
          const mid = Math.ceil(sentences.length / 2);
          replyBubbles = [
            sentences.slice(0, mid).join("").trim(),
            sentences.slice(mid).join("").trim(),
          ].filter(Boolean);
        } else {
          replyBubbles = [aiReply];
        }
      }
    }

    // Fallback if AI call failed or returned empty
    if (!replyBubbles || replyBubbles.length === 0) {
      replyBubbles = getSmartFallbackBubbles(cleanMessage);
    }

    // 4. Save each assistant bubble to database
    const savedAssistantMessages = [];
    const baseTime = Date.now();

    for (let i = 0; i < replyBubbles.length; i++) {
      const bubbleText = replyBubbles[i];
      if (!bubbleText) continue;

      const savedMsg = await SupportChat.create({
        userId,
        role: "assistant",
        message: bubbleText,
        createdAt: new Date(baseTime + i * 200),
      });

      savedAssistantMessages.push(savedMsg);
    }

    return res.status(200).json({
      success: true,
      userMessage,
      assistantMessage: savedAssistantMessages[0],
      assistantMessages: savedAssistantMessages,
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
