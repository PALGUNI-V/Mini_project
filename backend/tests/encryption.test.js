const encryptionUtil = require('../src/utils/encryption');
const fs = require('fs').promises;
const path = require('path');

describe('Encryption Utility Tests', () => {
  const testContent = 'This is a secret test file content!';
  const watermarkData = {
    ownerId: 'user123',
    timestamp: new Date().toISOString(),
    username: 'testuser'
  };

  describe('File Encryption and Decryption', () => {
    it('should encrypt and decrypt file correctly', async () => {
      const originalBuffer = Buffer.from(testContent);

      // Encrypt
      const { encryptedBuffer, watermarkEmbedded } = await encryptionUtil.encryptFile(
        originalBuffer,
        watermarkData
      );

      expect(watermarkEmbedded).toBe(true);
      expect(encryptedBuffer).toBeDefined();
      expect(encryptedBuffer.length).toBeGreaterThan(0);
      expect(encryptedBuffer).not.toEqual(originalBuffer);

      // Decrypt
      const { fileBuffer, watermarkData: extractedWatermark } = await encryptionUtil.decryptFile(
        encryptedBuffer
      );

      expect(fileBuffer.toString()).toBe(testContent);
      expect(extractedWatermark.ownerId).toBe(watermarkData.ownerId);
      expect(extractedWatermark.username).toBe(watermarkData.username);
    });

    it('should preserve binary data during encryption/decryption', async () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]);

      const { encryptedBuffer } = await encryptionUtil.encryptFile(
        binaryData,
        watermarkData
      );

      const { fileBuffer } = await encryptionUtil.decryptFile(encryptedBuffer);

      expect(fileBuffer).toEqual(binaryData);
    });

    it('should fail to decrypt with tampered data', async () => {
      const originalBuffer = Buffer.from(testContent);
      const { encryptedBuffer } = await encryptionUtil.encryptFile(
        originalBuffer,
        watermarkData
      );

      // Tamper with encrypted data
      encryptedBuffer[50] = encryptedBuffer[50] ^ 0xFF;

      // Should throw error during decryption
      await expect(
        encryptionUtil.decryptFile(encryptedBuffer)
      ).rejects.toThrow();
    });
  });

  describe('File Path Operations', () => {
    const testDir = path.join(__dirname, 'test-uploads');
    const testFilePath = path.join(testDir, 'test-file.txt');
    const encryptedFilePath = path.join(testDir, 'encrypted-file.enc');

    beforeAll(async () => {
      await fs.mkdir(testDir, { recursive: true });
    });

    afterAll(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should encrypt file to path', async () => {
      // Create test file
      await fs.writeFile(testFilePath, testContent);

      // Encrypt to path
      await encryptionUtil.encryptFileToPath(
        testFilePath,
        encryptedFilePath,
        watermarkData
      );

      // Verify encrypted file exists
      const exists = await fs.access(encryptedFilePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Verify encrypted file is different
      const originalContent = await fs.readFile(testFilePath);
      const encryptedContent = await fs.readFile(encryptedFilePath);
      expect(encryptedContent).not.toEqual(originalContent);
    });

    it('should decrypt file from path', async () => {
      // First encrypt a file
      await fs.writeFile(testFilePath, testContent);
      await encryptionUtil.encryptFileToPath(
        testFilePath,
        encryptedFilePath,
        watermarkData
      );

      // Decrypt from path
      const { fileBuffer, watermarkData: extractedWatermark } = 
        await encryptionUtil.decryptFileFromPath(encryptedFilePath);

      expect(fileBuffer.toString()).toBe(testContent);
      expect(extractedWatermark.ownerId).toBe(watermarkData.ownerId);
    });
  });

  describe('Watermark Functionality', () => {
    it('should embed watermark with all required fields', async () => {
      const buffer = Buffer.from(testContent);
      const { encryptedBuffer } = await encryptionUtil.encryptFile(
        buffer,
        watermarkData
      );

      const { watermarkData: extracted } = await encryptionUtil.decryptFile(
        encryptedBuffer
      );

      expect(extracted).toMatchObject(watermarkData);
    });

    it('should handle complex watermark data', async () => {
      const complexWatermark = {
        ownerId: 'user123',
        timestamp: new Date().toISOString(),
        username: 'testuser',
        metadata: {
          department: 'IT',
          classification: 'confidential',
          tags: ['important', 'secret']
        }
      };

      const buffer = Buffer.from(testContent);
      const { encryptedBuffer } = await encryptionUtil.encryptFile(
        buffer,
        complexWatermark
      );

      const { watermarkData: extracted } = await encryptionUtil.decryptFile(
        encryptedBuffer
      );

      expect(extracted).toMatchObject(complexWatermark);
      expect(extracted.metadata.tags).toEqual(['important', 'secret']);
    });
  });

  describe('Secure Filename Generation', () => {
    it('should generate unique filenames', () => {
      const filename1 = encryptionUtil.generateSecureFilename('test.pdf');
      const filename2 = encryptionUtil.generateSecureFilename('test.pdf');

      expect(filename1).not.toBe(filename2);
      expect(filename1).toMatch(/^[a-f0-9]{32}\.pdf\.enc$/);
      expect(filename2).toMatch(/^[a-f0-9]{32}\.pdf\.enc$/);
    });

    it('should preserve file extension', () => {
      const filename = encryptionUtil.generateSecureFilename('document.docx');
      expect(filename).toMatch(/\.docx\.enc$/);
    });

    it('should handle files without extension', () => {
      const filename = encryptionUtil.generateSecureFilename('README');
      expect(filename).toMatch(/^[a-f0-9]{32}\.enc$/);
    });
  });

  describe('Large File Handling', () => {
    it('should handle files larger than 1MB', async () => {
      // Create 2MB buffer
      const largeBuffer = Buffer.alloc(2 * 1024 * 1024);
      largeBuffer.fill('X');

      const { encryptedBuffer } = await encryptionUtil.encryptFile(
        largeBuffer,
        watermarkData
      );

      const { fileBuffer } = await encryptionUtil.decryptFile(encryptedBuffer);

      expect(fileBuffer.length).toBe(largeBuffer.length);
      expect(fileBuffer.toString()).toBe(largeBuffer.toString());
    });
  });
});