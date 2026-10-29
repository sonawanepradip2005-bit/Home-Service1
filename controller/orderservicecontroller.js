
const mongoose = require("mongoose");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const OrderServi = require("../models/ordersServicemodel");

const HOUSE_PRICE_DEFAULT = 1000;
const WORKER_PRICE_DEFAULT = 400;
const WORKING_HOUR_PRICE_DEFAULT = 500;
const SERVICE_CHARGE_DEFAULT = 100;
const DISCOUNT_AMOUNT_DEFAULT = 0;

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const VALID_HOUSE_SIZES = [
    "2 Bedrooms 1 Kitchen",
    "3 Bedrooms 1 Kitchen",
    "4 Bedrooms 1 Kitchen",
    "Custom"
];

const getNumber = (value, fallback) => {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    return Number(value);
};

// CREATE HOME SHIFTING ORDER
exports.createOrderservice = async (req, res) => {
    try {
        const {
            userId,
            pickupLocation,
            dropLocation,
            scheduleDate,
            scheduleTime,
            houseSize: bodyHouseSize,
            customHouseSize: bodyCustomHouseSize,
            houseDetails = {},
            price: bodyPrice,
            workerDetails = {},
            workingHoursDetails = {},
            serviceCharge,
            discountAmount,
            promoCode = "",
            payment
        } = req.body;

        // Validate user ID
        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid userId is required."
            });
        }

        // Validate locations and schedule
        if (
            !pickupLocation?.address?.trim() ||
            !dropLocation?.address?.trim() ||
            !scheduleDate ||
            !String(scheduleTime || "").trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Pickup, drop and schedule details are required."
            });
        }

        // Validate coordinates
        const coordinates = [
            pickupLocation.latitude,
            pickupLocation.longitude,
            dropLocation.latitude,
            dropLocation.longitude
        ];

        if (
            coordinates.some(
                value =>
                    value === null ||
                    value === undefined ||
                    value === "" ||
                    !Number.isFinite(Number(value))
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid pickup and drop coordinates are required."
            });
        }

        // House details
        const houseSize = String(
            bodyHouseSize ?? houseDetails.houseSize ?? ""
        ).trim();

        const customHouseSize = String(
            bodyCustomHouseSize ??
            houseDetails.customHouseSize ??
            ""
        ).trim();

        const price = getNumber(
            bodyPrice ?? houseDetails.price,
            HOUSE_PRICE_DEFAULT
        );

        if (!VALID_HOUSE_SIZES.includes(houseSize)) {
            return res.status(400).json({
                success: false,
                message: "Please select a valid house size."
            });
        }

        if (
            houseSize === "Custom" &&
            !customHouseSize
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter custom house size."
            });
        }

        if (!Number.isFinite(price) || price < 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid house price."
            });
        }

        // Payment method
        if (
            !payment?.method ||
            !["Cash", "Online Payment"].includes(payment.method)
        ) {
            return res.status(400).json({
                success: false,
                message: "Select Cash or Online Payment."
            });
        }

        // Schedule date
        const parsedDate = new Date(scheduleDate);

        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid schedule date."
            });
        }

        // WORKERS COUNT
        const workers = getNumber(
            workerDetails.workers ??
            workerDetails.workerCount,
            0
        );

        const workerPrice = getNumber(
            workerDetails.workerPrice,
            WORKER_PRICE_DEFAULT
        );

        if (
            !Number.isInteger(workers) ||
            workers < 0 ||
            workers > 30 ||
            !Number.isFinite(workerPrice) ||
            workerPrice < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid workers count or price."
            });
        }

        const workerTotal = workers * workerPrice;

        // WORKING HOURS COUNT
        const workingHourse = getNumber(
            workingHoursDetails.workingHourse ??
            workingHoursDetails.workingHours ??
            workingHoursDetails.workingHoursCount,
            0
        );

        const workingHoursePrice = getNumber(
            workingHoursDetails.workingHoursePrice ??
            workingHoursDetails.workingHoursPrice,
            WORKING_HOUR_PRICE_DEFAULT
        );

        if (
            !Number.isInteger(workingHourse) ||
            workingHourse < 0 ||
            workingHourse > 24 ||
            !Number.isFinite(workingHoursePrice) ||
            workingHoursePrice < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid working hours count or price."
            });
        }

        const workingHoursTotal =
            workingHourse * workingHoursePrice;

        // Service charge and discount
        const service = getNumber(
            serviceCharge,
            SERVICE_CHARGE_DEFAULT
        );

        const requestedDiscount = getNumber(
            discountAmount,
            DISCOUNT_AMOUNT_DEFAULT
        );

        if (
            !Number.isFinite(service) ||
            service < 0 ||
            !Number.isFinite(requestedDiscount) ||
            requestedDiscount < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid service charge or discount."
            });
        }

        const subtotal =
            price +
            workerTotal +
            workingHoursTotal +
            service;

        const discount = Math.min(
            subtotal,
            requestedDiscount
        );

        const totalAmount = Number(
            (subtotal - discount).toFixed(2)
        );

        // Prepare database order
        const orderData = {
            userId,
            bookingType: "home",

            houseSize,
            customHouseSize:
                houseSize === "Custom"
                    ? customHouseSize
                    : "",

            price,

            pickupLocation: {
                address: pickupLocation.address.trim(),
                latitude: Number(pickupLocation.latitude),
                longitude: Number(pickupLocation.longitude)
            },

            dropLocation: {
                address: dropLocation.address.trim(),
                latitude: Number(dropLocation.latitude),
                longitude: Number(dropLocation.longitude)
            },

            scheduleDate: parsedDate,
            scheduleTime: String(scheduleTime).trim(),

            workerDetails: {
                workers,
                workerPrice,
                totalPrice: workerTotal
            },

            workingHoursDetails: {
                workingHourse,
                workingHoursePrice
            },

            serviceCharge: service,
            discountAmount: discount,
            promoCode: String(promoCode || ""),
            totalAmount,

            payment: {
                method: payment.method,
                status: "pending"
            }
        };

        // CASH PAYMENT
        if (payment.method === "Cash") {
            const order = await OrderServi.create(orderData);

            return res.status(201).json({
                success: true,
                message: "Home shifting order created successfully.",
                order: {
                    _id: order._id,
                    totalAmount: order.totalAmount,
                    payment: order.payment,
                    workerDetails: order.workerDetails,
                    workingHoursDetails: order.workingHoursDetails
                }
            });
        }

        // RAZORPAY CONFIGURATION
        if (
            !process.env.RAZORPAY_KEY_ID ||
            !process.env.RAZORPAY_KEY_SECRET
        ) {
            return res.status(500).json({
                success: false,
                message: "Razorpay configuration is missing."
            });
        }

        if (totalAmount < 1) {
            return res.status(400).json({
                success: false,
                message: "Online payment must be at least ₹1."
            });
        }

        // CREATE RAZORPAY ORDER
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(totalAmount * 100),
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        });

        orderData.razorpayOrderId = razorpayOrder.id;

        // Save order in MongoDB
        const order = await OrderServi.create(orderData);

        return res.status(201).json({
            success: true,
            message: "Order created. Complete your payment.",
            order: {
                _id: order._id,
                totalAmount: order.totalAmount,
                payment: order.payment,
                workerDetails: order.workerDetails,
                workingHoursDetails: order.workingHoursDetails
            },
            razorpay: {
                keyId: process.env.RAZORPAY_KEY_ID,
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency
            }
        });

    } catch (error) {
        console.error("Create Order Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create home shifting order.",
            error: error.message,
            details: error.errors
                ? Object.values(error.errors).map(item => ({
                    field: item.path,
                    message: item.message
                }))
                : undefined
        });
    }
};


