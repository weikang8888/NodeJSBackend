const express = require("express");
const getCrmDb = require("./index");
const { validateBody, Joi } = require("../../utils/validate");
const { ObjectId } = require("mongodb");
const { authenticateJWT } = require("../../utils/authMiddleware");

const router = express.Router();

// Product creation validation schema
const productSchema = Joi.object({
  image: Joi.string().required(),
  name: Joi.string().required(),
  price: Joi.number().required(),
  gender: Joi.string().required(),
  shape: Joi.string().required(),
});

// Product list validation schema
const productListSchema = Joi.object({
  type: Joi.string().optional(),
});



router.post("/list", validateBody(productListSchema), async (req, res) => {
  try {
    const db = await getCrmDb();
    const { type } = req.body;

    const query = {};
    if (type) {
      query.type = type;
    }

    const products = await db.collection("products").find(query).toArray();
    // Map over each product and update the image field to a full URL
    const productsWithFullImageUrl = products.map((product) => {
      if (product.image) {
        const filename = product.image.split(/[\\/]/).pop();
        return {
          ...product,
          image: `${req.protocol}://${req.get("host")}/uploads/${filename}`,
        };
      }
      return product;
    });
    res.json(productsWithFullImageUrl);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch products.", error: err.message });
  }
});

router.post("/create", validateBody(productSchema), async (req, res) => {
  try {
    const db = await getCrmDb();
    const product = req.body;
    product._id = new ObjectId();
    await db.collection("products").insertOne(product);
    res.status(201).json({ message: "Product created successfully.", product });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to create product.", error: err.message });
  }
});

router.post("/view/:id", async (req, res) => {
  try {
    const db = await getCrmDb();
    const { id } = req.params;

    // Validate if id is a valid ObjectId
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID format." });
    }

    const product = await db
      .collection("products")
      .findOne({ _id: new ObjectId(id) });

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    // Update the image field to a full URL
    if (product.image) {
      const filename = product.image.split(/[\\/]/).pop();
      product.image = `${req.protocol}://${req.get(
        "host"
      )}/uploads/${filename}`;
    }

    res.json(product);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to fetch product.", error: err.message });
  }
});

module.exports = router;
