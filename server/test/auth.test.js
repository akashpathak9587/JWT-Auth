const request = require('supertest');

const hasDb = !!process.env.DATABASE_URL;
if (!hasDb) {
  console.warn('Skipping auth tests — set DATABASE_URL to run them');
  describe.skip('Auth endpoints (skip)', () => {
    test('skipped', () => {});
  });
} else {
  const { app, initPostgres } = require('../app');

  beforeAll(async () => {
    await initPostgres();
  });

  describe('Auth endpoints', () => {
    const username = 'testuser_' + Date.now();
    const password = 'secret';
    let refreshToken;
    test('register -> login -> profile -> refresh', async () => {
      const r = await request(app).post('/api/register').send({ username, password });
      expect(r.statusCode).toBe(201);

      const login = await request(app).post('/api/login').send({ username, password });
      expect(login.statusCode).toBe(200);
      expect(login.body.accessToken).toBeDefined();
      expect(login.body.refreshToken).toBeDefined();
      refreshToken = login.body.refreshToken;

      const profile = await request(app).get('/api/profile').set('Authorization', 'Bearer ' + login.body.accessToken);
      expect(profile.statusCode).toBe(200);
      expect(profile.body.username).toBe(username);

      const refresh = await request(app).post('/api/refresh').send({ refreshToken });
      expect(refresh.statusCode).toBe(200);
      expect(refresh.body.accessToken).toBeDefined();
    });
  });
}
