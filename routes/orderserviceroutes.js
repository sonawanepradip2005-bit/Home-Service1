const express = require("express");
const router = express.Router();

const {
    verifyPaymentservice,
    createOrderservice
} = require("../controller/orderservicecontroller");

router.post("/createOrderservice", createOrderservice);
router.post("/verifyPaymentservice", verifyPaymentservice);
module.exports = router;