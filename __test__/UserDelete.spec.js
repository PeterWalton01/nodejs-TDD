/* eslint-disable no-undef */
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const Token = require('../src/auth/Token');
const Hoax = require('../src/hoax/Hoax');
const FileAttachment = require('../src/file/FileAttachement');
const en = require('../locales/en/translation.json');
const is = require('../locales/is/translation.json');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const config = require('config');

const { uploadDir, profileDir, attachmentDir } = config;
const profileDirectory = path.join('.', uploadDir, profileDir);
const attachmentDirectory = path.join('.', uploadDir, attachmentDir);

beforeEach(async () => {
  // true is changed to {cascade: true} for
  // compatibility with databases other than sqlite
  await User.destroy({ truncate: { cascade: true } });
});

const activeUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4ssword',
  inactive: false,
};

const credentials = { email: 'user1@mail.com', password: 'P4ssword' };

const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  return await User.create(user);
};

const auth = async (options = {}) => {
  let token;

  if (options.auth) {
    const response = await request(app)
      .post('/api/1.0/auth')
      .send(options.auth);
    token = response.body.token;
    return token;
  }
};

const deleteUser = async (id = 5, options = {}) => {
  let agent = request(app).delete('/api/1.0/users/' + id);
  if (options.language) {
    agent.set('Accept-Language', options.language);
  }
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return await agent.send();
};

describe('User Delete', () => {
  it('response forbidden when there is a delete request without authorisation', async () => {
    const response = await deleteUser();
    expect(response.status).toBe(403);
  });

  it.each`
    language | message
    ${'en'}  | ${en.unauthorised_user_delete}
    ${'is'}  | ${is.unauthorised_user_delete}
  `(
    'sends a forbidden response contains a message $message when the language is $language',
    async ({ language, message }) => {
      const timeInMili = new Date().getTime();
      const response = await deleteUser((id = 5), { language });

      expect(response.body.timestamp).toBeGreaterThan(timeInMili);
      expect(response.body.path).toBe('/api/1.0/users/5');
      expect(response.body.message).toBe(message);
    },
  );

  it('returns forbidden in response when credentials are correct but user is different ', async () => {
    await addUser();
    const userToBeDeleted = await addUser({
      ...activeUser,
      username: 'user2',
      email: 'user2@mail.com',
    });
    const token = await auth({ auth: credentials });
    const response = deleteUser(userToBeDeleted.id, { token: token });
    expect((await response).status).toBe(403);
  });

  it('returns 403 when the token is not valid', async () => {
    const response = await deleteUser(5, { token: '123' });
    expect(response.status).toBe(403);
  });

  it('return 200 for a sucessful delete for an authorised user', async () => {
    const savedUser = await addUser();
    const token = await auth({ auth: credentials });
    const response = await deleteUser(savedUser.id, { token: token });
    expect(response.status).toBe(200);
  });

  it('deletes user from database when requested by an authorised user', async () => {
    const savedUser = await addUser();
    const token = await auth({ auth: credentials });
    await deleteUser(savedUser.id, { token: token });

    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser).toBeNull();
  });

  it('deletes token from database when delete is requested by an authorised user', async () => {
    const savedUser = await addUser();
    const token = await auth({ auth: credentials });

    await deleteUser(savedUser.id, { token: token });

    const tokenInDB = await Token.findOne({ where: { token: token } });
    expect(tokenInDB).toBeNull();
  });

  it('deletes all tokens from database when delete is requested by an authorised user', async () => {
    const savedUser = await addUser();
    const token1 = await auth({ auth: credentials });
    const token2 = await auth({ auth: credentials });

    await deleteUser(savedUser.id, { token: token1 });

    const tokenInDB = await Token.findOne({ where: { token: token2 } });
    expect(tokenInDB).toBeNull();
  });

  it('deletes hoaxes from database when delete is requested by an authorised user', async () => {
    const savedUser = await addUser();
    const token = await auth({ auth: credentials });

    await request(app)
      .post('/api/1.0/hoaxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hoax content' });

    await deleteUser(savedUser.id, { token: token });

    const hoaxInDB = await Hoax.findOne({ where: { userid: savedUser.id } });
    expect(hoaxInDB).toBeNull();
  });

  it('removes profile file when user is deleted', async () => {
    const user = await addUser();
    const token = await auth({ auth: credentials });
    const storedFileName = 'profile-image-for-user1';
    const testFilePath = path.join(
      '.',
      '__test__',
      'resources',
      'test-png.png',
    );
    const targetPath = path.join(profileDirectory, storedFileName);
    fs.copyFileSync(testFilePath, targetPath);
    user.image = storedFileName;
    await user.save();
    await deleteUser(user.id, { token });
    expect(fs.existsSync(targetPath)).toBe(false);
  });

  it('deletes hoaxes attachment from storage and database when delete is requested by an authorised user', async () => {
    const savedUser = await addUser();
    const token = await auth({ auth: credentials });
    const storedFileName = 'hoax-attachment-for-user1';
    const testFilePath = path.join(
      '.',
      '__test__',
      'resources',
      'test-png.png',
    );
    const targetPath = path.join(attachmentDirectory, storedFileName);
    fs.copyFileSync(testFilePath, targetPath);

    const storedAttachment = await FileAttachment.create({
      filename: storedFileName
    });

    await request(app)
      .post('/api/1.0/hoaxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hoax content', fileAttachment: storedAttachment.id });

    await deleteUser(savedUser.id, { token: token });

    const storedAttachmentAfterDeletion = 
       await FileAttachment.findOne({ where: {id: storedAttachment.id}});

    expect(storedAttachmentAfterDeletion).toBeNull();
    expect(fs.existsSync(targetPath)).toBe(false);
  });
});
