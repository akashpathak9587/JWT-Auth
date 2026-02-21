const express = require('express');
const path = require('path');
const fs = require('fs');
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
const REFRESH_EXPIRES_SECONDS = parseInt(process.env.REFRESH_EXPIRES_SECONDS || String(60 * 60 * 24 * 7), 10); // 7 days

const USERS_FILE = path.join(__dirname, 'users.json');

let pgClient = null;
let usingPostgres = false;

async function initPostgres() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  try {
    pgClient = new Client({ connectionString });
    await pgClient.connect();
    // create tables if not exist
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
    usingPostgres = true;
    console.log('Connected to Postgres DB');
  } catch (err) {
    console.warn('Postgres init failed, falling back to file storage:', err.message);
    pgClient = null;
    usingPostgres = false;
  }
}

function loadUsersFile() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    return [];
  }
}

function saveUsersFile(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

async function findUser(username) {
  if (usingPostgres) {
    const res = await pgClient.query('SELECT username, password_hash FROM users WHERE username=$1', [username]);
    return res.rows[0] || null;
  }
  const users = loadUsersFile();
  return users.find(u => u.username === username) || null;
}

async function createUser(username, passwordHash) {
  if (usingPostgres) {
    await pgClient.query('INSERT INTO users(username, password_hash) VALUES($1, $2)', [username, passwordHash]);
    return;
  }
  const users = loadUsersFile();
  users.push({ username, passwordHash });
  saveUsersFile(users);
}

async function saveRefreshToken(token, username, expiresAt) {
  if (usingPostgres) {
    await pgClient.query('INSERT INTO refresh_tokens(token, username, expires_at) VALUES($1, $2, $3)', [token, username, expiresAt]);
    return;
  }
  const pathFile = path.join(__dirname, 'refresh_tokens.json');
  let arr = [];
  try { arr = fs.existsSync(pathFile) ? JSON.parse(fs.readFileSync(pathFile, 'utf8') || '[]') : []; } catch(e) { arr = []; }
  arr.push({ token, username, expiresAt: expiresAt.toISOString() });
  fs.writeFileSync(pathFile, JSON.stringify(arr, null, 2), 'utf8');
}

async function findRefreshToken(token) {
  if (usingPostgres) {
    const res = await pgClient.query('SELECT token, username, expires_at FROM refresh_tokens WHERE token=$1', [token]);
    return res.rows[0] || null;
  }
  const pathFile = path.join(__dirname, 'refresh_tokens.json');
  try {
    const arr = fs.existsSync(pathFile) ? JSON.parse(fs.readFileSync(pathFile, 'utf8') || '[]') : [];
    const t = arr.find(r => r.token === token);
    if (!t) return null;
    return { token: t.token, username: t.username, expires_at: new Date(t.expiresAt) };
  } catch (e) {
    return null;
  }
}

async function deleteRefreshToken(token) {
  if (usingPostgres) {
    await pgClient.query('DELETE FROM refresh_tokens WHERE token=$1', [token]);
    return;
  }
  const pathFile = path.join(__dirname, 'refresh_tokens.json');
  try {
    const arr = fs.existsSync(pathFile) ? JSON.parse(fs.readFileSync(pathFile, 'utf8') || '[]') : [];
    const filtered = arr.filter(r => r.token !== token);
    fs.writeFileSync(pathFile, JSON.stringify(filtered, null, 2), 'utf8');
  } catch (e) {}
}

// index.js now delegates to start.js which initializes Postgres then starts the app
console.error('Deprecated: please use start.js to run the server (it enforces Postgres-only).');
console.error('Starting via index.js is no longer supported.');
process.exit(1);
    await createUser('admin', hash);
