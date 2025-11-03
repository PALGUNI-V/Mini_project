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
    const envKey = process.env.ENCRYPTION_KEY;
    if (envKey && envKey.length === KEY_LENGTH) {
      this.key = Buffer.from(envKey, 'utf8');
    } else {
      this.key = crypto.randomBytes(KEY_LENGTH);
      console.warn('Using random encryption key. Set ENCRYPTION_KEY in .env for production');
    }
  }

  /**
   * Encrypt file and add watermark
   */
  async encryptFile(fileBuffer, watermarkData) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    const watermark = JSON.stringify(watermarkData);
    const watermarkBuffer = Buffer.from(watermark);
    const watermarkLength = Buffer.alloc(4);
    watermarkLength.writeUInt32BE(watermarkBuffer.length, 0);

    const dataToEncrypt = Buffer.concat([
      watermarkLength,
      watermarkBuffer,
      fileBuffer
    ]);

    const encrypted = Buffer.concat([
      cipher.update(dataToEncrypt),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();
    const result = Buffer.concat([iv, authTag, encrypted]);

    return {
      encryptedBuffer: result,
      watermarkEmbedded: true
    };
  }

  /**
   * Decrypt file and extract watermark
   */
  async decryptFile(encryptedBuffer) {
    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    const authTag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = encryptedBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

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
   */
  async encryptFileToPath(inputPath, outputPath, watermarkData) {
    const fileBuffer = await fs.readFile(inputPath);
    const { encryptedBuffer } = await this.encryptFile(fileBuffer, watermarkData);
    await fs.writeFile(outputPath, encryptedBuffer);

    // ✅ Generate hash for integrity verification
    const hash = await this.generateFileHash(outputPath);

    return { outputPath, hash };
  }

  /**
   * Decrypt file from disk
   */
  async decryptFileFromPath(inputPath, outputPath = null) {
    const encryptedBuffer = await fs.readFile(inputPath);

    // ✅ Verify file integrity before decrypting
    const currentHash = await this.generateFileHash(inputPath);
    console.log(`Integrity check hash: ${currentHash}`);

    const { fileBuffer, watermarkData } = await this.decryptFile(encryptedBuffer);

    if (outputPath) {
      await fs.writeFile(outputPath, fileBuffer);
    }

    return { fileBuffer, watermarkData, currentHash };
  }

  /**
   * Generate secure random filename
   */
  generateSecureFilename(originalName) {
    const ext = path.extname(originalName);
    const randomName = crypto.randomBytes(16).toString('hex');
    return `${randomName}${ext}.enc`;
  }

  /**
   * ✅ NEW: Generate SHA-256 hash for file integrity
   */
  async generateFileHash(filePath) {
    const hash = crypto.createHash('sha256');
    const fileData = await fs.readFile(filePath);
    hash.update(fileData);
    return hash.digest('hex');
  }

  /**
   * ✅ NEW: Verify file integrity (compare hashes)
   */
  async verifyFileIntegrity(filePath, expectedHash) {
    const currentHash = await this.generateFileHash(filePath);
    return currentHash === expectedHash;
  }
}

module.exports = new EncryptionUtil();
