const express = require("express");
const router = express.Router();

const {
    verifyPaymentservice,
    createOrderservice,
    getUserOrdersService,
    getOrderServiceById
} = require("../controller/orderservicecontroller");

router.post("/createOrderservice", createOrderservice);
router.post("/verifyPaymentservice", verifyPaymentservice);
router.get("/getUserOrdersService/:userId", getUserOrdersService);
router.get("/getOrderServiceById/:id", getOrderServiceById);

module.exports = router;
