const mongoose = require("mongoose");

const houseDetailsSchema = new mongoose.Schema(
    {
        houseSize: {
            type: String,
            required: true,
            trim: true
        },
        customHouseSize: { type: String, default: "" },
        price: { type: Number, required: true, min: 0 }
    },
    { _id: false }
);

const officeDetailsSchema = new mongoose.Schema(
    {
        officeSize: { type: String, required: true, trim: true },
        floorSize: { type: String, default: "" },
        industryType: { type: String, default: "" },
        notes: { type: String, default: "" },
        price: { type: Number, required: true, min: 0 }
    },
    { _id: false }
);

const commercialDetailsSchema = new mongoose.Schema(
    {
        commercialSize: { type: String, default: "", trim: true },
        floorSize: { type: String, default: "" },
        industryType: { type: String, default: "" },
        notes: { type: String, default: "" },
        price: { type: Number, required: true, min: 0 }
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
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

        houseDetails: {
            type: houseDetailsSchema,
            default: undefined
        },

        officeDetails: {
            type: officeDetailsSchema,
            default: undefined
        },

        commercialDetails: {
            type: commercialDetailsSchema,
            default: undefined
        },

        furnitureDetails: {
            furniture: {
                type: [
                    {
                        name: { type: String, required: true, trim: true },
                        quantity: { type: Number, default: 1, min: 0 },
                        price: { type: Number, required: true, min: 0 }
                    }
                ],
                default: []
            },
            packedBoxes: { type: Number, default: 0, min: 0 },
            boxPrice: { type: Number, default: 0, min: 0 },
            totalPrice: { type: Number, default: 0, min: 0 }
        },

        workerDetails: {
            workers: { type: Number, default: 0, min: 0 },
            electricians: { type: Number, default: 0, min: 0 },
            workerPrice: { type: Number, default: 0, min: 0 },
            electricianPrice: { type: Number, default: 0, min: 0 },
            totalPrice: { type: Number, default: 0, min: 0 }
        },

        vehicle: {
            vehicleType: { type: String, required: true, trim: true },
            price: { type: Number, default: 0, min: 0 }
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

module.exports = mongoose.model("Order", orderSchema);
