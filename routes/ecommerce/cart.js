const express = require("express");
const getCrmDb = require("./index");
const { authenticateJWT } = require("../../utils/authMiddleware");
const { ObjectId } = require("mongodb");

const router = express.Router();

router.post("/add", authenticateJWT, async (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity) {
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
    // Try to update existing cart item by product name (since productId is not stored)
    const updateResult = await db.collection("carts").updateOne(
      { userId, "items.name": product.name },
      {
        $inc: { "items.$.quantity": quantity },
        $set: {
          "items.$.image": product.image,
          "items.$.name": product.name,
          "items.$.price": product.price,
        },
      }
    );
    // If no item was updated, push a new item with a unique _id
    if (updateResult.matchedCount === 0) {
      await db.collection("carts").updateOne(
        { userId },
        {
          $setOnInsert: { userId },
          $push: {
            items: {
              _id: product._id,
              image: product.image,
              name: product.name,
              price: product.price,
              quantity,
            },
          },
        },
        { upsert: true }
      );
    }
    res.json({ message: "Added to cart." });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to add to cart.", error: err.message });
  }
});

// Get cart list: GET /ecommerce/cart/list
router.get("/list", authenticateJWT, async (req, res) => {
  try {
    const db = await getCrmDb();
    const userId = req.user._id;
    const cart = await db.collection("carts").findOne({ userId });

    // Always return image, name, price, quantity, and _id for each cart item
    const items = (cart?.items || []).map((item) => {
      let fullImageUrl = item.image;
      if (item.image) {
        const filename = item.image.split(/[\\/]/).pop();
        fullImageUrl = `${req.protocol}://${req.get(
          "host"
        )}/uploads/${filename}`;
      }
      return {
        _id: item._id,
        image: fullImageUrl,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      };
    });
    res.json(items);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch cart.", error: err.message });
  }
});

// Update cart item quantity: PUT /ecommerce/cart/update/:id
router.put("/update/:id", authenticateJWT, async (req, res) => {
  try {
    const db = await getCrmDb();
    const userId = req.user._id;
    const { id } = req.params;
    const { quantity } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Missing item id." });
    }

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1." });
    }

    const result = await db
      .collection("carts")
      .updateOne(
        { userId, "items._id": new ObjectId(id) },
        { $set: { "items.$.quantity": quantity } }
      );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Cart item not found." });
    }

    res.json({ message: "Cart item quantity updated." });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to update cart item.", error: err.message });
  }
});

// Delete a product from cart: DELETE /ecommerce/cart/delete/:_id
router.delete("/delete/:_id", authenticateJWT, async (req, res) => {
  try {
    const db = await getCrmDb();
    const userId = req.user._id;
    const { _id } = req.params;
    if (!_id) {
      return res.status(400).json({ message: "Missing _id." });
    }
    const result = await db
      .collection("carts")
      .updateOne({ userId }, { $pull: { items: { _id: new ObjectId(_id) } } });
    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Cart item not found." });
    }
    res.json({ message: "Cart item removed." });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to remove cart item.", error: err.message });
  }
});

// Clear all items from cart: DELETE /ecommerce/cart/clear
router.delete("/clear", authenticateJWT, async (req, res) => {
  try {
    const db = await getCrmDb();
    const userId = req.user._id;
    const result = await db.collection("carts").updateOne(
      { userId },
      { $set: { items: [] } }
    );
    res.json({ message: "Cart cleared." });
  } catch (err) {
    res.status(500).json({ message: "Failed to clear cart.", error: err.message });
  }
});

module.exports = router;
