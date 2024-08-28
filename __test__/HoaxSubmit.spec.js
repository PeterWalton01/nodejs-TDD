/* eslint-disable no-undef */
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const Hoax = require('../src/hoax/Hoax');
const sequelize = require('../src/config/database');
const en = require('../locales/en/translation.json');
const is = require('../locales/is/translation.json');
const bcrypt = require('bcrypt');

beforeAll(async () => {
    if(process.env.NODE_ENV === 'test') {
      await sequelize.sync();
    }
  });
  
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
    const newUser= await User.create(user);
    return newUser;
  };

  const postHoax = async (body = null, options = {}) => {
    let agent = request(app);
    let token;
  
    if (options.auth) {
      const response = await agent.post('/api/1.0/auth').send(options.auth);
      token = response.body.token;
    }
  
    agent = request(app).post('/api/1.0/hoaxes');
    if (options.language) {
      agent.set('Accept-Language', options.language);
    }
    if (token) {
      agent.set('Authorization', `Bearer ${token}`);
    }
    if (options.token) {
      agent.set('Authorization', `Bearer ${options.token}`);
    }
    const response = await agent.send(body);
    return response;
  };



describe('Post Hoax', () => {
    it('returns 401 when a hoax is posted without authentication', async () => {
        const response = await postHoax(null);
        expect(response.status).toBe(401);
    });

    it.each`
    language | message
    ${'en'} | ${en.unauthorised_hoax_submit}
    ${'is'} | ${is.unauthorised_hoax_submit}
    `('returns a message of $message when a hoax is submitted without authorisation in language $language', async({language, message}) => {
        const timeInMillis = Date.now();
        const response = await postHoax(null, 
              {language: language});
        const error = response.body;
        expect(error.path).toBe('/api/1.0/hoaxes');
        expect(error.timestamp).toBeGreaterThan(timeInMillis);
        expect(error.message).toBe(message);


    });
    it('returns 200 when a hoax is submitted by an authorised user', async () => {
        await addUser();
        const response = 
            await postHoax({content: 'Hoax content'}, 
                   { auth: credentials });
        expect(response.status).toBe(200);
    });

    it('saves the hoax to the database when sent with a good authorisation', async () => {
      await addUser();
      await postHoax({content: 'Hoax content'}, 
                 { auth: credentials });
      const hoaxes = await Hoax.findAll();
      expect(hoaxes.length).toBe(1);

    });

    it('saves hoax and timestamp to the database', async() => {
      await addUser();
      const beforeSubmit = Date.now();
      await postHoax({content: 'Hoax content'}, 
                 { auth: credentials });
      const hoaxes = await Hoax.findAll();
      const hoax = hoaxes[0];
      expect(hoax.content).toBe('Hoax content');      
      expect(hoax.timestamp).toBeGreaterThan(beforeSubmit);      
      expect(hoax.timestamp).toBeLessThan(Date.now());      
    });

  it.each`
  language | message
  ${'en'} | ${en.hoax_submission_successful}
  ${'is'} | ${is.hoax_submission_successful}
  `('returns a successful message of $message when a hoax is save when in language $language', async ({language, message}) => {
    await addUser();
    const hoax = await postHoax({content: 'Hoax content'}, 
               { auth: credentials, language });
    expect(hoax.body.message).toBe(message);
  });

  it.each`
  language | message
  ${'en'} | ${en.validation_failure}
  ${'is'} | ${is.validation_failure}
  `('returns a 400 and message of $message when a hoax is less than 10 characters in lenght and language is $language', async ({language, message}) => {
    await addUser();
    const hoax = await postHoax({content: '123456789'}, 
               { auth: credentials, language });
    expect(hoax.body.message).toBe(message);
    expect(hoax.status).toBe(400);
  }); 
  
  it('returns a validation error body when an illegal hoax is supmitted by an authorisaed user', async () => {
    await addUser();
    const nowInMillliSeconds = Date.now();
    const response = await postHoax({content: '123456789'}, 
               { auth: credentials });
    const errors = response.body;
    expect(errors.timestamp).toBeGreaterThan(nowInMillliSeconds);
    expect(Object.keys(errors)).toEqual([
      'message', 
      'validationErrors', 
      'timestamp', 
      'path',
    ]);
    expect(errors.path).toBe('/api/1.0/hoaxes');


    
  });
  it.each`
  language | content | message
  ${'en'} | ${null} | ${en.hoax_content_size}
  ${'en'} | ${'a'.repeat(9)} | ${en.hoax_content_size}
  ${'en'} | ${'a'.repeat(5001)} | ${en.hoax_content_size}
  ${'is'} | ${null} | ${is.hoax_content_size}
  ${'is'} | ${'a'.repeat(9)} | ${is.hoax_content_size}
  ${'is'} | ${'a'.repeat(5001)} | ${is.hoax_content_size}
  `('returns $message when hoax content is not between 10 and 5000 characters and the language is $is', async ({language, content, message}) => {
    await addUser();
    const response = await postHoax({content}, 
               { auth: credentials, language });
    const errors = response.body;
    expect(errors.validationErrors.content).toBe(message);
  });

  it('stores the owner id the database', async () => {
      const user = await addUser();
      await postHoax({content: 'Hoax content'}, 
        { auth: credentials });
      const hoaxes = await Hoax.findAll();
      const hoax = hoaxes[0];
      expect(hoax.userid).toBe(user.id);

  },10000);

});