const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGO_URI;

// Multiple connection strategies for different environments
const connectionStrategies = [
  // Strategy 1: Minimal SSL options (most compatible)
  {
    name: "minimal-ssl",
    options: {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    }
  },
  
  // Strategy 2: Explicit SSL with TLS settings
  {
    name: "explicit-ssl",
    options: {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      ssl: true,
      tls: true,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    }
  },
  
  // Strategy 3: Permissive SSL (for problematic environments)
  {
    name: "permissive-ssl",
    options: {
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
    }
  },
  
  // Strategy 4: No SSL (last resort)
  {
    name: "no-ssl",
    options: {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      ssl: false,
      tls: false,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    }
  }
];

const dbCache = {};

async function connectToMongo(dbName = "crm") {
  if (dbCache[dbName]) return dbCache[dbName];
  
  let lastError = null;
  
  // Try each connection strategy
  for (const strategy of connectionStrategies) {
    try {
      console.log(`Attempting connection with strategy: ${strategy.name}`);
      
      const client = new MongoClient(uri, strategy.options);
      await client.connect();
      
      const db = client.db(dbName);
      await db.command({ ping: 1 });
      
      console.log(`✅ Connected to MongoDB Atlas using strategy: ${strategy.name}! DB: ${dbName}`);
      dbCache[dbName] = db;
      return db;
      
    } catch (error) {
      lastError = error;
      console.error(`❌ Strategy ${strategy.name} failed:`, error.message);
      
      // If it's not an SSL error, don't try other strategies
      if (!error.message.includes('SSL') && !error.message.includes('TLS')) {
        throw error;
      }
    }
  }
  
  // Final fallback: Try alternative connection methods
  console.log("All standard strategies failed, trying alternative methods...");
  
  try {
    // Try alternative connection without SSL options
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      connectTimeoutMS: 60000,
      socketTimeoutMS: 60000,
      maxPoolSize: 10,
      minPoolSize: 1,
    });

    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    
    console.log("✅ Alternative connection successful!");
    dbCache[dbName] = db;
    return db;
    
  } catch (alternativeError) {
    console.error("Alternative connection also failed:", alternativeError.message);
    throw lastError || alternativeError;
  }
}

module.exports = { connectToMongo };
