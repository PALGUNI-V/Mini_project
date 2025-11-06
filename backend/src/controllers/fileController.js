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
console.log("💧 Watermark embedded.");

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
    const { fileId } = req.params; // <-- ensure your route has :fileId
    const { userId, email, username } = req.body;
    const ownerId = req.user._id;

    // ✅ Re-fetch latest file from DB (not from middleware)
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    // 🚫 BLOCK 1: If file is tampered, deny sharing immediately
    if (file.status === 'tampered') {
      console.log(`🚫 Share blocked: ${file.originalName} marked as tampered.`);

      await AuditLog.logAction({
        file: file._id,
        action: 'tamper_share_attempt',
        performedBy: ownerId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { reason: 'File marked as tampered' }
      });

      return res.status(403).json({
        success: false,
        message: '❌ File is tampered — sharing disabled for security reasons.'
      });
    }

    // 🚫 BLOCK 2: Prevent self-sharing
    let targetUser;
    if (userId) targetUser = await User.findById(userId);
    else if (email) targetUser = await User.findOne({ email });
    else if (username) targetUser = await User.findOne({ username });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (targetUser._id.toString() === ownerId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot share file with yourself'
      });
    }

    // ✅ Continue with normal sharing only if file is secure
    file.shareWith(targetUser._id);
    await file.save();

    await AuditLog.logAction({
      file: file._id,
      action: 'share',
      performedBy: ownerId,
      targetUser: targetUser._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    return res.status(200).json({
      success: true,
      message: '✅ File shared successfully',
      data: { file }
    });

  } catch (error) {
    console.error('❌ Share error:', error);
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
    console.log("⚙ verifyFileIntegrity endpoint hit"); // 🔍 Check function is called

    const fileId = req.params.id;
    const userId = req.user?._id;
    const file = await File.findById(fileId);

    if (!file) {
      console.log("❌ File not found");
      return res.status(404).json({ match: false, message: "❌ File not found" });
    }

    // 🔍 Confirm physical file exists
    const fileExists = await fs
      .access(file.encryptedPath)
      .then(() => true)
      .catch(() => false);

    if (!fileExists) {
      console.log("⚠️ File missing on server");
      return res.status(404).json({ match: false, message: "⚠️ File missing on server" });
    }

    // ✅ Compute new hash
    const fileBuffer = await fs.readFile(file.encryptedPath);
    const currentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    // 🔍 Debug output
    console.log("DEBUG — currentHash:", currentHash);
    console.log("DEBUG — storedHash:", file.integrityHash);

    const match = currentHash === file.integrityHash;
    console.log("DEBUG — hashes match?", match);

    // ✅ Save tampered/secure status in MongoDB
    file.status = match ? "secure" : "tampered";
    await file.save();

    console.log("DEBUG — saved file.status now:", file.status);

    // Log action
    await AuditLog.logAction({
      file: file._id,
      action: match ? "verify" : "tamper",
      performedBy: userId || null,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      metadata: {
        verified: match,
        currentHash,
        storedHash: file.integrityHash,
      },
    });

    // Send response for UI
    if (match) {
      return res.status(200).json({
        match: true,
        status: file.status,
        message: "✅ File integrity verified successfully",
      });
    } else {
      return res.status(200).json({
        match: false,
        status: file.status,
        message: "⚠️ Integrity mismatch detected — file marked as tampered",
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