// VERIFY RAZORPAY PAYMENT
exports.verifyPaymentservice = async (req, res) => {
    try {
        const {
            orderId,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature
        } = req.body;

        if (
            !orderId ||
            !razorpay_payment_id ||
            !razorpay_order_id ||
            !razorpay_signature
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment verification details are missing."
            });
        }

        if (!mongoose.isValidObjectId(orderId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        const order = await OrderServi.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        if (order.payment.status === "paid") {
            return res.status(200).json({
                success: true,
                message: "Payment already verified.",
                order
            });
        }

        if (
            !order.razorpayOrderId ||
            order.razorpayOrderId !== razorpay_order_id
        ) {
            return res.status(400).json({
                success: false,
                message: "Razorpay order ID does not match."
            });
        }

        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Razorpay configuration is missing."
            });
        }

        // Verify Razorpay signature
        const expectedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(
                `${razorpay_order_id}|${razorpay_payment_id}`
            )
            .digest("hex");

        const received = Buffer.from(
            razorpay_signature,
            "hex"
        );

        const expected = Buffer.from(
            expectedSignature,
            "hex"
        );

        if (
            received.length !== expected.length ||
            !crypto.timingSafeEqual(received, expected)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature."
            });
        }

        // Fetch payment from Razorpay
        const paymentDetails = await razorpay.payments.fetch(
            razorpay_payment_id
        );

        if (
            paymentDetails.order_id !== razorpay_order_id
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment order ID does not match."
            });
        }

        if (paymentDetails.status !== "captured") {
            return res.status(400).json({
                success: false,
                message: "Payment has not been captured yet."
            });
        }

        // Verify amount and currency
        if (
            Number(paymentDetails.amount) !==
            Math.round(Number(order.totalAmount) * 100)
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment amount does not match the order."
            });
        }

        if (paymentDetails.currency !== "INR") {
            return res.status(400).json({
                success: false,
                message: "Payment currency does not match."
            });
        }

        // Update payment status
        order.payment.status = "paid";
        order.razorpayPaymentId = razorpay_payment_id;
        order.orderStatus = "confirmed";

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully.",
            order
        });

    } catch (error) {
        console.error("Verify Payment Error:", error);

        return res.status(500).json({
            success: false,
            message: "Payment verification failed.",
            error: error.message
        });
    }
};
