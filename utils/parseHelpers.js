const { ObjectId } = require("mongodb");

// Parse a single ObjectId, throw error if invalid
function parseObjectId(id, fieldName) {
  try {
    return new ObjectId(id);
  } catch {
    throw new Error(`Invalid ${fieldName} format.`);
  }
}

// Parse an array of ObjectIds, support JSON string or array, throw error if invalid
function parseObjectIdArray(arr, fieldName) {
  let arrVal = arr;
  if (typeof arr === "string") {
    try {
      arrVal = JSON.parse(arr);
    } catch {
      throw new Error(`${fieldName} must be an array or a valid JSON array string.`);
    }
  }
  if (!Array.isArray(arrVal) || arrVal.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array.`);
  }
  try {
    return arrVal.map(id => new ObjectId(id));
  } catch {
    throw new Error(`Invalid ${fieldName} format. All ${fieldName}s must be valid ObjectId strings.`);
  }
}

module.exports = { parseObjectId, parseObjectIdArray }; 