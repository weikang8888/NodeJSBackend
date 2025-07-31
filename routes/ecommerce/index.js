// routes/crm/crmDb.js
const { connectToMongo } = require("../../db");
const ecommerceDbName = process.env.ECOMMERCE_DB_NAME;

async function getCrmDb() {
  return await connectToMongo(ecommerceDbName);
}

module.exports = getCrmDb;
