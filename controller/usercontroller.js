const user = require("../models/usermodels");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path")

exports.signupuser = async (req, res) => {


    try {
        const { name, email, address, contact, password } = req.body
        const { city, zipCode, state } = address || {};
        // if (!name || !email || !contact || !password || !city || !zipCode ||!state ) {
        //     return res.status(400).send("plese fill the filled");
        // }


        const userexist = await user.findOne({ email: email });
        if (userexist) {
            return res.status(400).send("User elready exists")
        }

        // const password = Math.random().toString(36).slice(-8);

        console.log("Generated Password:", password);

        const hashPassword = await bcrypt.hash(password, 10);
        const newuser = await user.create({
            name,
            email,
            address: {
                city: city,
                zipCode: zipCode,
                state: state
            },
            contact,
            password: hashPassword
        })

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "user password created",
            html: `<h1> name : ${email},
            <h2> password : ${password}`
        })


        return res.status(200).json({
            success: true,
            message: "Registration successful"
        });
    } catch (error) {
        return res.status(500).send(error.message)
    }

};
exports.loginuser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "plese fill the filled"
            });
        }

        const userexist = await user.findOne({ email: email });

        if (!userexist) {
            return res.status(400).json({
                success: false,
                message: "user not foundd"
            });
        }
        const isMatch = await bcrypt.compare(
            password,
            userexist.password
        );

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid user and password"
            });;
        }

        const token = jwt.sign({
            id: userexist._id
        },
            process.env.JWT_SECRET || "mysecretkey"
        );
        return res.json({
            success: true,
            message: "Login Succesfully",
            token: token,
            userId: userexist._id

        })
    } catch (error) {
        return res.status(500).send(error.message);
    }

}
exports.forgotpassword = async (req, res) => {
    try {
        const { email } = req.body;

        const users = await user.findOne({ email: email });

        if (!users) {
            return res.status(404).json({
                success: false,
                message: "User Not Found"
            });
        }


        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();


        users.otp = otp;
        users.otpExpire = Date.now() + 5 * 60 * 1000;

        await users.save();
        try {
            const transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: "Reset Password OTP",
                html: `
                <h1>Reset Password</h1>
                <h2>Your OTP is: ${otp}</h2>
                <p>This OTP will expire in 5 minutes.</p>
            `
            });
        } catch (error) {
            console, log(error);
        }
        return res.status(200).json({
            success: true,
            message: "OTP Sent Successfully"
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
exports.verifyotp = async (req, res) => {
    try {

        const { email, otp } = req.body;


        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Please fill all fields"
            });
        }

        const users = await user.findOne({ email: email });

        if (!users) {
            return res.status(404).json({
                success: false,
                message: "User Not Found"
            });
        }

        // OTP check
        if (String(users.otp) !== String(otp)) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        // OTP expire check
        if (!users.otpExpire || new Date(users.otpExpire) < new Date()) {
            return res.status(400).json({
                success: false,
                message: "OTP Expired"
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP Verify Successfully"
        });

    } catch (error) {

        console.log("VERIFY OTP ERROR:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
exports.resetpass = async (req, res) => {
    try {
        const { email, password } = req.body;

        const users = await user.findOne({ email: email });

        if (!users) {
            return res.status(400).json({
                success: false,
                message: "User not found",
            });
        }

        const hashpassword = await bcrypt.hash(password, 10);

        users.password = hashpassword;
        await users.save();

        users.otp = null;
        users.otpExpire = null;
        await users.save();

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset Successfully",
            html: `
        <h1>Password Reset Successfully</h1>
        <p>Your password has been changed successfully.</p> `,
        });

        return res.status(200).json({
            success: true,
            message: "Password reset successfully",
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.editsignupuser = async (req, res) => {
    const storage = multer.diskStorage({

        destination: (req, file, cb) => {
            cb(null, "./uploads");
        },

        filename: (req, file, cb) => {
            const newfilename =
                Date.now() + path.extname(file.originalname);

            cb(null, newfilename);
        }

    });


    const upload = multer({
        storage: storage
    }).single("images");

    upload(req, res, async (err) => {
        try {
            const userId = req.params.id;
            const { name, email, address, contact, password } = req.body;
            const { city, zipCode, state } = address || {};
            // if(!name || !email || !contact ||!password || !city || !zipCode ||!state ||!images){
            //    return res.status(400).json({
            //         success : true,
            //         message : "Plese fill the filled"
            //     })
            // }

            if (!req.file) {
                return res.status(400).json({
                    message: "Image required"
                });
            }


            const updateData = {
                name: name,
                email: email,
                address: {
                    city: req.body.city || (address && address.city),
                    zipCode: req.body.zipCode || (address && address.zipCode),
                    state: req.body.state || (address && address.state)
                },
                contact: contact
            };

            if (req.file) {
                updateData.images = [
                    {
                        file: req.file.filename,
                        path: req.file.path
                    }
                ];
            }

            if (password) {
                updateData.password = await bcrypt.hash(password, 10);
            }

            const userExist = await user.findByIdAndUpdate(userId, updateData, { new: true });

            if (!userExist) {
                return res.status(404).json({
                    success: false,
                    message: "User Not Found",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Successfully Edit User",
                user: {
                    _id: userExist._id,
                    name: userExist.name,
                    email: userExist.email,
                    address: userExist.address,
                    contact: userExist.contact,
                    images: userExist.images
                }
            });

        } catch (err) {
            console.log("EDIT USER ERROR =", err);

            res.status(500).json({
                success: false,
                message: err.message
            });
        }
    })
};
exports.getUserById = async (req, res) => {
    try {

        const userId = req.params.id;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }


        const userData = await user.findById(userId);


        if (!userData) {
            return res.status(404).json({
                success: false,
                message: "User Not Found"
            });
        }
        return res.status(200).json({
            success: true,
            message: "User Found",
            user: {
                _id: userData._id,
                name: userData.name || "",
                email: userData.email || "",
                contact: userData.contact || "",
                address: {
                    city: userData.address?.city || "",
                    zipCode: userData.address?.zipCode || "",
                    state: userData.address?.state || ""
                },
                images: userData.images || []
            }
        });

    } catch (error) {

        console.log("GET USER BY ID ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

exports.changepassword = async (req, res) => {
    try {
        const { currentPassword, newpassword, conformNewpassword } = req.body;

        if (!currentPassword || !newpassword || !conformNewpassword) {
            return res.status(400).json({
                success: true,
                message: "Plese fill the filled"
            })
        }

        if (newpassword !== conformNewpassword) {
            return res.status(400).json({
                success: true,
                message: "New Password And Conform Password Do Not Match"
            })
        }

        const userid = req.params.id;
        const userData = await user.findById(userid);
        if (!userData) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(
            currentPassword,
            userData.password
        )

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "current password is incorrect"
            })
        }

        const hashpassword = await bcrypt.hash(
            newpassword,
            10
        )

        userData.password = hashpassword;

        await userData.save();

        return res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
exports.logoutuser = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: "Logout Successfully"
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};