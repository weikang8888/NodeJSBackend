const express = require('express');
const createMulterUpload = require('../../utils/multerStorage');
const getCrmDb = require('./index');
const { ObjectId } = require('mongodb');
const { authenticateJWT } = require('../../utils/authMiddleware');

const router = express.Router();
const upload = createMulterUpload();

// Generalized photo upload endpoint
router.post('/', authenticateJWT, upload.single('photo'), async (req, res) => {
  const { type, refId } = req.body;
  if (!type || !refId || !req.file) {
    return res.status(400).json({ message: 'type, refId, and photo are required.' });
  }

  let collectionName, photoField;
  switch (type) {
    case 'task':
      collectionName = 'tasks';
      photoField = 'photo';
      break;
    case 'profile':
      collectionName = 'profile';
      photoField = 'avatar';
      break;
    case 'mentor':
      collectionName = 'mentors';
      photoField = 'avatar';
      break;
    case 'member':
      collectionName = 'members';
      photoField = 'avatar';
      break;
    default:
      return res.status(400).json({ message: 'Invalid type.' });
  }

  try {
    const db = await getCrmDb();
    const collection = db.collection(collectionName);
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(refId) },
      { $set: { [photoField]: req.file.path } },
      { returnDocument: 'after' }
    );
    if (!result) {
      return res.status(404).json({ message: 'Resource not found.' });
    }
    res.json({ message: 'Photo uploaded successfully.', [photoField]: req.file.path });
  } catch (err) {
    res.status(500).json({ message: 'Failed to upload photo.', error: err.message });
  }
});

module.exports = router; 