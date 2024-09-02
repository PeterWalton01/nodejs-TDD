/* eslint-disable no-undef */
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const Hoax = require('../src/hoax/Hoax');
const FileAttachement = require('../src/file/FileAttachement');
const en = require('../locales/en/translation.json');
const is = require('../locales/is/translation.json');

beforeEach(async () => {
  // true is changed to {cascade: true} for
  // compatibility with databases other than sqlite
  await FileAttachement.destroy({ truncate: true });
  await User.destroy({ truncate: { cascade: true } });
});

const addFileAttachment = async (hoaxId) => {
  await FileAttachement.create({
    filename: `test-file-for-hoadId-${hoaxId}`,
    fileType: 'image/png',
    hoaxId: hoaxId,
  });
};

describe('Listing all hoaxes', () => {
  const getHoaxes = () => {
    let agent = request(app).get('/api/1.0/hoaxes');
    return agent;
  };

  const addHoaxes = async (hostCount) => {
    const hoaxIds = [];
    for (let i = 0; i < hostCount; i++) {
      const user = await User.create({
        username: `user${i + 1}`,
        email: `user${i + 1}@mail.com`,
      });
      const hoax = await Hoax.create({
        content: `Content ${i + 1}`,
        timestamp: Date.now(),
        userid: user.id,
      });
      hoaxIds.push(hoax.id);
    }
    return hoaxIds;
  };

  it('returns 200 if there are no hoaxes in the database', async () => {
    const response = await getHoaxes();
    expect(response.status).toBe(200);
  });

  it('returns a hoax page object', async () => {
    const response = await getHoaxes();
    expect(response.body).toEqual({
      content: [],
      page: 0,
      size: 10,
      totalPages: 0,
    });
  });

  it('returns 10 users when there are 11 in the database', async () => {
    await addHoaxes(11);
    const response = await getHoaxes();
    expect(response.body.content.length).toBe(10);
  }, 10000);

  it('returns only id, content, user object and timestamp in the response', async () => {
    await addHoaxes(11);
    const response = await getHoaxes();
    const hoax = response.body.content[0];
    const hoaxKeys = Object.keys(hoax);
    const userKeys = Object.keys(hoax.user);

    expect(hoaxKeys).toEqual(['id', 'content', 'timestamp', 'user']);
    expect(userKeys).toEqual(['id', 'username', 'email', 'image']);
  },10000);

  it('returns fileAttachement with filename and file type if the hoax has any', async () => {
    const hoaxIds = await addHoaxes(1);
    await addFileAttachment(hoaxIds[0]);
    const response = await getHoaxes();
    const hoax = response.body.content[0];
    const hoaxKeys = Object.keys(hoax);
    expect(hoaxKeys).toEqual([
      'id',
      'content',
      'timestamp',
      'user',
      'fileAttachment',
    ]);
    const fileAttachmentKeys = Object.keys(hoax.fileAttachment);
    expect(fileAttachmentKeys).toEqual(['filename', 'fileType']);
  });

  it('returns 2 pages when the database contains 15 hoaxes users', async () => {
    await addHoaxes(15);
    const response = await getHoaxes();
    const pages = response.body.totalPages;
    expect(pages).toBe(2);
  }, 10000);

  it('returns the second page when page is set to 1 in the request', async () => {
    await addHoaxes(11);
    const response = await getHoaxes().query({ page: 1 });
    // Don't forgat reverse order so user1 not user11
    expect(response.body.content[0].user.username).toBe('user1');
    expect(response.body.page).toBe(1);
  }, 10000);

  it('returns the first page when page is set below zero in the request', async () => {
    await addHoaxes(11);
    const response = await getHoaxes().query({ page: -5 });
    expect(response.body.page).toBe(0);
  }, 10000);

  it('returns 5 hoaxes and a size indicator of 5 when this is set in the request', async () => {
    await addHoaxes(11);
    const response = await getHoaxes().query({ size: 5 });
    expect(response.body.content.length).toBe(5);
    expect(response.body.size).toBe(5);
  }, 10000);

  it('returns 10 users when the requested size is 1999', async () => {
    await addHoaxes(12);
    const response = await getHoaxes().query({ size: 1000 });
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  }, 10000);

  it('returns 10 hoaxes and page size value of 10 when the requested size is less than or equal 0', async () => {
    await addHoaxes(12);
    const response = await getHoaxes().query({ size: -50 });
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  }, 10000);

  it('returns 10 users and page size value of 10 when neither parameter is specified', async () => {
    await addHoaxes(12);
    const response = await getHoaxes();
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
    expect(response.body.page).toBe(0);
  }, 10000);

  it('returns 10 hoaxes and page size value of 10 when parameters are illegal', async () => {
    await addHoaxes(12);
    const response = await getHoaxes().query({ page: 'page', size: 'size' });
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
    expect(response.body.page).toBe(0);
  }, 10000);

  it('returns hoaxes running from new to old', async () => {
    await addHoaxes(12);
    const response = await getHoaxes();

    const firstHoax = response.body.content[0];
    const lastHoax = response.body.content[9];
    expect(firstHoax.timestamp).toBeGreaterThan(lastHoax.timestamp);
  },10000);
});

