const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const dbCache = {};

async function connectToMongo(dbName) {
  if (dbCache[dbName]) return dbCache[dbName];
  await client.connect();
  const db = client.db(dbName);
  await db.command({ ping: 1 });
  console.log(`Connected to MongoDB Atlas! DB: ${dbName}`);
  dbCache[dbName] = db;
  return db;
}

module.exports = { client, connectToMongo };
