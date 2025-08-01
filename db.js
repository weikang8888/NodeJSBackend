const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGO_URI;

// Standard connection options
const clientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  ssl: true,
  tls: true,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 30000,
};

// Fallback options for SSL issues (more permissive)
const fallbackOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  ssl: true,
  tls: true,
  tlsAllowInvalidCertificates: true,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 30000,
};

const client = new MongoClient(uri, clientOptions);

const dbCache = {};

async function connectToMongo(dbName = "crm") {
  if (dbCache[dbName]) return dbCache[dbName];
  
  try {
    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    console.log(`Connected to MongoDB Atlas! DB: ${dbName}`);
    dbCache[dbName] = db;
    return db;
  } catch (error) {
    console.error("Failed to connect to MongoDB with standard options:", error);
    
    // Try with fallback options if SSL error occurs
    if (error.message.includes('SSL') || error.message.includes('TLS')) {
      console.log("Attempting connection with fallback SSL options...");
      try {
        const fallbackClient = new MongoClient(uri, fallbackOptions);
        await fallbackClient.connect();
        const db = fallbackClient.db(dbName);
        await db.command({ ping: 1 });
        console.log(`Connected to MongoDB Atlas with fallback options! DB: ${dbName}`);
        dbCache[dbName] = db;
        return db;
      } catch (fallbackError) {
        console.error("Failed to connect with fallback options:", fallbackError);
        throw fallbackError;
      }
    }
    
    throw error;
  }
}

module.exports = { client, connectToMongo };