describe('Listing all hoaxes for a user', () => {
  const addUser = async (name = 'user1') => {
    return await User.create({
      username: name,
      email: `${name}@mail.com`,
    });
  };

  const getHoaxes = (id) => {
    let agent = request(app).get(`/api/1.0/users/${id}/hoaxes`);
    return agent;
  };

  const addHoaxes = async (hoaxCount, userId) => {
    const hoaxIds = [];
    for (let i = 0; i < hoaxCount; i++) {
      const hoax = await Hoax.create({
        content: `Content ${i + 1}`,
        timestamp: Date.now(),
        userid: userId,
      });
      hoaxIds.push(hoax.id);
    }
    return hoaxIds;
  };

  it('returns 200 if there are no hoaxes in the database', async () => {
    const user = await addUser();
    const response = await getHoaxes(user.id);
    expect(response.status).toBe(200);
  });

  it('returns 404 when the users does not exist', async () => {
    const response = await getHoaxes(5);
    expect(response.status).toBe(404);
  });

  it.each`
    language | message
    ${'en'}  | ${en.user_not_found}
    ${'is'}  | ${is.user_not_found}
  `(
    ' returns a error object with $message when user is not found and the language is $language',
    async ({ language, message }) => {
      const nowInMillis = Date.now();
      const response = await getHoaxes(5).set('Accept-Language', language);
      const error = response.body;
      expect(error.message).toBe(message);
      expect(error.path).toBe('/api/1.0/users/5/hoaxes');
      expect(nowInMillis).toBeLessThan(error.timestamp);
    },
  );

  it('returns a hoax page object', async () => {
    const user = await addUser();
    const response = await getHoaxes(user.id);
    expect(response.body).toEqual({
      content: [],
      page: 0,
      size: 10,
      totalPages: 0,
    });
  });

  it('returns 10 users when there are 11 in the database', async () => {
    const user = await addUser();
    await addHoaxes(11, user.id);
    const response = await getHoaxes(user.id);
    expect(response.body.content.length).toBe(10);
  });

  it('return 5 hoaxes for user1 when there are also 6 hoaxes for user 2', async () => {
    const user1 = await addUser();
    const user2 = await addUser('user2');
    await addHoaxes(5, user1.id);
    await addHoaxes(6, user2.id);
    const response = await getHoaxes(user1.id);
    expect(response.body.content.length).toBe(5);
  });

  it('returns only id, content, user object and timestamp in the response', async () => {
    const user = await addUser();
    await addHoaxes(11, user.id);
    const response = await getHoaxes(user.id);
    const hoax = response.body.content[0];
    const hoaxKeys = Object.keys(hoax);
    const userKeys = Object.keys(hoax.user);

    expect(hoaxKeys).toEqual(['id', 'content', 'timestamp', 'user']);
    expect(userKeys).toEqual(['id', 'username', 'email', 'image']);
  });

  it('returns fileAttachement with filename and file type if the hoax has any', async () => {
    const user = await addUser();
    const hoaxIds = await addHoaxes(1, user.id);
    await addFileAttachment(hoaxIds[0]);
    const response = await getHoaxes(user.id);
    const hoax = response.body.content[0];
    const hoaxKeys = Object.keys(hoax);
    expect(hoaxKeys).toEqual([
      'id',
      'content',
      'timestamp',
      'user',
      'fileAttachment',
    ]);
    const fileAttachmentKeys = Object.keys(hoax.fileAttachment);
    expect(fileAttachmentKeys).toEqual(['filename', 'fileType']);
  });

  it('returns 2 pages when the database contains 15 hoaxes users', async () => {
    const user = await addUser();
    await addHoaxes(15, user.id);
    const response = await getHoaxes(user.id);
    const pages = response.body.totalPages;
    expect(pages).toBe(2);
  }, 10000);

  it('returns the second page when page is set to 1 in the request', async () => {
    const user = await addUser();
    await addHoaxes(11, user.id);
    const response = await getHoaxes(user.id).query({ page: 1 });
    // Don't forgat reverse order so user1 not user11
    expect(response.body.content[0].user.username).toBe('user1');
    expect(response.body.page).toBe(1);
  });

  it('returns the first page when page is set below zero in the request', async () => {
    const user = await addUser();
    await addHoaxes(11, user.id);
    const response = await getHoaxes(user.id).query({ page: -5 });
    expect(response.body.page).toBe(0);
  });

  it('returns 5 hoaxes and a size indicator of 5 when this is set in the request', async () => {
    const user = await addUser();
    await addHoaxes(11, user.id);
    const response = await getHoaxes(user.id).query({ size: 5 });
    expect(response.body.content.length).toBe(5);
    expect(response.body.size).toBe(5);
  }, 10000);

  it('returns 10 users when the requested size is 1999', async () => {
    const user = await addUser();
    await addHoaxes(12, user.id);
    const response = await getHoaxes(user.id).query({ size: 1000 });
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  });

  it('returns 10 hoaxes and page size value of 10 when the requested size is less than or equal 0', async () => {
    const user = await addUser();
    await addHoaxes(12, user.id);
    const response = await getHoaxes(user.id).query({ size: -50 });
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  });

  it('returns 10 users and page size value of 10 when neither parameter is specified', async () => {
    const user = await addUser();
    await addHoaxes(12, user.id);
    const response = await getHoaxes(user.id);
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
    expect(response.body.page).toBe(0);
  });

  it('returns 10 hoaxes and page size value of 10 when parameters are illegal', async () => {
    const user = await addUser();
    await addHoaxes(12, user.id);
    const response = await getHoaxes(user.id).query({
      page: 'page',
      size: 'size',
    });
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
    expect(response.body.page).toBe(0);
  });

  it('returns hoaxes running from new to old', async () => {
    const user = await addUser();
    await addHoaxes(12, user.id);
    const response = await getHoaxes(user.id);

    const firstHoax = response.body.content[0];
    const lastHoax = response.body.content[9];
    expect(firstHoax.timestamp).toBeGreaterThan(lastHoax.timestamp);
  });
});
