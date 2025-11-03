const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fileController = require('../controllers/fileController');
const { protect } = require('../middleware/auth');
const { checkFileAccess, checkFileOwnership } = require('../middleware/fileAccess');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'temp-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 // 50MB default
  },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

// ✅ All routes require authentication
router.use(protect);

// ✅ File management routes
router.post('/upload', upload.single('file'), fileController.uploadFile);
router.get('/', fileController.getFiles);

// 🧩 FIXED: call from controller, not destructured import
router.get('/verify/:id', fileController.verifyFileIntegrity);

router.get('/:fileId/download', checkFileAccess, fileController.downloadFile);
router.delete('/:fileId', checkFileOwnership, fileController.deleteFile);

// ✅ Sharing routes
router.post('/:fileId/share', checkFileOwnership, fileController.shareFile);
router.delete('/:fileId/share/:userId', checkFileOwnership, fileController.unshareFile);

// ✅ Audit logs
router.get('/:fileId/audit-logs', checkFileOwnership, fileController.getFileAuditLogs);

module.exports = router;
