const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const fs = require('fs');
const app = require('../src/server');
const User = require('../src/models/User');
const File = require('../src/models/File');

let mongoServer;
let user1Token, user2Token;
let user1Id, user2Id;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create test users
  const user1Response = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'user1',
      email: 'user1@example.com',
      password: 'password123'
    });
  user1Token = user1Response.body.data.token;
  user1Id = user1Response.body.data.user.id;

  const user2Response = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'user2',
      email: 'user2@example.com',
      password: 'password123'
    });
  user2Token = user2Response.body.data.token;
  user2Id = user2Response.body.data.user.id;

  // Create uploads directory
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();

  // Clean up uploads directory
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  if (fs.existsSync(uploadDir)) {
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }
});

afterEach(async () => {
  await File.deleteMany({});
});

describe('File Management Tests', () => {
  describe('POST /api/files/upload', () => {
    it('should upload and encrypt file successfully', async () => {
      // Create a test file
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'This is a test file');

      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${user1Token}`)
        .attach('file', testFilePath)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.file.originalName).toBe('test-file.txt');
      expect(response.body.data.file.owner).toBe(user1Id);
      expect(response.body.data.file.watermarkData.embedded).toBe(true);

      // Clean up test file
      fs.unlinkSync(testFilePath);
    });

    it('should fail without authentication', async () => {
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test');

      const response = await request(app)
        .post('/api/files/upload')
        .attach('file', testFilePath)
        .expect(401);

      expect(response.body.success).toBe(false);

      fs.unlinkSync(testFilePath);
    });

    it('should fail without file', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/files', () => {
    let fileId;

    beforeEach(async () => {
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${user1Token}`)
        .attach('file', testFilePath);

      fileId = uploadResponse.body.data.file._id;
      fs.unlinkSync(testFilePath);
    });

    it('should get owned files', async () => {
      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ownedFiles.length).toBe(1);
      expect(response.body.data.ownedFiles[0]._id).toBe(fileId);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/files')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/files/:fileId/share', () => {
    let fileId;

    beforeEach(async () => {
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${user1Token}`)
        .attach('file', testFilePath);

      fileId = uploadResponse.body.data.file._id;
      fs.unlinkSync(testFilePath);
    });

    it('should share file with another user', async () => {
      const response = await request(app)
        .post(`/api/files/${fileId}/share`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ userId: user2Id })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.file.sharedWith.length).toBe(1);
    });

    it('should fail when non-owner tries to share', async () => {
      const response = await request(app)
        .post(`/api/files/${fileId}/share`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ userId: user2Id })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should fail when sharing with non-existent user', async () => {
      const response = await request(app)
        .post(`/api/files/${fileId}/share`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ userId: new mongoose.Types.ObjectId() })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/files/:fileId/download', () => {
    let fileId;

    beforeEach(async () => {
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test download content');

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${user1Token}`)
        .attach('file', testFilePath);

      fileId = uploadResponse.body.data.file._id;
      fs.unlinkSync(testFilePath);
    });

    it('should download file as owner', async () => {
      const response = await request(app)
        .get(`/api/files/${fileId}/download`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.toString()).toContain('Test download content');
    });

    it('should download file as shared user', async () => {
      // Share file with user2
      await request(app)
        .post(`/api/files/${fileId}/share`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ userId: user2Id });

      // Download as user2
      const response = await request(app)
        .get(`/api/files/${fileId}/download`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response.body.toString()).toContain('Test download content');
    });

    it('should fail when unauthorized user tries to download', async () => {
      const response = await request(app)
        .get(`/api/files/${fileId}/download`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/files/:fileId', () => {
    let fileId;

    beforeEach(async () => {
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${user1Token}`)
        .attach('file', testFilePath);

      fileId = uploadResponse.body.data.file._id;
      fs.unlinkSync(testFilePath);
    });

    it('should delete file as owner', async () => {
      const response = await request(app)
        .delete(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify file is marked as deleted
      const file = await File.findById(fileId);
      expect(file.isDeleted).toBe(true);
    });

    it('should fail when non-owner tries to delete', async () => {
      const response = await request(app)
        .delete(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/files/:fileId/audit-logs', () => {
    let fileId;

    beforeEach(async () => {
      const testFilePath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Test content');

      const uploadResponse = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${user1Token}`)
        .attach('file', testFilePath);

      fileId = uploadResponse.body.data.file._id;
      fs.unlinkSync(testFilePath);

      // Perform some actions
      await request(app)
        .get(`/api/files/${fileId}/download`)
        .set('Authorization', `Bearer ${user1Token}`);
    });

    it('should get audit logs as owner', async () => {
      const response = await request(app)
        .get(`/api/files/${fileId}/audit-logs`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logs.length).toBeGreaterThan(0);
      expect(response.body.data.logs[0].action).toBeDefined();
    });

    it('should fail when non-owner tries to view audit logs', async () => {
      const response = await request(app)
        .get(`/api/files/${fileId}/audit-logs`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});