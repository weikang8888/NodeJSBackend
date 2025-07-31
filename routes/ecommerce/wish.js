const express = require("express");
const getCrmDb = require("./index");
const { authenticateJWT } = require("../../utils/authMiddleware");
const { ObjectId } = require("mongodb");

const router = express.Router();

// Add to wishlist: POST /ecommerce/wish/add
router.post("/add", authenticateJWT, async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ message: "Missing required fields." });
  }
  try {
    const db = await getCrmDb();
    const userId = req.user._id;
    // Find the product by _id
    const product = await db
      .collection("products")
      .findOne({ _id: new ObjectId(productId) });
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }
    // Check if product already in wishlist
    const exists = await db.collection("wishlists").findOne({
      userId,
      "items._id": product._id,
    });
    if (exists) {
      return res.json({ message: "Already in wishlist." });
    }
    // Add to wishlist
    await db.collection("wishlists").updateOne(
      { userId },
      {
        $setOnInsert: { userId },
        $push: {
          items: {
            _id: product._id,
            image: product.image,
            name: product.name,
            price: product.price,
          },
        },
      },
      { upsert: true }
    );
    res.json({ message: "Added to wishlist." });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to add to wishlist.", error: err.message });
  }
});

// Get wishlist: GET /ecommerce/wish/list
router.get("/list", authenticateJWT, async (req, res) => {
  try {
    const db = await getCrmDb();
    const userId = req.user._id;
    const wishlist = await db.collection("wishlists").findOne({ userId });
    const items = (wishlist?.items || []).map((item) => {
      let fullImageUrl = item.image;
      if (item.image) {
        const filename = item.image.split(/[\\/]/).pop();
        fullImageUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
      }
      return {
        _id: item._id,
        image: fullImageUrl,
        name: item.name,
        price: item.price,
      };
    });
    res.json(items);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch wishlist.", error: err.message });
  }
});

// Delete from wishlist: DELETE /ecommerce/wish/delete/:_id
router.delete("/delete/:_id", authenticateJWT, async (req, res) => {
  try {
    const db = await getCrmDb();
    const userId = req.user._id;
    const { _id } = req.params;
    if (!_id) {
      return res.status(400).json({ message: "Missing _id." });
    }
    const result = await db.collection("wishlists").updateOne(
      { userId },
      { $pull: { items: { _id: new ObjectId(_id) } } }
    );
    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Wishlist item not found." });
    }
    res.json({ message: "Wishlist item removed." });
  } catch (err) {
    res.status(500).json({ message: "Failed to remove wishlist item.", error: err.message });
  }
});

module.exports = router; 