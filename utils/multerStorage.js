const multer = require('multer');
const path = require('path');

function createMulterUpload(destination = 'routes/crm/uploads/') {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, destination);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });
  return multer({ storage });
}

module.exports = createMulterUpload; 