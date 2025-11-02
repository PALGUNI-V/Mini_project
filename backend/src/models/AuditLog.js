const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  file: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true
  },
  action: {
    type: String,
    enum: ['upload', 'download', 'share', 'unshare', 'delete', 'view'],
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
});

// Index for faster queries
auditLogSchema.index({ file: 1, timestamp: -1 });
auditLogSchema.index({ performedBy: 1, timestamp: -1 });

// Static method to log action
auditLogSchema.statics.logAction = async function(data) {
  try {
    return await this.create(data);
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to prevent disrupting main flow
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);