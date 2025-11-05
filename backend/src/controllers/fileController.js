const File = require('../models/File');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const encryptionUtil = require('../utils/encryption');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
/**
 * Upload and encrypt file
 * POST /api/files/upload
 */

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
const uploadedFile = req.file;
const userId = req.user._id;
const fileBuffer = await fs.readFile(uploadedFile.path);

const watermarkData = {
  ownerId: userId.toString(),
  timestamp: new Date().toISOString(),
  username: req.user.username
};

console.log("🧩 Starting AES-256 encryption with invisible watermark...");
console.log("📄 Original File:", uploadedFile.originalname);
console.log("👤 Embedding watermark for:", watermarkData.username);

const { encryptedBuffer } = await encryptionUtil.encryptFile(fileBuffer, watermarkData);

const encryptedFilename = encryptionUtil.generateSecureFilename(uploadedFile.originalname);
const encryptedPath = path.join(process.env.UPLOAD_DIR || './uploads', encryptedFilename);
await fs.writeFile(encryptedPath, encryptedBuffer);

// ✅ Compute SHA-256 integrity hash
const encryptedHash = crypto.createHash('sha256').update(encryptedBuffer).digest('hex');
console.log("🔒 AES Encryption successful. Encrypted file saved as:", encryptedFilename);
console.log("✅ SHA-256 Integrity Hash:", encryptedHash);

await fs.unlink(uploadedFile.path);
console.log("💧 Watermark embedded and original file deleted from temp.");

const file = await File.create({
  filename: encryptedFilename,
  originalName: uploadedFile.originalname,
  mimeType: uploadedFile.mimetype,
  size: uploadedFile.size,
  encryptedPath,
  owner: userId,
  integrityHash: encryptedHash,
  watermarkData: { ...watermarkData, embedded: true }
});

await AuditLog.logAction({
  file: file._id,
  action: 'upload',
  performedBy: userId,
  ipAddress: req.ip,
  userAgent: req.get('user-agent')
});

res.status(201).json({
  success: true,
  message: 'File uploaded and encrypted successfully',
  data: { file }
});

  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && req.file.path) await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({ success: false, message: 'Error uploading file', error: error.message });
  }
};
/**
 * Download and decrypt file
 * GET /api/files/:fileId/download
 */
exports.downloadFile = async (req, res) => {
  try {
    const file = req.file; // From middleware
    const userId = req.user._id;

    // ✅ Step 1: Verify integrity BEFORE decryption
    const encryptedBuffer = await fs.readFile(file.encryptedPath);
    const encryptedHash = crypto.createHash('sha256').update(encryptedBuffer).digest('hex');

    if (encryptedHash !== file.integrityHash) {
      console.error('⚠️ Integrity check failed: File may be tampered or corrupted');
      return res.status(400).json({
        success: false,
        message: 'Integrity check failed — file may have been tampered or corrupted.'
      });
    }

    console.log('✅ Integrity verified successfully');

    // ✅ Step 2: Decrypt file
    const { fileBuffer, watermarkData } = await encryptionUtil.decryptFileFromPath(file.encryptedPath);

    // 🧠 Step 3: Log watermark data
    console.log("Watermark data recovered:", watermarkData);

    // 📝 Step 4: Log audit
    await AuditLog.logAction({
      file: file._id,
      action: 'download',
      performedBy: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { watermark: watermarkData }
    });

    // 📤 Step 5: Send decrypted file
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('X-File-Integrity', 'Verified');
    res.send(fileBuffer);

  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading file',
      error: error.message
    });
  }
};


/**
 * Share file with user
 * POST /api/files/:fileId/share
 */
exports.shareFile = async (req, res) => {
  try {
    const file = req.file; // From checkFileOwnership middleware
    const { userId, email, username } = req.body;
    const ownerId = req.user._id;

    // Find target user
    let targetUser;
    if (userId) {
      targetUser = await User.findById(userId);
    } else if (email) {
      targetUser = await User.findOne({ email });
    } else if (username) {
      targetUser = await User.findOne({ username });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if sharing with self
    if (targetUser._id.toString() === ownerId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot share file with yourself'
      });
    }

    // Share file
    file.shareWith(targetUser._id);
    await file.save();

    // Log action
    await AuditLog.logAction({
      file: file._id,
      action: 'share',
      performedBy: ownerId,
      targetUser: targetUser._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      success: true,
      message: 'File shared successfully',
      data: { file }
    });
  } catch (error) {
    console.error('Share error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sharing file',
      error: error.message
    });
  }
};

