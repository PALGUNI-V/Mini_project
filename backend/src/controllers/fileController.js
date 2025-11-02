const File = require('../models/File');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const encryptionUtil = require('../utils/encryption');
const path = require('path');
const fs = require('fs').promises;

/**
 * Upload and encrypt file
 * POST /api/files/upload
 */
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const uploadedFile = req.file;
    const userId = req.user._id;

    // Read uploaded file
    const fileBuffer = await fs.readFile(uploadedFile.path);

    // Prepare watermark data
    const watermarkData = {
      ownerId: userId.toString(),
      timestamp: new Date().toISOString(),
      username: req.user.username
    };

    // Encrypt file with watermark
    const { encryptedBuffer } = await encryptionUtil.encryptFile(
      fileBuffer,
      watermarkData
    );
    

// Log watermark embedding confirmation
console.log("🪶 Watermark embedded successfully:", watermarkData);


    // Generate secure filename
    const encryptedFilename = encryptionUtil.generateSecureFilename(uploadedFile.originalname);
    const encryptedPath = path.join(process.env.UPLOAD_DIR || './uploads', encryptedFilename);

    // Save encrypted file
    await fs.writeFile(encryptedPath, encryptedBuffer);

    // Delete original unencrypted file
    await fs.unlink(uploadedFile.path);

    // Save file metadata to database
    const file = await File.create({
      filename: encryptedFilename,
      originalName: uploadedFile.originalname,
      mimeType: uploadedFile.mimetype,
      size: uploadedFile.size,
      encryptedPath,
      owner: userId,
      watermarkData: {
        ...watermarkData,
        embedded: true
      }
    });

    // Log action
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
    
    // Clean up uploaded file if exists
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message
    });
  }
};

module.exports = exports;

/**
 * Download and decrypt file
 * GET /api/files/:fileId/download
 */
exports.downloadFile = async (req, res) => {
  try {
    const file = req.file; // From checkFileAccess middleware
    const userId = req.user._id;

    // 🔐 Step 1: Decrypt the file using AES
    const { fileBuffer, watermarkData } = await encryptionUtil.decryptFileFromPath(file.encryptedPath);

    // 🧠 Step 2: Log watermark data for backend visibility
    console.log("✅ Watermark data recovered:", watermarkData);

    // 📝 Step 3: Log download activity in AuditLog
    await AuditLog.logAction({
      file: file._id,
      action: 'download',
      performedBy: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { watermark: watermarkData }
    });

    // 📤 Step 4: Send decrypted file to frontend
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', fileBuffer.length);
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
