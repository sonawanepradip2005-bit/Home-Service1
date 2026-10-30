const mongoose = require("mongoose");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const OrderServi = require("../models/ordersServicemodel");

const HOUSE_PRICE_DEFAULT = 1000;
const WORKER_PRICE_DEFAULT = 400;
const WORKING_HOUR_PRICE_DEFAULT = 500;
const SERVICE_CHARGE_DEFAULT = 100;
const DISCOUNT_AMOUNT_DEFAULT = 0;

const getRazorpayInstance = () => {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        return new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }
    return null;
};

const getNumber = (value, fallback) => {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

// CREATE SERVICE ORDER (Cleaning, Painting, Vehicle, Labour, etc.)
exports.createOrderservice = async (req, res) => {
    try {
        const {
            userId,
            serviceType,
            bookingType = "home",
            pickupLocation,
            dropLocation,
            scheduleDate,
            scheduleTime,
            houseSize: bodyHouseSize,
            customHouseSize: bodyCustomHouseSize,
            houseDetails = {},
            price: bodyPrice,
            vehicle: bodyVehicle,
            workingtime,
            selectedColor,
            floorSize,
            industryType,
            notes,
            workerDetails = {},
            workingHoursDetails = {},
            serviceCharge,
            discountAmount,
            promoCode = "",
            payment
        } = req.body;

        // Validate user ID
        if (!userId || !mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid userId is required."
            });
        }

        // Validate locations
        const pickupAddr = pickupLocation?.address || req.body.pickupAddress || "";
        const dropAddr = dropLocation?.address || req.body.dropAddress || "";

        if (!pickupAddr.trim() || !dropAddr.trim()) {
            return res.status(400).json({
                success: false,
                message: "Pickup and drop locations are required."
            });
        }

        const pickupLatitude = pickupLocation?.latitude ?? req.body.pickupLatitude ?? null;
        const pickupLongitude = pickupLocation?.longitude ?? req.body.pickupLongitude ?? null;
        const dropLatitude = dropLocation?.latitude ?? req.body.dropLatitude ?? null;
        const dropLongitude = dropLocation?.longitude ?? req.body.dropLongitude ?? null;

        const resolvedPickupLocation = {
            address: pickupAddr.trim(),
            latitude: pickupLatitude !== null && Number.isFinite(Number(pickupLatitude)) ? Number(pickupLatitude) : null,
            longitude: pickupLongitude !== null && Number.isFinite(Number(pickupLongitude)) ? Number(pickupLongitude) : null
        };

        const resolvedDropLocation = {
            address: dropAddr.trim(),
            latitude: dropLatitude !== null && Number.isFinite(Number(dropLatitude)) ? Number(dropLatitude) : null,
            longitude: dropLongitude !== null && Number.isFinite(Number(dropLongitude)) ? Number(dropLongitude) : null
        };

        // Validate Schedule
        if (!scheduleDate || !String(scheduleTime || "").trim()) {
            return res.status(400).json({
                success: false,
                message: "Schedule date and time are required."
            });
        }

        const parsedDate = new Date(scheduleDate);
        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid schedule date."
            });
        }

        // Detect or normalize service & booking type
        let resolvedBookingType = String(bookingType || "home").toLowerCase().trim();
        if (resolvedBookingType === "commerical") resolvedBookingType = "commercial";
        if (!["home", "office", "commercial", "service"].includes(resolvedBookingType)) {
            resolvedBookingType = "home";
        }

        const resolvedVehicle = String(
            bodyVehicle ||
            houseDetails?.vehicle ||
            req.body.vehicleType ||
            ""
        ).trim();

        const resolvedServiceType = String(
            serviceType ||
            req.body.service ||
            (resolvedVehicle ? "vehicle" : selectedColor || workingtime ? "painting" : "cleaning")
        ).trim();

        // House / Service size details
        const houseSize = String(
            bodyHouseSize ||
            houseDetails?.houseSize ||
            req.body.selectedHouse ||
            resolvedVehicle ||
            "Standard Service"
        ).trim();

        const customHouseSize = String(
            bodyCustomHouseSize ||
            houseDetails?.customHouseSize ||
            req.body.customVehicleSize ||
            ""
        ).trim();

        const price = Math.max(
            0,
            getNumber(bodyPrice ?? houseDetails?.price, HOUSE_PRICE_DEFAULT)
        );

        // Workers Count & Price
        const workers = Math.max(
            0,
            getNumber(workerDetails?.workers ?? workerDetails?.workerCount ?? req.body.workers, 0)
        );

        const workerPrice = Math.max(
            0,
            getNumber(workerDetails?.workerPrice ?? req.body.workerPrice, WORKER_PRICE_DEFAULT)
        );

        const workerTotal = workers * workerPrice;

        // Working Hours & Price
        const workingHourse = Math.max(
            0,
            getNumber(
                workingHoursDetails?.workingHourse ??
                workingHoursDetails?.workingHours ??
                workingHoursDetails?.workingHoursCount ??
                req.body.workingHourse ??
                req.body.workingHours,
                0
            )
        );

        const workingHoursePrice = Math.max(
            0,
            getNumber(
                workingHoursDetails?.workingHoursePrice ??
                workingHoursDetails?.workingHoursPrice ??
                req.body.workingHoursePrice ??
                req.body.workingHoursPrice,
                WORKING_HOUR_PRICE_DEFAULT
            )
        );

        const workingHoursTotal = workingHourse * workingHoursePrice;

        // Service charge and discount
        const service = Math.max(
            0,
            getNumber(serviceCharge ?? req.body.serviceCharge, SERVICE_CHARGE_DEFAULT)
        );

        const requestedDiscount = Math.max(
            0,
            getNumber(discountAmount ?? req.body.discountAmount, DISCOUNT_AMOUNT_DEFAULT)
        );

        const subtotal = price + workerTotal + workingHoursTotal + service;
        const discount = Math.min(subtotal, requestedDiscount);
        const totalAmount = Number((subtotal - discount).toFixed(2));

        // Payment method
        const paymentMethod = payment?.method || req.body.paymentMethod || "Cash";
        if (!["Cash", "Online Payment"].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Select Cash or Online Payment."
            });
        }

        // Prepare database order
        const orderData = {
            userId,
            serviceType: resolvedServiceType,
            bookingType: resolvedBookingType,

            houseSize,
            customHouseSize,
            price,

            vehicle: resolvedVehicle,
            workingtime: String(workingtime || req.body.workingTime || "").trim(),
            selectedColor: String(selectedColor || "").trim(),
            floorSize: String(floorSize || "").trim(),
            industryType: String(industryType || "").trim(),
            notes: String(notes || "").trim(),

            pickupLocation: resolvedPickupLocation,
            dropLocation: resolvedDropLocation,

            scheduleDate: parsedDate,
            scheduleTime: String(scheduleTime).trim(),

            workerDetails: {
                workers,
                workerPrice,
                totalPrice: workerTotal
            },

            workingHoursDetails: {
                workingHourse,
                workingHoursePrice,
                totalPrice: workingHoursTotal
            },

            serviceCharge: service,
            discountAmount: discount,
            promoCode: String(promoCode || ""),
            totalAmount,

            payment: {
                method: paymentMethod,
                status: "pending"
            },

            orderStatus: "pending"
        };

        // CASH PAYMENT
        if (paymentMethod === "Cash") {
            const order = await OrderServi.create(orderData);

            return res.status(201).json({
                success: true,
                message: "Service order created successfully with Cash payment.",
                order
            });
        }

        // RAZORPAY ONLINE PAYMENT
        const razorpay = getRazorpayInstance();
        if (!razorpay) {
            return res.status(500).json({
                success: false,
                message: "Razorpay configuration is missing on server."
            });
        }

        if (totalAmount < 1) {
            return res.status(400).json({
                success: false,
                message: "Online payment must be at least ₹1."
            });
        }

        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(totalAmount * 100),
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        });

        orderData.razorpayOrderId = razorpayOrder.id;

        const order = await OrderServi.create(orderData);

        return res.status(201).json({
            success: true,
            message: "Order created. Complete your payment.",
            order,
            razorpay: {
                keyId: process.env.RAZORPAY_KEY_ID,
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency
            }
        });
    } catch (error) {
        console.error("Create Service Order Error:", error);

        return res.status(400).json({
            success: false,
            message: "Unable to create service order.",
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

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        const received = Buffer.from(razorpay_signature, "hex");
        const expected = Buffer.from(expectedSignature, "hex");

        if (
            received.length !== expected.length ||
            !crypto.timingSafeEqual(received, expected)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature."
            });
        }

        const razorpay = getRazorpayInstance();
        if (razorpay) {
            const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
            if (
                paymentDetails.order_id !== razorpay_order_id ||
                paymentDetails.status !== "captured"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Payment has not been captured yet."
                });
            }
        }

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

// GET USER SERVICE ORDERS
exports.getUserOrdersService = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId || !mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid userId is required."
            });
        }

        const orders = await OrderServi.find({ userId }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error) {
        console.error("Get User Service Orders Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch service orders.",
            error: error.message
        });
    }
};

// GET SINGLE SERVICE ORDER BY ID
exports.getOrderServiceById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || !mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid order ID is required."
            });
        }

        const order = await OrderServi.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Service order not found."
            });
        }

        return res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        console.error("Get Service Order Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch service order.",
            error: error.message
        });
    }
};