/**
 * Unshare file
 * DELETE /api/files/:fileId/share/:userId
 */
exports.unshareFile = async (req, res) => {
  try {
    const file = req.file; // From checkFileOwnership middleware
    const { userId } = req.params;

    // Unshare file
    file.unshareWith(userId);
    await file.save();

    // Log action
    await AuditLog.logAction({
      file: file._id,
      action: 'unshare',
      performedBy: req.user._id,
      targetUser: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({
      success: true,
      message: 'File unshared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error unsharing file',
      error: error.message
    });
  }
};

/**
 * Delete file
 * DELETE /api/files/:fileId
 */
exports.deleteFile = async (req, res) => {
  try {
    const file = req.file; // From checkFileOwnership middleware

    // Soft delete
    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();

    // Log action
    await AuditLog.logAction({
      file: file._id,
      action: 'delete',
      performedBy: req.user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Optional: Delete physical file
    try {
      await fs.unlink(file.encryptedPath);
    } catch (unlinkError) {
      console.error('Error deleting physical file:', unlinkError);
    }

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting file',
      error: error.message
    });
  }
};

/**
 * Get file audit logs
 * GET /api/files/:fileId/audit-logs
 */
exports.getFileAuditLogs = async (req, res) => {
  try {
    const file = req.file; // From checkFileOwnership middleware

    const logs = await AuditLog.find({ file: file._id })
      .populate('performedBy', 'username email')
      .populate('targetUser', 'username email')
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      data: { logs }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching audit logs',
      error: error.message
    });
  }
};

/**
 * Get all files (owned and shared)
 * GET /api/files
 */
exports.getFiles = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get owned files
    const ownedFiles = await File.find({
      owner: userId,
      isDeleted: false
    })
      .populate('owner', 'username email')
      .populate('sharedWith.user', 'username email')
      .sort({ uploadedAt: -1 });

    // Get shared files
    const sharedFiles = await File.find({
      'sharedWith.user': userId,
      isDeleted: false
    })
      .populate('owner', 'username email')
      .populate('sharedWith.user', 'username email')
      .sort({ uploadedAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        ownedFiles,
        sharedFiles
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching files',
      error: error.message
    });
  }
  
};
/**
 * Verify file integrity (SHA-256)
 * GET /api/files/verify/:id
 */
/**
 * Verify file integrity (SHA-256)
 * GET /api/files/verify/:id
 */
exports.verifyFileIntegrity = async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user?._id; // optional for logging
    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({
        match: false,
        message: "❌ File not found",
      });
    }

    // Ensure file exists physically
    const fileExists = await fs
      .access(file.encryptedPath)
      .then(() => true)
      .catch(() => false);
    if (!fileExists) {
      return res.status(404).json({
        match: false,
        message: "⚠️ File missing on server",
      });
    }

    // Read encrypted file from disk
    const fileBuffer = await fs.readFile(file.encryptedPath);

    // Recompute hash
    const currentHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    // Compare with stored hash
    const match = currentHash === file.integrityHash;

    // Log audit (optional but recommended)
    await AuditLog.logAction({
      file: file._id,
      action: "verify",
      performedBy: userId || null,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        verified: match,
        currentHash,
        storedHash: file.integrityHash,
      },
    });

    // Send response based on match result
    if (match) {
      console.log(`✅ Integrity verified for ${file.originalName}`);
      return res.status(200).json({
        match: true,
        watermarkData: file.watermarkData || null,
        message: "✅ File integrity verified successfully",
      });
    } else {
      console.warn(`⚠️ Integrity mismatch detected for ${file.originalName}`);
      return res.status(200).json({
        match: false,
        watermarkData: file.watermarkData || null,
        message: "⚠️ Integrity mismatch detected – file may be modified or corrupted",
      });
    }
  } catch (error) {
    console.error("❌ Error verifying integrity:", error);
    return res.status(500).json({
      match: false,
      message: "❌ Internal error verifying file integrity",
    });
  }
};
