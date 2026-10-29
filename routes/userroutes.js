const express = require("express");
const router = express.Router();
const {
   signupuser,
   loginuser,
   forgotpassword,
   verifyotp,
   resetpass,
   editsignupuser,
   getUserById,
   changepassword,
   logoutuser
} = require("../controller/usercontroller");

router.post("/signupuser",signupuser);
router.post("/loginuser",loginuser);
router.post("/forgotpassword",forgotpassword);
router.post("/verifyotp",verifyotp);
router.post("/resetpass",resetpass);
router.put("/editsignupuser/:id",editsignupuser);
router.get("/getUserById/:id",getUserById);
router.post("/changepassword/:id",changepassword);
router.post("/logoutuser", logoutuser);
module.exports = router;