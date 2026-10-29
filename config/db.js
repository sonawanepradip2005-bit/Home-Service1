
require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

async function con() {
    try {
        if (!MONGO_URI) {
            throw new Error("MONGO_URI is missing in .env file");
        }

        await mongoose.connect(MONGO_URI);
        console.log("MongoDB Connected Successfully");
    } catch (err) {
        console.error("MongoDB Connection Error:", err.message);
        process.exit(1);
    }
}

const db = mongoose.connection;

db.on("error", (err) => {
    console.log("MongoDB Error:", err.message);
});

db.on("disconnected", () => {
    console.log("Mongoose Connection Lost");
});

module.exports = con;
