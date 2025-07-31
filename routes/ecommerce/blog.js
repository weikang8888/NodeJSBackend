const express = require("express");
const getCrmDb = require("./index");
const router = express.Router();

router.post("/list", async (req, res) => {
  try {
    const db = await getCrmDb();
    const blogs = await db.collection("blogs").find({}).toArray();
    blogs.forEach((blog) => {
      if (blog.image) {
        const filename = blog.image.split(/[\\/]/).pop();
        blog.image = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
      }
    });
    res.json(blogs);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch blogs.", error: err.message });
  }
});

module.exports = router;
