const Hoax = require('./Hoax');
const User = require('../user/User');
const NotFoundException = require('../error/NotFoundException');
// const Sequelize = require('sequelize');
// const sequalize = require('../config/database');

const save = async (body, user) => {
  const hoax = {
    content: body.content,
    timestamp: Date.now(),
    userid: user.id,
  };
  await Hoax.create(hoax);
};

const getHoaxes = async (page, size = 10, userId) => {
  let where = {};
  if(userId) 
  {
    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('user_not_found');    
    }
    where = {id : userId};
  }

  const pageSize = size;
  const hoaxesWithCount = await Hoax.findAndCountAll({
    attributes: ['id', 'content', 'timestamp'],
    include: {
      model: User,
      as: 'user',
      attributes: ['id', 'username', 'email', 'image'],
      where,
    },
    order: [['id', 'DESC']],
    limit: size,
    offset: page * pageSize,
  });
  return {
    content: hoaxesWithCount.rows,
    page,
    size,
    totalPages: Math.ceil(hoaxesWithCount.count / pageSize),
  };
};


module.exports = { save, getHoaxes };
