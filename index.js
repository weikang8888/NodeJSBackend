const express = require("express");
const cors = require("cors");
const authRouter = require("./routes/crm/auth");
const profileRouter = require("./routes/crm/profile");
const taskRouter = require("./routes/crm/task");
const mentorRouter = require("./routes/crm/mentor");
const memberRouter = require("./routes/crm/member");
const uploadRouter = require("./routes/crm/upload");

const EcommerceAuthRouter = require("./routes/ecommerce/auth");
const EcommerceProfileRouter = require("./routes/ecommerce/profile");
const EcommerceProductRouter = require("./routes/ecommerce/product");
const EcommerceCartRouter = require("./routes/ecommerce/cart");
const EcommerceWishRouter = require("./routes/ecommerce/wish");
const EcommerceBlogRouter = require("./routes/ecommerce/blog");

const { connectToMongo } = require("./db");
const path = require("path");

const app = express();
const port = 3005;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Express + MongoDB Atlas!");
});

app.use("/crm/auth", authRouter);
app.use("/crm/profile", profileRouter);
app.use("/crm/task", taskRouter);
app.use("/crm/mentor", mentorRouter);
app.use("/crm/member", memberRouter);
app.use("/crm/upload", uploadRouter);

app.use("/ecommerce/auth", EcommerceAuthRouter);
app.use("/ecommerce/profile", EcommerceProfileRouter);
app.use("/ecommerce/products", EcommerceProductRouter);
app.use("/ecommerce/cart", EcommerceCartRouter);
app.use("/ecommerce/wish", EcommerceWishRouter);
app.use("/ecommerce/blog", EcommerceBlogRouter);

app.use("/uploads", express.static(path.join(__dirname, "routes/crm/uploads")));
app.use(
  "/uploads",
  express.static(path.join(__dirname, "routes/ecommerce/uploads"))
);

connectToMongo().then(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
});
