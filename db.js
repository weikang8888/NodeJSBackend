const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

// Use environment variable for MongoDB URI, fallback to localhost for development
const uri = process.env.MONGO_URI || "mongodb://localhost:27017";

// Connection options optimized for Render.com and MongoDB Atlas
const clientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 5,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  retryWrites: true,
  retryReads: true,
  w: "majority",
  tls: true,
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false
};

// Fallback options for SSL issues
const fallbackOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 5,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  retryWrites: true,
  retryReads: true,
  w: "majority"
};

const client = new MongoClient(uri, clientOptions);
const fallbackClient = new MongoClient(uri, fallbackOptions);

const dbCache = {};

async function connectToMongo(dbName = "crm") {
  if (dbCache[dbName]) return dbCache[dbName];
  
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`Attempting to connect to MongoDB (attempt ${retryCount + 1}/${maxRetries})...`);
      await client.connect();
      const db = client.db(dbName);
      await db.command({ ping: 1 });
      console.log(`Connected to MongoDB Atlas! DB: ${dbName}`);
      dbCache[dbName] = db;
      return db;
    } catch (error) {
      retryCount++;
      console.error(`MongoDB connection attempt ${retryCount} failed:`, error.message);
      
      // If it's an SSL error, try with fallback options
      if (error.message.includes('SSL') || error.message.includes('TLS')) {
        console.log('SSL error detected, trying fallback connection...');
        try {
          await fallbackClient.connect();
          const db = fallbackClient.db(dbName);
          await db.command({ ping: 1 });
          console.log(`Connected to MongoDB Atlas with fallback! DB: ${dbName}`);
          dbCache[dbName] = db;
          return db;
        } catch (fallbackError) {
          console.error('Fallback connection also failed:', fallbackError.message);
        }
      }
      
      if (retryCount >= maxRetries) {
        console.error("All MongoDB connection attempts failed");
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = Math.pow(2, retryCount) * 1000;
      console.log(`Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

module.exports = { client, fallbackClient, connectToMongo };
