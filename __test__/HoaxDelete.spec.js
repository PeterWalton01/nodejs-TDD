/* eslint-disable no-undef */
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const Hoax = require('../src/hoax/Hoax');
const FileAttachment = require('../src/file/FileAttachement');

const bcrypt = require('bcrypt');
const en = require('../locales/en/translation.json');
const is = require('../locales/is/translation.json');
const fs = require('fs');
const path = require('path');
const config = require('config');

const { uploadDir, attachmentDir } = config;

const attachmentFolder = path.join('.', uploadDir, attachmentDir);

const filename = 'test-file-hoax-delete' + Date.now();
const targetPath = path.join(attachmentFolder, filename);
const testfilePath = path.join('.', '__test__', 
  'resources', 'test-png.png');

beforeEach(async () => {
    // true is changed to {cascade: true} for 
    // compatibility with databases other than sqlite  
    await User.destroy({ truncate: {cascade: true} });
    if(fs.existsSync(targetPath)){
      fs.unlinkSync(targetPath);
    }
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
        const response = 
            await request(app).post('/api/1.0/auth').send(options.auth);
        token = response.body.token;
        return token; 
      }
    };

  const addHoax = async (userid) => {
    return await Hoax.create({
      content: 'Required content',
      timestamp: Date.now(),
      userid
    });
  };

  const addFileAttachment = async (hoaxId) => {
    fs.copyFileSync(testfilePath, targetPath);
    return await FileAttachment.create({
       filename: filename,
       uploadDate: Date.now(),
       hoaxId: hoaxId
    });
  };
  
  const deleteHoax = async (id = 5, options = {}) => {
    let agent = request(app).delete('/api/1.0/hoaxes/' + id);
    if (options.language) {
      agent.set('Accept-Language', options.language);
    }
    if(options.token) {
      agent.set('Authorization', `Bearer ${options.token}`);
    };
    return await agent.send();
  };

  describe('User Hoax', () => {
    it('response 403 forbidden when there is a delete request without authorisation', async () => {
      const response = await deleteHoax();
      expect(response.status).toBe(403);
    });

    it('response 403 forbidden when there is a delete request without valid token', async () => {
        const response = await deleteHoax(options ={token: 'bad token'});
        expect(response.status).toBe(403);
      });
  
    it.each`
      language | message
      ${'en'}  | ${en.unautorised_hoax_delete}
      ${'is'}  | ${is.unautorised_hoax_delete}
    `(
      'sends a forbidden response contains a message $message when the language is $language',
      async ({ language, message }) => {
        const timeInMili = new Date().getTime();
        const response = await deleteHoax((id = 5), 
        { language });
  
        expect(response.body.timestamp).toBeGreaterThan(timeInMili);
        expect(response.body.path).toBe('/api/1.0/hoaxes/5');
        expect(response.body.message).toBe(message);
      },
    );
  
    it('returns forbidden in response when credentials are correct but user is different ', async () => {
      const user = await addUser();
      const hoax = await addHoax(user.id);
      const user2 = await addUser({ ...activeUser, username: 'user2',
                                   email: 'user2@mail.com' });
      const token = await auth({ auth: {email: user2.email, password: 'P4ssword'}  });
      const response = deleteHoax(hoax.id, { token : token });
      expect((await response).status).toBe(403);
    });
  
    // it('returns 403 when the token is not valid', async () => {
    //    const response  = await deleteUser( 5, {token: '123'});
    //    expect(response.status).toBe(403); 
    // });
  
    it('return 200 for a sucessful delete for an authorised user', async () => {
      const user = await addUser();
      const token = await auth( {auth: credentials });
      const hoax = await addHoax(user.id);
      const response = await deleteHoax(hoax.id, { token : token });
      expect(response.status).toBe(200);
    });

    it('following indication of a sucessful delete for an authorised user, the hoax is not in the database', async () => {
      const user = await addUser();
      const token = await auth( {auth: credentials });
      const hoax = await addHoax(user.id);
      await deleteHoax(hoax.id, { token : token });
      const deletedHoax = await Hoax.findOne({ where: { id: hoax.id}});
      expect(deletedHoax).toBeNull();
    });

    it('removes the fileAttachment from the database when the user deletes their hoax', async () => {
      const user = await addUser();
      const token = await auth( {auth: credentials });
      const hoax = await addHoax(user.id);
      const attachment = await addFileAttachment(hoax.id);
      await deleteHoax(hoax.id, { token : token });
      const deletedAttachment = await FileAttachment.findOne({ where: { id: attachment.id}});
      expect(deletedAttachment).toBeNull();
    });
  
    it('removes the file from storage when the user deletes their hoax', async () => {
      const user = await addUser();
      const token = await auth( {auth: credentials });
      const hoax = await addHoax(user.id);
      await addFileAttachment(hoax.id);
      await deleteHoax(hoax.id, { token : token });
      expect(fs.existsSync(targetPath)).toBe(false);
    });
  
  });

