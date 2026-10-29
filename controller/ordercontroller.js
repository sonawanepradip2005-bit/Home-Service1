
const mongoose = require("mongoose");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/ordermodel");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.createOrder = async (req, res) => {
    try {
        const {
            userId,
            bookingType ,
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

        const type = String(bookingType).toLowerCase().trim();

        if (!["home", "office", "commercial"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking type."
            });
        }

        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Valid userId is required."
            });
        }

        if (
            !pickupLocation?.address?.trim() ||
            !dropLocation?.address?.trim() ||
            !scheduleDate ||
            !scheduleTime ||
            !vehicle?.vehicleType?.trim() ||
            !payment?.method
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required order details."
            });
        }

        const parsedDate = new Date(scheduleDate);

        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid schedule date."
            });
        }

        if (!["Cash", "Online Payment"].includes(payment.method)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment method."
            });
        }

        let categoryDetails;
        let categoryPrice;

        if (type === "home") {
            const validHouseSizes = [
                "2 Bedrooms 1 Kitchen",
                "3 Bedrooms 1 Kitchen",
                "4 Bedrooms 1 Kitchen",
                "Custom"
            ];

            const houseSize = String(
                houseDetails?.houseSize || ""
            ).trim();

            // if (!validHouseSizes.includes(houseSize)) {
            //     return res.status(400).json({
            //         success: false,
            //         message: "Please select a valid house size.",
            //         error: `Invalid house size: ${houseSize || "Not selected"}`
            //     });
            // }

            categoryPrice = Number(houseDetails.price);

            if (!Number.isFinite(categoryPrice) || categoryPrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid home price."
                });
            }

            categoryDetails = {
                houseDetails: {
                    houseSize,
                    customHouseSize:
                        houseSize === "Custom"
                            ? String(houseDetails.customHouseSize || "")
                            : "",
                    price: categoryPrice
                }
            };
        } else if (type === "office") {
            const officeSize = String(
                officeDetails?.officeSize || ""
            ).trim();

            if (!officeSize || officeDetails.price == null) {
                return res.status(400).json({
                    success: false,
                    message: "Office size and price are required."
                });
            }

            categoryPrice = Number(officeDetails.price);

            if (!Number.isFinite(categoryPrice) || categoryPrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid office price."
                });
            }

            categoryDetails = {
                officeDetails: {
                    officeSize,
                    floorSize: officeDetails.floorSize || "",
                    industryType: officeDetails.industryType || "",
                    notes: officeDetails.notes || "",
                    price: categoryPrice
                }
            };
        } else {
            const commercialSize = String(
                commercialDetails?.commercialSize || ""
            ).trim();

            if (!commercialSize || commercialDetails.price == null) {
                return res.status(400).json({
                    success: false,
                    message: "Commercial size and price are required."
                });
            }

            categoryPrice = Number(commercialDetails.price);

            if (!Number.isFinite(categoryPrice) || categoryPrice < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid commercial price."
                });
            }

            categoryDetails = {
                commercialDetails: {
                    commercialSize,
                    floorSize: commercialDetails.floorSize || "",
                    industryType: commercialDetails.industryType || "",
                    notes: commercialDetails.notes || "",
                    price: categoryPrice
                }
            };
        }

        const furniture = Array.isArray(furnitureDetails.furniture)
            ? furnitureDetails.furniture
                .filter(item => item?.name?.trim())
                .map(item => ({
                    name: item.name.trim(),
                    quantity: Math.max(1, Number(item.quantity) || 1),
                    price: Math.max(0, Number(item.price) || 0)
                }))
            : [];

        const packedBoxes = Math.max(
            0,
            Number(furnitureDetails.packedBoxes) || 0
        );

        const boxPrice = Math.max(
            0,
            Number(furnitureDetails.boxPrice) || 0
        );

        const furnitureTotal = furniture.reduce(
            (sum, item) => sum + item.quantity * item.price,
            0
        );

        const boxTotal = packedBoxes * boxPrice;

        const workers = Math.max(0, Number(workerDetails.workers) || 0);
        const electricians = Math.max(
            0,
            Number(workerDetails.electricians) || 0
        );

        const workerPrice = Math.max(
            0,
            Number(workerDetails.workerPrice) || 0
        );

        const electricianPrice = Math.max(
            0,
            Number(workerDetails.electricianPrice) || 0
        );

        const workerTotal = workers * workerPrice;
        const electricianTotal = electricians * electricianPrice;

        const vehiclePrice = Math.max(0, Number(vehicle.price) || 0);
        const service = Math.max(0, Number(serviceCharge) || 0);

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
            Math.max(0, Number(discountAmount) || 0)
        );

        const totalAmount = Math.max(0, subtotal - discount);

        const orderData = {
            userId,
            bookingType: type,
            pickupLocation,
            dropLocation,
            scheduleDate: parsedDate,
            scheduleTime,
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
                vehicleType: vehicle.vehicleType.trim(),
                price: vehiclePrice
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

        if (payment.method === "Cash") {
            const order = await Order.create(orderData);

            return res.status(201).json({
                success: true,
                message: "Order created successfully.",
                order
            });
        }

        if (
            !process.env.RAZORPAY_KEY_ID ||
            !process.env.RAZORPAY_KEY_SECRET
        ) {
            return res.status(500).json({
                success: false,
                message: "Razorpay configuration is missing."
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
        console.error("Create Order Error:", error);

        return res.status(400).json({
            success: false,
            message: "Invalid order details.",
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

        const paymentDetails = await razorpay.payments.fetch(
            razorpay_payment_id
        );

        if (
            paymentDetails.order_id !== razorpay_order_id ||
            paymentDetails.status !== "captured"
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment has not been captured."
            });
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
