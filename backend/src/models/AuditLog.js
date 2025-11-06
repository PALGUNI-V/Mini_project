const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  file: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true
  },
  action: {
    type: String,
    enum: [
      'upload',
      'download',
      'share',
      'unshare',
      'delete',
      'view',
      'verify',    // ✅ added
      'tamper'     // ✅ added (optional but useful)
    ],
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
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
});

// Indexes for faster queries
auditLogSchema.index({ file: 1, timestamp: -1 });
auditLogSchema.index({ performedBy: 1, timestamp: -1 });

// Static method to log actions safely
auditLogSchema.statics.logAction = async function (data) {
  try {
    return await this.create(data);
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Log silently so it doesn't break main app flow
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
