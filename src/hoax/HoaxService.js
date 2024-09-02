const Hoax = require('./Hoax');
const User = require('../user/User');
const NotFoundException = require('../error/NotFoundException');
const FileService = require('../file/FileService');
const FileAttachment = require('../file/FileAttachement');
const ForbiddenException = require('../error/ForbiddenException');
// const Sequelize = require('sequelize');
// const sequalize = require('../config/database');

const save = async (body, user) => {
  const hoax = {
    content: body.content,
    timestamp: Date.now(),
    userid: user.id,
  };
  const { id } = await Hoax.create(hoax);
  if (body.fileAttachment) {
    await FileService.associateFileToHoax(body.fileAttachment, id);
  }
};

const getHoaxes = async (page, size = 10, userId) => {
  let where = {};
  if (userId) {
    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('user_not_found');
    }
    where = { id: userId };
  }

  const pageSize = size;
  const hoaxesWithCount = await Hoax.findAndCountAll({
    attributes: ['id', 'content', 'timestamp'],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email', 'image'],
        where,
      },
      {
        model: FileAttachment,
        as: 'fileAttachment',
        attributes: ['filename', 'fileType'],
      },
    ],
    order: [['id', 'DESC']],
    limit: size,
    offset: page * pageSize,
  });

  // If there is no attachment, hoaxesWithCount.rows.fileAttachment
  // is null so remove it.

  const newContent = hoaxesWithCount.rows.map((hoaxSequelize) => {
    const hoaxAsJSON = hoaxSequelize.get({ plain: true });
    if (hoaxAsJSON.fileAttachment === null) {
      delete hoaxAsJSON.fileAttachment;
    }
    return hoaxAsJSON;
  });

  return {
    content: newContent,
    page,
    size,
    totalPages: Math.ceil(hoaxesWithCount.count / pageSize),
  };
};

const getHoax = async (id) => {
  const hoax = await Hoax.findOne({ where: { id }});
  return hoax;
};

const deleteHoax = async (id, userid) => {

  const  hoaxToBeDeleted = 
    await Hoax.findOne({
     where: {id, userid},
     include: { model: FileAttachment} 
   });
  
  if(!hoaxToBeDeleted) {
    throw new ForbiddenException('unautorised_hoax_delete');
  }
  const hoaxJSON = hoaxToBeDeleted.get({plain: true});
  if( hoaxJSON.fileAttachment !== null){
    await FileService.deleteAttachment(hoaxJSON.fileAttachment.filename);
  }
  await hoaxToBeDeleted.destroy();
};

module.exports = { save, getHoaxes, getHoax, deleteHoax };
