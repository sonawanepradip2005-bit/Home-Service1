const express = require("express");
const router = express.Router();

const {
    createOrder,
    verifyPayment,
    getUserOrders,
    getOrderById
} = require("../controller/ordercontroller");

router.post("/createOrder", createOrder);
router.post("/verifyPayment", verifyPayment);
router.get("/getUserOrders/:userId", getUserOrders);
router.get("/getOrderById/:id", getOrderById);

module.exports = router;
