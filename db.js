const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

// Use environment variable for MongoDB URI, fallback to localhost for development
const uri = process.env.MONGO_URI || "mongodb://localhost:27017";

// Enhanced connection options for production environments
const clientOptions = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  ssl: true,
  sslValidate: false,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferMaxEntries: 0,
  retryWrites: true,
  w: "majority"
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
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

module.exports = { client, connectToMongo };
