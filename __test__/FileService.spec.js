/* eslint-disable no-undef */
const FileService = require('../src/file/FileService');
const fs = require('fs');
const path = require('path');
const config = require('config');
const FileAttachment = require('../src/file/FileAttachement');
const Hoax = require('../src/hoax/Hoax');
const User = require('../src/user/User');

const ONE_DAY = 24 * 60 * 60 * 1000;

const { uploadDir, profileDir, attachmentDir } = config;

const profileDirectory = path.join('.', uploadDir, profileDir);
const attachmentDirectory = path.join('.', uploadDir, attachmentDir);

describe('createFolders', () => {
  it('create upload folders', () => {
    FileService.createFolders();
    const folderName = uploadDir;
    expect(fs.existsSync(folderName)).toBe(true);
  });

  it('creates profile folder under upload folder', () => {
    FileService.createFolders();
    const profileFolder = path.join('.', profileDirectory);
    expect(fs.existsSync(profileFolder)).toBe(true);
  });

  it('creates attachment folder under upload folder', () => {
    FileService.createFolders();
    const attachmentFolder = path.join('.', attachmentDirectory);
    expect(fs.existsSync(attachmentFolder)).toBe(true);
  });
});

describe('Schedule unused file cleaning', () => {
  const filename = 'test-file' + Date.now();
  const targetPath = path.join(attachmentDirectory, filename);

  beforeEach(async () => {
    await FileAttachment.destroy({ truncate: true });
    await User.destroy({ truncate: { cascade: true}});
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  });

  const addHoax = async () => {

      const user = await User.create({
        username: 'user1',
        email: 'user1@mail.com',
      });
      const hoax = await Hoax.create({
        content: 'hoax content 1',
        timestamp: Date.now(),
        userid: user.id,
      });

    return hoax.id;
  };

  it('removes 24 old file attachment entry and file if not used in a hoax', async () => {
    if (process.env.NODE_ENV === 'test') {
      await Hoax.sync({ force: true });
      await FileAttachment.sync({ force: true });
    }
    jest.useFakeTimers();
    const testfile = path.join('.', '__test__', 'resources', 'test-png.png');

    fs.copyFileSync(testfile, targetPath);
    const uploadDate = new Date(Date.now() - ONE_DAY);
    const attachment = await FileAttachment.create({
      filename,
      uploadDate: uploadDate,
    });

    await FileService.removeUnusedFileAttachments();
    jest.advanceTimersByTime(ONE_DAY + 5 * 1000);
    // jest.useRealTimers();

    setTimeout(async () => {
      const fileAttachmentAfterRemove = await FileAttachment.findOne({
        where: { id: attachment.id },
      });
      expect(fileAttachmentAfterRemove).toBeNull();
      expect(fs.existsSync(targetPath)).toBe(false);
      return;
    }, 1000);

    jest.clearAllTimers();
  });

  it('keeps file and database entry older than 1 day if associated with a hoax', async () => {
    if (process.env.NODE_ENV === 'test') {
      await Hoax.sync({ force: true });
      await FileAttachment.sync({ force: true });
    }
    jest.useFakeTimers();
    const testfile = path.join('.', '__test__', 'resources', 'test-png.png');

    fs.copyFileSync(testfile, targetPath);
    const uploadDate = new Date(Date.now() - ONE_DAY + 60 * 60 * 1000);
    const attachment = await FileAttachment.create({
      filename,
      uploadDate: uploadDate,
    });

    await FileService.removeUnusedFileAttachments();
    jest.advanceTimersByTime(ONE_DAY + 5 * 1000);
    // jest.useRealTimers();

    setTimeout(async () => {
      const fileAttachmentAfterRemove = await FileAttachment.findOne({
        where: { id: attachment.id },
      });
      expect(fileAttachmentAfterRemove).not.toBeNull();
      expect(fs.existsSync(targetPath)).toBe(true);
      return;
    }, 1000);

    jest.clearAllTimers();
  });

  it('keeps file newer than 1 day even if not associated with a hoax', async () => {
    if (process.env.NODE_ENV === 'test') {
      await Hoax.sync({ force: true });
      await FileAttachment.sync({ force: true });
    }
    jest.useFakeTimers();
    const testfile = path.join('.', '__test__', 'resources', 'test-png.png');

    fs.copyFileSync(testfile, targetPath);
    const id = await addHoax();
    const uploadDate = new Date(Date.now() - ONE_DAY + 60 * 60 * 1000);

    const  attachment = await FileAttachment.create({
        filename,
        uploadDate: uploadDate,
        hoaxId: id,
      });


    await FileService.removeUnusedFileAttachments();
    jest.advanceTimersByTime(ONE_DAY + 5 * 1000);
    // jest.useRealTimers();

    setTimeout(async () => {
      const fileAttachmentAfterRemove = await FileAttachment.findOne({
        where: { id: attachment.id },
      });
      expect(fileAttachmentAfterRemove).not.toBeNull();
      expect(fs.existsSync(targetPath)).toBe(true);
      return;
    }, 1000);

    jest.clearAllTimers();
  });
});
