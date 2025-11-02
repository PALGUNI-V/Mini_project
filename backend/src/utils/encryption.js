const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// AES-256-GCM encryption
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

class EncryptionUtil {
  constructor() {
    // Generate or use provided encryption key
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey && envKey.length === KEY_LENGTH) {
      this.key = Buffer.from(envKey, 'utf8');
    } else {
      // Generate random key (should be stored securely in production)
      this.key = crypto.randomBytes(KEY_LENGTH);
      console.warn('Using random encryption key. Set ENCRYPTION_KEY in .env for production');
    }
  }

  /**
   * Encrypt file and add watermark
   * @param {Buffer} fileBuffer - Original file buffer
   * @param {Object} watermarkData - Watermark information
   * @returns {Object} - Encrypted buffer and metadata
   */
  async encryptFile(fileBuffer, watermarkData) {
    // Generate IV (Initialization Vector)
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    
    // Embed watermark in metadata
    const watermark = JSON.stringify(watermarkData);
    const watermarkBuffer = Buffer.from(watermark);
    const watermarkLength = Buffer.alloc(4);
    watermarkLength.writeUInt32BE(watermarkBuffer.length, 0);
    
    // Encrypt: watermarkLength + watermark + fileData
    const dataToEncrypt = Buffer.concat([
      watermarkLength,
      watermarkBuffer,
      fileBuffer
    ]);
    
    // Perform encryption
    const encrypted = Buffer.concat([
      cipher.update(dataToEncrypt),
      cipher.final()
    ]);
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine: IV + authTag + encrypted data
    const result = Buffer.concat([iv, authTag, encrypted]);
    
    return {
      encryptedBuffer: result,
      watermarkEmbedded: true
    };
  }

  /**
   * Decrypt file and extract watermark
   * @param {Buffer} encryptedBuffer - Encrypted file buffer
   * @returns {Object} - Decrypted buffer and watermark data
   */
  async decryptFile(encryptedBuffer) {
    // Extract components
    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = encryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    // Extract watermark
    const watermarkLength = decrypted.readUInt32BE(0);
    const watermarkBuffer = decrypted.slice(4, 4 + watermarkLength);
    const fileBuffer = decrypted.slice(4 + watermarkLength);
    
    let watermarkData = null;
    try {
      watermarkData = JSON.parse(watermarkBuffer.toString());
    } catch (error) {
      console.error('Failed to parse watermark:', error);
    }
    
    return {
      fileBuffer,
      watermarkData
    };
  }

  /**
   * Encrypt file and save to disk
   * @param {string} inputPath - Path to input file
   * @param {string} outputPath - Path to save encrypted file
   * @param {Object} watermarkData - Watermark information
   */
  async encryptFileToPath(inputPath, outputPath, watermarkData) {
    const fileBuffer = await fs.readFile(inputPath);
    const { encryptedBuffer } = await this.encryptFile(fileBuffer, watermarkData);
    await fs.writeFile(outputPath, encryptedBuffer);
    return outputPath;
  }

  /**
   * Decrypt file from disk
   * @param {string} inputPath - Path to encrypted file
   * @param {string} outputPath - Path to save decrypted file (optional)
   */
  async decryptFileFromPath(inputPath, outputPath = null) {
    const encryptedBuffer = await fs.readFile(inputPath);
    const { fileBuffer, watermarkData } = await this.decryptFile(encryptedBuffer);
    
    if (outputPath) {
      await fs.writeFile(outputPath, fileBuffer);
    }
    
    return { fileBuffer, watermarkData };
  }

  /**
   * Generate secure random filename
   */
  generateSecureFilename(originalName) {
    const ext = path.extname(originalName);
    const randomName = crypto.randomBytes(16).toString('hex');
    return `${randomName}${ext}.enc`;
  }
}

module.exports = new EncryptionUtil();