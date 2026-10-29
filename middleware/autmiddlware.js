const jwt = require("jsonwebtoken");

const authorization = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).send("login first");
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "mysecretkey");
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).send("invalid token");
    }
};

module.exports = authorization;