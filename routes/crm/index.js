// routes/crm/crmDb.js
const { connectToMongo } = require("../../db");
const crmDbName = process.env.CRM_DB_NAME;

async function getCrmDb() {
  return await connectToMongo(crmDbName);
}

module.exports = getCrmDb;
