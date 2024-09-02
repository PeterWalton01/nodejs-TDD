/* eslint-disable no-undef */
const request = require('supertest');
const app = require('../src/app');
const FileAttachement = require('../src/file/FileAttachement');
// const User = require('../src/user/User');
const en = require('../locales/en/translation.json');
const is = require('../locales/is/translation.json');
// const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const config = require('config');

const { uploadDir, attachmentDir } = config;

const attachmentFolder = path.join('.', uploadDir, attachmentDir);

beforeEach(async () => {
  await FileAttachement.destroy({ truncate: true });
});

const uploadFile = async (file = 'test-png.png', options = {}) => {
  let agent = request(app).post('/api/1.0/hoaxes/attachments');
  if (options.language) {
    agent.set('Accept-Language', options.language);
  }
  return await agent.attach(
    'file',
    path.join('.', '__test__', 'resources', file),
  );
};

describe('Upload file for hoax', () => {
  it('return 200 after a successful upload', async () => {
    const response = await uploadFile();
    expect(response.status).toBe(200);
  });

  it('saves dynamicFilename, uploadDate as attachment object in the database', async () => {
    const beforeSubmission = Date.now();
    await uploadFile();
    const attachments = await FileAttachement.findAll();
    const attachment = attachments[0];
    expect(attachment.filename).not.toBe('test-png.png');
    expect(attachment.uploadDate.getTime()).toBeGreaterThan(beforeSubmission);
  });

  it('saves file to attachments folder', async () => {
    await uploadFile();
    const attachments = await FileAttachement.findAll();
    const attachment = attachments[0];
    const filePath = path.join('.', attachmentFolder, attachment.filename);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it.each`
    file              | type
    ${'test-png.png'} | ${'image/png'}
    ${'test-png'}     | ${'image/png'}
    ${'test-gif.gif'} | ${'image/gif'}
    ${'test-jpg.jpg'} | ${'image/jpeg'}
    ${'test-pdf.pdf'} | ${'application/pdf'}
    ${'test-txt.txt'} | ${'unknown'}
  `('saves file type of $type to the database', async ({ file, type }) => {
    await uploadFile(file);
    const attachments = await FileAttachement.findAll();
    const attachment = attachments[0];
    expect(attachment.fileType).toBe(type);
  });

  it.each`
    file              | fileExtention
    ${'test-png.png'} | ${'png'}
    ${'test-png'}     | ${'png'}
    ${'test-gif.gif'} | ${'gif'}
    ${'test-jpg.jpg'} | ${'jpg'}
    ${'test-pdf.pdf'} | ${'pdf'}
    ${'test-txt.txt'} | ${''}
  `(
    'saves filename $file with extension of $fileExtention to the database',
    async ({ file, fileExtention }) => {
      await uploadFile(file);
      const attachments = await FileAttachement.findAll();
      const attachment = attachments[0];
      if (attachment.filename === 'test-txt.txt') {
        expect(attachment.filename.endsWith('.txt')).not.toBe(true);
      } else {
        expect(attachment.filename.endsWith(fileExtention)).toBe(true);
      }
      const filePath = path.join('.', attachmentFolder, attachment.filename);
      expect(fs.existsSync(filePath)).toBe(true);
    },
  );

  it('returns 400 when uploaded file size is greater than 5mb', async () => {
    const filePath = path.join('.', '__test__', 'resources', 'largefile');
    fs.writeFileSync(filePath, 'a'.repeat(5 * 1024 * 1024) + 'a');

    const response = await uploadFile('largefile');
    expect(response.status).toBe(400);

    fs.unlinkSync(filePath);
  });

  it('returns 200 when uploaded file size 5mb', async () => {
    const filePath = path.join('.', '__test__', 'resources', 'largefile');
    fs.writeFileSync(filePath, 'a'.repeat(5 * 1024 * 1024));

    const response = await uploadFile('largefile');
    expect(response.status).toBe(200);

    fs.unlinkSync(filePath);
  });

  it.each`
    language | message
    ${'en'}  | ${en.attachment_size_limit}
    ${'is'}  | ${is.attachment_size_limit}
  `(
    'returns a messge of $message when an attempt is made to upload a file larger than 5MB when in the language $language',
    async ({ language, message }) => {
      const filePath = path.join('.', '__test__', 'resources', 'largefile');
      fs.writeFileSync(filePath, 'a'.repeat(5 * 1024 * 1024) + 'a');

      const nowInMilliSec = Date.now();
      const response = await uploadFile('largefile', {language});
      const error = response.body;
      expect(error.path).toBe('/api/1.0/hoaxes/attachments');
      expect(error.message).toBe(message);
      expect(error.timestamp).toBeGreaterThan(nowInMilliSec);

      fs.unlinkSync(filePath);
    },
  );
  
  it('retruns the id of an attachment in the response', async () => {
    const response = await uploadFile();
    expect(Object.keys(response.body)).toEqual(['id']);
  });
});
