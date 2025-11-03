const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  encryptedPath: {
    type: String,
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  integrityHash: { type: String },
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    },
    permissions: {
      type: String,
      enum: ['read'],
      default: 'read'
    }
  }],
  watermarkData: {
    ownerId: String,
    timestamp: Date,
    embedded: {
      type: Boolean,
      default: false
    }
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  }
});

// Index for faster queries
fileSchema.index({ owner: 1, isDeleted: 1 });
fileSchema.index({ 'sharedWith.user': 1, isDeleted: 1 });
fileSchema.index({ expiresAt: 1 });

// Virtual for checking if file is expired
fileSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Method to check if user has access
fileSchema.methods.hasAccess = function(userId) {
  if (this.owner.toString() === userId.toString()) return true;
  return this.sharedWith.some(share => share.user.toString() === userId.toString());
};

// Method to share file with user
fileSchema.methods.shareWith = function(userId) {
  const alreadyShared = this.sharedWith.some(
    share => share.user.toString() === userId.toString()
  );
  
  if (!alreadyShared) {
    this.sharedWith.push({ user: userId });
  }
  return this;
};

// Method to unshare file
fileSchema.methods.unshareWith = function(userId) {
  this.sharedWith = this.sharedWith.filter(
    share => share.user.toString() !== userId.toString()
  );
  return this;
};

module.exports = mongoose.model('File', fileSchema);