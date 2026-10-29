
const mongoose = require("mongoose");

const orderServiceSchema = new mongoose.Schema(
    {
        houseSize: {
            type: String,
            enum: [
                "2 Bedrooms 1 Kitchen",
                "3 Bedrooms 1 Kitchen",
                "4 Bedrooms 1 Kitchen",
                "Custom"
            ],
            required: false
        },
        customHouseSize: { type: String, default: "" },
        price: { type: Number, required: true, min: 0 },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        bookingType: {
            type: String,
            enum: ["home", "office", "commercial"],
            default: "home",
            required: true
        },

        pickupLocation: {
            address: { type: String, required: true, trim: true },
            latitude: { type: Number, default: null },
            longitude: { type: Number, default: null }
        },

        dropLocation: {
            address: { type: String, required: true, trim: true },
            latitude: { type: Number, default: null },
            longitude: { type: Number, default: null }
        },

        scheduleDate: {
            type: Date,
            required: true
        },

        scheduleTime: {
            type: String,
            required: true,
            trim: true
        },

        workerDetails: {
            workers: { type: Number, default: 0, min: 0 },
            workerPrice: { type: Number, default: 0, min: 0 },
            totalPrice: { type: Number, default: 0, min: 0 }
        },
        
        workingHoursDetails : {
            workingHourse : {type : Number,default : 0,min : 0},
            workingHoursePrice : { type : Number, default : 0, min : 0}
        },
        serviceCharge: { type: Number, default: 0, min: 0 },
        discountAmount: { type: Number, default: 0, min: 0 },
        promoCode: { type: String, default: "" },

        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },

        payment: {
            method: {
                type: String,
                enum: ["Online Payment", "Cash"],
                required: true
            },
            status: {
                type: String,
                enum: ["pending", "paid", "failed", "refunded"],
                default: "pending"
            }
        },

        orderStatus: {
            type: String,
            enum: [
                "pending",
                "confirmed",
                "in-progress",
                "completed",
                "cancelled"
            ],
            default: "pending"
        },

        razorpayOrderId: { type: String, default: null },
        razorpayPaymentId: { type: String, default: null }
    },
    { timestamps: true }
);

module.exports = mongoose.model("OrderServi", orderServiceSchema);
