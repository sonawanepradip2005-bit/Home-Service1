const mongoose = require("mongoose");
//child Schema
const addressSchema = new mongoose.Schema({
   city: {type : String , required: false ,  default: ""},
   zipCode :{type : String , required : false ,  default: ""},
   state : {type: String , required : false,  default: ""}
}, { _id : false});

//parents schema
const userSchema = new mongoose.Schema({
    images : [
        {
             file: { type: String, required: true },
            path: { type: String, required: true },
            uploadDate: { type: Date, default: Date.now }
        }
    ],
    name: { type: String, required: false, trim: true },
    email: { type: String, required: false, unique: true, trim: true },
    address: { type: addressSchema, required: false, trim: true },
    contact: { type: String, required: false, trim: true },
    password: { type: String, required: false },
    otp: {
        type: String,
        required: null,
        trim: true
    },
    otpExpire: {
        type: String,
        required: null,
        trim: true
    }
}
, {
    timestamps: true
}


);
module.exports = mongoose.model("user", userSchema);