/* eslint-disable no-undef */
const sequelize = require('./src/config/database');
const FileAttachment = require('./src/file/FileAttachement');

beforeAll(async () => {
  if (process.env.NODE_ENV === 'test') {
    await sequelize.sync({ force: true });
  }
  await FileAttachment.destroy({ truncate: true });
});
