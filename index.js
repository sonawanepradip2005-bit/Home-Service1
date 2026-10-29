require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createServer } = require("http");
const express = require("express");
const cors = require("cors");
const con = require("./config/db");

const userroutes = require("./routes/userroutes");
const orderRoutes = require("./routes/orderroutes");
const orderServiceRoutes = require("./routes/orderserviceroutes");

const app = express();
const server = createServer(app);

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// CORS Configuration
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((url) => url.trim())
    : "*";

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadsDir));

// Health check endpoints
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Home Service API is running"
    });
});

app.get("/check", (req, res) => {
    res.json({
        success: true,
        message: "API is working properly"
    });
});

// Application Routes
app.use(userroutes);
app.use(orderRoutes);
app.use(orderServiceRoutes);

// Server Listen on Dynamic Port
const PORT = process.env.PORT || 4000;

con()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error("Failed to start server due to DB connection error:", err.message);
    });
