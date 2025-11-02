const File = require('../models/File');

/**
 * Check if user has access to file
 */
exports.checkFileAccess = async (req, res, next) => {
  try {
    const fileId = req.params.fileId || req.params.id;
    const userId = req.user._id;

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (file.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'File has been deleted'
      });
    }

    // Check if file is expired
    if (file.expiresAt && file.expiresAt < new Date()) {
      return res.status(403).json({
        success: false,
        message: 'File has expired'
      });
    }

    // Check access
    if (!file.hasAccess(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this file'
      });
    }

    // Attach file to request
    req.file = file;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking file access',
      error: error.message
    });
  }
};

/**
 * Check if user is owner of file
 */
exports.checkFileOwnership = async (req, res, next) => {
  try {
    const fileId = req.params.fileId || req.params.id;
    const userId = req.user._id;

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    if (file.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the file owner can perform this action'
      });
    }

    req.file = file;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking file ownership',
      error: error.message
    });
  }
};