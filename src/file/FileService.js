const fs = require('fs');
const path = require('path');
const config = require('config');
const FileType = require('file-type-cjs');
const Hoax = require('../hoax/Hoax');
const { randomString } = require('../shared/genertator');
const FileAttachment = require('./FileAttachement');
const Sequelize = require('sequelize');

const { uploadDir, profileDir, attachmentDir } = config;
const profileFolder = path.join('.', uploadDir, profileDir);
const attachmentFolder = path.join('.', uploadDir, attachmentDir);

const ONE_DAY = 24 * 60 * 60 * 1000;

const createFolders = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  if (!fs.existsSync(profileFolder)) {
    fs.mkdirSync(profileFolder);
  }
  if (!fs.existsSync(attachmentFolder)) {
    fs.mkdirSync(attachmentFolder);
  }
};

const saveProfileImage = async (base64File) => {
  const filename = randomString(32);
  if (!base64File) {
    base64File = 'None';
  }
  const filePath = path.join('.', profileFolder, filename);
  await fs.promises.writeFile(filePath, base64File, { encoding: 'base64' });
  return filename;
  //  return new Promise((resolve, reject) => {
  //    fs.writeFile(filePath, base64File, {encoding: 'base64'},
  //      (error) => {
  //        if(!error) {
  //         resolve(filename);
  //        } else {
  //         reject('');
  //        }
  //     }
  //   );
  //  });
};

const deleteProfileImage = async (filename) => {
  const filePath = path.join('.', profileFolder, filename);
  await fs.promises.unlink(filePath);
};

const isLessThan2mb = (buffer) => {
  return buffer.length < 2 * 1024 * 1024;
};

const isSupportedFileType = async (buffer) => {
  try {
    const type = await FileType.fromBuffer(buffer);
    if (!type || (type.mime !== 'image/png' && type.mime !== 'image/jpeg')) {
      throw new Error('unsupported_file_type');
    }
    // eslint-disable-next-line no-unused-vars
  } catch (err) {
    throw new Error('unsupported_file_type');
  }
};

const saveAttachment = async (file) => {

  let filename = randomString(32);
  let type;
  try {
    type = await FileType.fromBuffer(file.buffer);
    filename += `.${type.ext}`; 
  // eslint-disable-next-line no-unused-vars
  } catch(err) {
    type = { ext: '', mime: 'unknown' };
  }

  await fs.promises.writeFile(path.join(attachmentFolder, filename), file.buffer);
  let savedAtachment;
  try {
    savedAtachment = await FileAttachment.create({
      filename,
      uploadDate: new Date(),
      fileType: type.mime
    });
  } catch (err) {
    console.log(err.message);
  }
  return {id: savedAtachment.id};
};

const associateFileToHoax = async (attachmentId, hoaxId) => {
   const attachment = await FileAttachment.findOne({where: { id: attachmentId }});
   if(!attachment){
    return;
   }
   
   if(attachment.hoaxId){
    return;
   }

   attachment.hoaxId = hoaxId;
   await attachment.save();

};

const removeUnusedFileAttachments = async () => {
   const oneDayOld = new Date(Date.now() - ONE_DAY + 5 * 1000);

   setInterval(async () => {
    const attachments = await FileAttachment.findAll(
      {
       where: {
         uploadDate: {
           [Sequelize.Op.lt]: oneDayOld,
         },
         'hoaxId': {
           [Sequelize.Op.is]: null,
         } 
      }
     }
    );

   for(let attachment of attachments){
      const { filename } = attachment.get({ plain: true });
      await fs.promises.unlink(path.join(attachmentFolder, filename));
      await attachment.destroy();
   }
   }, ONE_DAY);

};

const deleteAttachment = async (filename) => {
   const filePath = path.join(attachmentFolder, filename);
   try {
     await  fs.promises.access(filePath);
     await fs.promises.unlink(filePath);
   // eslint-disable-next-line no-unused-vars, no-empty
   } catch(err) {
   }

};

const deleteUserFiles = async (user) => {
  if(user.image){
    await deleteProfileImage(user.image);
  }
  const attachments = await FileAttachment.findAll({
     attributes: ['filename'],
     include: {
      model: Hoax,
      where: {
        userid : user.id
      }
     }
  });
  if(attachments.length === 0) {
    return;
  }
  for( let attachment of attachments) {
    await deleteAttachment( attachment.getDataValue('filename'));
   
  } 
};

module.exports = {
  createFolders,
  saveProfileImage,
  deleteProfileImage,
  isLessThan2mb,
  isSupportedFileType,
  saveAttachment,
  associateFileToHoax,
  removeUnusedFileAttachments,
  deleteAttachment,
  deleteUserFiles,
};
