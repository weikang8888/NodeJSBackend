const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGO_URI;

// Alternative connection with different SSL handling
async function connectToMongoAlternative(dbName = "crm") {
  try {
    // Method 1: Try with minimal options first
    console.log("Attempting alternative connection method...");
    
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      // Remove all SSL/TLS options to let MongoDB driver handle it automatically
      connectTimeoutMS: 60000,
      socketTimeoutMS: 60000,
      maxPoolSize: 10,
      minPoolSize: 1,
    });

    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    
    console.log("✅ Alternative connection successful!");
    return db;
    
  } catch (error) {
    console.error("Alternative connection failed:", error.message);
    throw error;
  }
}

// Method 2: Connection with retry logic
async function connectWithRetry(dbName = "crm", maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Connection attempt ${attempt}/${maxRetries}`);
      
      const client = new MongoClient(uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        connectTimeoutMS: 30000,
        socketTimeoutMS: 30000,
      });

      await client.connect();
      const db = client.db(dbName);
      await db.command({ ping: 1 });
      
      console.log(`✅ Connection successful on attempt ${attempt}`);
      return db;
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

module.exports = { connectToMongoAlternative, connectWithRetry }; 