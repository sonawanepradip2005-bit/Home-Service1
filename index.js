// require("dotenv").config();
const con = require("./config/db");
// const express = require("express");
// const app = express();
// const { createServer } = require("http");
// const server = createServer(app);
// const path = require("path");
// const cors = require("cors");

// const userroutes = require("./routes/userroutes");
// const orderRoutes = require("./routes/orderroutes");
// const orderServiceRoutes = require("./routes/orderserviceroutes");

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.set("view engine", "ejs");
// app.set("views", path.join(__dirname, "views"));
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Express server is running",
  });
});
// app.get("/check", (req, res) => {
//     res.json({
//         sucess: "api is run"
//     })
// })
// app.use(cors({
//     origin: "http://localhost:8081"
// }))
// console.log(cors);

// app.use(userroutes);
// app.use(orderRoutes);
// app.use(orderServiceRoutes);

app.listen(4000, () => {
        console.log("Server Start Port 4000");
    });

// con().then(() => {
//     server.listen(4000, () => {
//         console.log("Server Start Port 4000");
//     });
// });
