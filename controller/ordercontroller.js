const mongoose = require("mongoose");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/ordermodel");

const getRazorpayInstance = () => {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        return new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
    }
    return null;
};

// CREATE SHIFTING ORDER (Home, Office, Commercial)
exports.createOrder = async (req, res) => {
    try {
        const {
            userId,
            bookingType,
            pickupLocation,
            dropLocation,
            scheduleDate,
            scheduleTime,
            houseDetails,
            officeDetails,
            commercialDetails,
            furnitureDetails = {},
            workerDetails = {},
            vehicle,
            serviceCharge = 0,
            discountAmount = 0,
            promoCode = "",
            payment
        } = req.body;

        // Normalize booking type
        let type = String(bookingType || "").toLowerCase().trim();
        if (type === "commerical" || type === "industry") {
            type = "commercial";
        }

        if (!["home", "office", "commercial"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking type. Must be home, office, or commercial."
            });
        }

        // Validate User ID
        if (!userId || !mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid userId is required."
            });
        }

        // Validate Locations
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
        if (!scheduleDate || !scheduleTime) {
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

        // Validate Payment Method
        const paymentMethod = payment?.method || req.body.paymentMethod || "Cash";
        if (!["Cash", "Online Payment"].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Payment method must be Cash or Online Payment."
            });
        }

        // Category Details Processing
        let categoryDetails = {};
        let categoryPrice = 1000;

        if (type === "home") {
            const houseSize = String(
                houseDetails?.houseSize || req.body.houseSize || req.body.selectedHouse || ""
            ).trim();

            if (!houseSize) {
                return res.status(400).json({
                    success: false,
                    message: "House size is required for home shifting."
                });
            }

            const customHouseSize = String(
                houseDetails?.customHouseSize || req.body.customHouseSize || ""
            ).trim();

            const parsedPrice = Number(houseDetails?.price ?? req.body.price ?? 1000);
            categoryPrice = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 1000;

            categoryDetails = {
                houseDetails: {
                    houseSize,
                    customHouseSize: houseSize === "Custom" ? customHouseSize : "",
                    price: categoryPrice
                }
            };
        } else if (type === "office") {
            const officeSize = String(
                officeDetails?.officeSize ||
                req.body.officeSize ||
                houseDetails?.houseSize ||
                req.body.selectedHouse ||
                "Office Shifting"
            ).trim();

            const floorSize = String(officeDetails?.floorSize || req.body.floorSize || "").trim();
            const industryType = String(officeDetails?.industryType || req.body.industryType || "").trim();
            const notes = String(officeDetails?.notes || req.body.notes || "").trim();

            const parsedPrice = Number(officeDetails?.price ?? req.body.price ?? 1000);
            categoryPrice = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 1000;

            categoryDetails = {
                officeDetails: {
                    officeSize: officeSize || "Office Shifting",
                    floorSize,
                    industryType,
                    notes,
                    price: categoryPrice
                }
            };
        } else if (type === "commercial") {
            const floorSize = String(commercialDetails?.floorSize || req.body.floorSize || "").trim();
            const industryType = String(commercialDetails?.industryType || req.body.industryType || "").trim();
            const notes = String(commercialDetails?.notes || req.body.notes || "").trim();

            const commercialSize = String(
                commercialDetails?.commercialSize ||
                req.body.commercialSize ||
                (industryType && floorSize ? `${industryType} (${floorSize})` : industryType || floorSize) ||
                houseDetails?.houseSize ||
                req.body.selectedHouse ||
                "Commercial Shifting"
            ).trim();

            const parsedPrice = Number(commercialDetails?.price ?? req.body.price ?? 1000);
            categoryPrice = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 1000;

            categoryDetails = {
                commercialDetails: {
                    commercialSize: commercialSize || "Commercial Shifting",
                    floorSize,
                    industryType,
                    notes,
                    price: categoryPrice
                }
            };
        }

        // Furniture Details
        const rawFurniture = Array.isArray(furnitureDetails.furniture)
            ? furnitureDetails.furniture
            : typeof req.body.furniture === "string"
                ? (() => {
                    try {
                        const parsed = JSON.parse(req.body.furniture);
                        if (Array.isArray(parsed)) return parsed;
                        if (parsed && typeof parsed === "object") {
                            return Object.entries(parsed).map(([name, qty]) => ({
                                name,
                                quantity: Number(qty) || 1,
                                price: 500
                            }));
                        }
                    } catch {
                        return [];
                    }
                    return [];
                })()
                : [];

        const furniture = rawFurniture
            .filter(item => item && (item.name || item.quantity))
            .map(item => ({
                name: String(item.name || "Furniture").trim(),
                quantity: Math.max(0, Number(item.quantity) || 1),
                price: Math.max(0, Number(item.price) || 500)
            }));

        const packedBoxes = Math.max(
            0,
            Number(furnitureDetails.packedBoxes ?? req.body.packedBoxes ?? req.body.boxes) || 0
        );

        const boxPrice = Math.max(
            0,
            Number(furnitureDetails.boxPrice ?? req.body.boxPrice) || 50
        );

        const furnitureTotal = furniture.reduce(
            (sum, item) => sum + item.quantity * item.price,
            0
        );

        const boxTotal = packedBoxes * boxPrice;

        // Workers Details
        const workers = Math.max(
            0,
            Number(workerDetails.workers ?? req.body.workers) || 0
        );

        const electricians = Math.max(
            0,
            Number(workerDetails.electricians ?? req.body.electrician ?? req.body.electricians) || 0
        );

        const workerPrice = Math.max(
            0,
            Number(workerDetails.workerPrice ?? req.body.workerPrice) || 400
        );

        const electricianPrice = Math.max(
            0,
            Number(workerDetails.electricianPrice ?? req.body.electricianPrice) || 600
        );

        const workerTotal = workers * workerPrice;
        const electricianTotal = electricians * electricianPrice;

        // Vehicle Details
        const vehicleType = typeof vehicle === "string"
            ? vehicle.trim()
            : vehicle?.vehicleType?.trim() || req.body.vehicleType || "Standard Vehicle";

        const vehiclePrice = Math.max(
            0,
            Number(vehicle?.price ?? req.body.vehiclePrice) || 1200
        );

        const service = Math.max(
            0,
            Number(serviceCharge ?? req.body.serviceCharge) || 100
        );

        // Subtotal and Total Amount
        const subtotal =
            categoryPrice +
            furnitureTotal +
            boxTotal +
            workerTotal +
            electricianTotal +
            vehiclePrice +
            service;

        const discount = Math.min(
            subtotal,
            Math.max(0, Number(discountAmount ?? req.body.discountAmount) || 0)
        );

        const totalAmount = Math.max(0, subtotal - discount);

        // Prepare Database Object
        const orderData = {
            userId,
            bookingType: type,
            pickupLocation: resolvedPickupLocation,
            dropLocation: resolvedDropLocation,
            scheduleDate: parsedDate,
            scheduleTime: String(scheduleTime).trim(),
            ...categoryDetails,

            furnitureDetails: {
                furniture,
                packedBoxes,
                boxPrice,
                totalPrice: furnitureTotal + boxTotal
            },

            workerDetails: {
                workers,
                electricians,
                workerPrice,
                electricianPrice,
                totalPrice: workerTotal + electricianTotal
            },

            vehicle: {
                vehicleType,
                price: vehiclePrice
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

        // CASH ON DELIVERY / CASH
        if (paymentMethod === "Cash") {
            const order = await Order.create(orderData);

            return res.status(201).json({
                success: true,
                message: "Order created successfully with Cash payment.",
                order
            });
        }

        // ONLINE PAYMENT VIA RAZORPAY
        const razorpay = getRazorpayInstance();
        if (!razorpay) {
            return res.status(500).json({
                success: false,
                message: "Razorpay credentials are not configured on the server."
            });
        }

        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(totalAmount * 100),
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        });

        orderData.razorpayOrderId = razorpayOrder.id;

        const order = await Order.create(orderData);

        return res.status(201).json({
            success: true,
            message: "Order created. Please complete your online payment.",
            order,
            razorpay: {
                keyId: process.env.RAZORPAY_KEY_ID,
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency
            }
        });
    } catch (error) {
        console.error("Create Order Error:", error);

        return res.status(400).json({
            success: false,
            message: "Unable to create order.",
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
exports.verifyPayment = async (req, res) => {
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

        const order = await Order.findById(orderId);

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

        if (order.razorpayOrderId !== razorpay_order_id) {
            return res.status(400).json({
                success: false,
                message: "Razorpay order ID does not match."
            });
        }

        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Razorpay secret key is missing."
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

// GET USER ORDERS (History)
exports.getUserOrders = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId || !mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid userId is required."
            });
        }

        const orders = await Order.find({ userId }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error) {
        console.error("Get User Orders Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch orders.",
            error: error.message
        });
    }
};

// GET SINGLE ORDER BY ID
exports.getOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || !mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid order ID is required."
            });
        }

        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        return res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        console.error("Get Order Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch order.",
            error: error.message
        });
    }
};
