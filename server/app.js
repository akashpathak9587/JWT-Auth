const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const ACCESS_EXPIRES = process.env.ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES_SECONDS = parseInt(process.env.REFRESH_EXPIRES_SECONDS || String(60 * 60 * 24 * 7), 10);

let pgClient = null;

async function initPostgres() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not provided — Postgres required');
  }
  pgClient = new Client({ connectionString });
  await pgClient.connect();
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL
    );
  `);
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL
    );
  `);
}

async function findUser(username) {
  const res = await pgClient.query('SELECT username, password_hash FROM users WHERE username=$1', [username]);
  return res.rows[0] || null;
}

async function createUser(username, passwordHash) {
  await pgClient.query('INSERT INTO users(username, password_hash) VALUES($1, $2)', [username, passwordHash]);
}

async function saveRefreshToken(token, username, expiresAt) {
  await pgClient.query('INSERT INTO refresh_tokens(token, username, expires_at) VALUES($1, $2, $3)', [token, username, expiresAt]);
}

async function findRefreshToken(token) {
  const res = await pgClient.query('SELECT token, username, expires_at FROM refresh_tokens WHERE token=$1', [token]);
  return res.rows[0] || null;
}

async function deleteRefreshToken(token) {
  await pgClient.query('DELETE FROM refresh_tokens WHERE token=$1', [token]);
}

// ensure demo user exists
async function ensureDemoUser() {
  const u = await findUser('admin');
  if (!u) {
    const hash = bcrypt.hashSync('password', 10);
    await createUser('admin', hash);
    console.log('Created demo user: admin / password');
  }
}

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    const existing = await findUser(username);
    if (existing) return res.status(409).json({ error: 'User already exists' });
    const hash = bcrypt.hashSync(password, 10);
    await createUser(username, hash);
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
    const user = await findUser(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const accessToken = jwt.sign({ username }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
    const refreshToken = jwt.sign({ username, kind: 'refresh' }, JWT_SECRET, { expiresIn: Math.floor(REFRESH_EXPIRES_SECONDS) + 's' });
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000);
    await saveRefreshToken(refreshToken, username, expiresAt);
    res.json({ accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Missing refresh token' });
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    if (payload.kind !== 'refresh') return res.status(401).json({ error: 'Invalid token' });
    const stored = await findRefreshToken(refreshToken);
    if (!stored) return res.status(401).json({ error: 'Unknown refresh token' });
    const expiresAt = new Date(stored.expires_at);
    if (expiresAt && new Date() > expiresAt) {
      await deleteRefreshToken(refreshToken);
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    const newAccess = jwt.sign({ username: payload.username }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
    return res.json({ accessToken: newAccess });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/api/profile', authenticate, (req, res) => {
  res.json({ username: req.user.username });
});

// Serve built client when present
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (fsExists(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send('Not Found');
});

function fsExists(p) {
  try { return require('fs').existsSync(p); } catch (e) { return false; }
}

module.exports = { app, initPostgres, ensureDemoUser };
