require("dotenv").config();
const { connectToMongo } = require("./db");

async function testConnection() {
  console.log("Testing MongoDB connection...");
  console.log("Node.js version:", process.version);
  console.log("Environment:", process.env.NODE_ENV);
  
  try {
    const db = await connectToMongo();
    console.log("✅ Connection test successful!");
    
    // Test a simple query
    const collections = await db.listCollections().toArray();
    console.log("Available collections:", collections.map(c => c.name));
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Connection test failed:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  }
}

testConnection(); 