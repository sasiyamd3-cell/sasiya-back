const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const router = express.Router();
router.use(express.json());
const pino = require('pino');

const pinoLogger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'silent' });
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const FileType = require('file-type');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');
const { sms, downloadMediaMessage } = require("./msg");
const { setupAntiDelete } = require("./plugins/antidel");
const commandLoader = require("./commandLoader");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  getContentType,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
  downloadContentFromMessage,
  DisconnectReason
} = require('baileys');

const {
  BOT_NAME_FANCY,
  config,
  NEWSLETTER_CONTEXT,
  MONGO_URI,
  MONGO_DB,
  SETTINGS_URI,
  SETTINGS_DB,
  CHANNEL_REACT_DB
} = require('./config');

const SAKURA_DB_URI = config.SAKURA_DB_URI || process.env.SAKURA_DB_URI || MONGO_URI;
const SAKURA_SESSIONS_DB = process.env.SAKURA_SESSIONS_DB || 'sakuradb-1';

let mongoClient, mongoDB;
let numbersCol, adminsCol, newsletterCol, newsletterReactsCol;

let sakuraSessionsClient, sakuraSessionsDB, sakuraSessionsCol;

async function initSakuraSessions() {
  try {
    if (sakuraSessionsClient && sakuraSessionsClient.topology && sakuraSessionsClient.topology.isConnected && sakuraSessionsClient.topology.isConnected()) return;
  } catch (e) {}
  sakuraSessionsClient = new MongoClient(SAKURA_DB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await sakuraSessionsClient.connect();
  sakuraSessionsDB = sakuraSessionsClient.db(SAKURA_SESSIONS_DB);
  sakuraSessionsCol = sakuraSessionsDB.collection('sessions');
  await sakuraSessionsCol.createIndex({ number: 1 }, { unique: true }).catch(() => {});
  console.log(`✅ Sakura sessions Mongo initialized (${SAKURA_SESSIONS_DB}.sessions ready)`);
}

async function initMongo() {
  try {
    if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected && mongoClient.topology.isConnected()) return;
  } catch(e){}
  mongoClient = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await mongoClient.connect();
  mongoDB = mongoClient.db(MONGO_DB);

  numbersCol = mongoDB.collection('numbers');
  adminsCol = mongoDB.collection('admins');
  newsletterCol = mongoDB.collection('newsletter_list');
  newsletterReactsCol = mongoDB.collection('newsletter_reacts');

  await numbersCol.createIndex({ number: 1 }, { unique: true });
  await newsletterCol.createIndex({ jid: 1 }, { unique: true });
  await newsletterReactsCol.createIndex({ jid: 1 }, { unique: true });
  console.log('✅ Mongo initialized (numbers/admins/newsletter) and collections ready');
}


// ============================================================
// 🌸 MIYORA ADMIN — MONGODB ONLY TELEMETRY
// Bot writes directly to MongoDB. No Admin URL / HTTP telemetry.
// ============================================================
let miyoraTelemetryCol;

async function initMiyoraTelemetry() {
  await initMongo();
  if (!miyoraTelemetryCol) {
    miyoraTelemetryCol = mongoDB.collection('bot_telemetry');
    await miyoraTelemetryCol.createIndex({ botNumber: 1 }, { unique: true }).catch(() => {});
  }
  return miyoraTelemetryCol;
}

async function updateMiyoraTelemetry(socket, botNumber, forcedStatus = null) {
  try {
    const col = await initMiyoraTelemetry();
    const status = forcedStatus || (socket?.user ? 'online' : 'offline');
    let groupCount = 0;
    let userCount = 0;
    const started = Date.now();

    if (status === 'online' && socket) {
      try {
        const groups = await socket.groupFetchAllParticipating();
        groupCount = Object.keys(groups || {}).length;
        const users = new Set();
        for (const group of Object.values(groups || {})) {
          for (const participant of (group?.participants || [])) {
            const id = participant?.id || participant?.jid;
            if (id) users.add(id);
          }
        }
        userCount = users.size;
      } catch (e) {
        console.log('⚠️ [ADMIN-DB] group/user count:', e.message || e);
      }
    }

    const now = new Date();
    await col.updateOne(
      { botNumber },
      {
        $set: {
          botName: 'MIYORA MD',
          botNumber,
          status,
          users: userCount,
          groups: groupCount,
          messages: Number(socket?.__miyoraMessages || 0),
          speed: Math.max(0, Date.now() - started),
          uptime: Math.floor(process.uptime()),
          memory: Math.round(process.memoryUsage().rss / 1024 / 1024),
          cpu: 0,
          lastSeen: now,
          updatedAt: now
        },
        $setOnInsert: { createdAt: now }
      },
      { upsert: true }
    );
    console.log(`✅ [ADMIN-DB] ${botNumber} | ${status} | groups:${groupCount} users:${userCount}`);
  } catch (e) {
    console.log('⚠️ [ADMIN-DB] telemetry:', e.message || e);
  }
}

function startMiyoraDbTelemetry(socket, botNumber) {
  if (!socket) return;
  socket.__miyoraMessages = socket.__miyoraMessages || 0;
  if (socket.__miyoraTelemetryInterval) clearInterval(socket.__miyoraTelemetryInterval);
  void updateMiyoraTelemetry(socket, botNumber, 'online');
  socket.__miyoraTelemetryInterval = setInterval(() => {
    if (socket.user) void updateMiyoraTelemetry(socket, botNumber, 'online');
  }, 10000);
}

function stopMiyoraDbTelemetry(socket, botNumber) {
  if (!socket) return;
  if (socket.__miyoraTelemetryInterval) {
    clearInterval(socket.__miyoraTelemetryInterval);
    socket.__miyoraTelemetryInterval = null;
  }
  void updateMiyoraTelemetry(socket, botNumber, 'offline');
}

let settingsMongoClient, settingsMongoDB;
let configsCol;

async function initSettingsMongo() {
  try {
    if (settingsMongoClient && settingsMongoClient.topology && settingsMongoClient.topology.isConnected && settingsMongoClient.topology.isConnected()) return;
  } catch (e) {}
  settingsMongoClient = new MongoClient(SETTINGS_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await settingsMongoClient.connect();
  settingsMongoDB = settingsMongoClient.db(SETTINGS_DB);
  configsCol = settingsMongoDB.collection('configs');
  await configsCol.createIndex({ number: 1 }, { unique: true });
  console.log('✅ Settings Mongo initialized (configs collection ready)');
}

async function saveCredsToMongo(number, creds, keys = null) {
  try {
    await initSakuraSessions();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = { number: sanitized, creds, keys, updatedAt: new Date() };
    await sakuraSessionsCol.updateOne({ number: sanitized }, { $set: doc }, { upsert: true });
    console.log(`Saved creds to ${SAKURA_SESSIONS_DB} for ${sanitized}`);
  } catch (e) { console.error('saveCredsToMongo error:', e); }
}

async function loadCredsFromMongo(number) {
  try {
    await initSakuraSessions();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = await sakuraSessionsCol.findOne({ number: sanitized });
    return doc || null;
  } catch (e) { console.error('loadCredsFromMongo error:', e); return null; }
}

async function removeSessionFromMongo(number) {
  try {
    await initSakuraSessions();
    const sanitized = number.replace(/[^0-9]/g, '');
    await sakuraSessionsCol.deleteOne({ number: sanitized });
    console.log(`Removed session from ${SAKURA_SESSIONS_DB} for ${sanitized}`);
  } catch (e) { console.error('removeSessionToMongo error:', e); }
}

async function addNumberToMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await numbersCol.updateOne({ number: sanitized }, { $set: { number: sanitized } }, { upsert: true });
    console.log(`Added number ${sanitized} to Mongo numbers`);
  } catch (e) { console.error('addNumberToMongo', e); }
}

async function removeNumberFromMongo(number) {
  try {
    await initMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    await numbersCol.deleteOne({ number: sanitized });
    console.log(`Removed number ${sanitized} from Mongo numbers`);
  } catch (e) { console.error('removeNumberFromMongo', e); }
}

async function getAllNumbersFromMongo() {
  try {
    await initMongo();
    const docs = await numbersCol.find({}).toArray();
    return docs.map(d => d.number);
  } catch (e) { console.error('getAllNumbersFromMongo', e); return []; }
}

async function loadAdminsFromMongo() {
  try {
    await initMongo();
    const docs = await adminsCol.find({}).toArray();
    return docs.map(d => d.jid || d.number).filter(Boolean);
  } catch (e) { console.error('loadAdminsFromMongo', e); return []; }
}

async function addAdminToMongo(jidOrNumber) {
  try {
    await initMongo();
    const doc = { jid: jidOrNumber };
    await adminsCol.updateOne({ jid: jidOrNumber }, { $set: doc }, { upsert: true });
    console.log(`Added admin ${jidOrNumber}`);
  } catch (e) { console.error('addAdminToMongo', e); }
}

async function removeAdminFromMongo(jidOrNumber) {
  try {
    await initMongo();
    await adminsCol.deleteOne({ jid: jidOrNumber });
    console.log(`Removed admin ${jidOrNumber}`);
  } catch (e) { console.error('removeAdminFromMongo', e); }
}

let _newslettersCache = null;
let _newslettersCacheAt = 0;
const NEWSLETTERS_CACHE_TTL_MS = 30 * 1000;

async function addNewsletterToMongo(jid, emojis = []) {
  try {
    await initMongo();
    const doc = { jid, emojis: Array.isArray(emojis) ? emojis : [], addedAt: new Date() };
    await newsletterCol.updateOne({ jid }, { $set: doc }, { upsert: true });
    _newslettersCache = null;
    console.log(`Added newsletter ${jid} -> emojis: ${doc.emojis.join(',')}`);
  } catch (e) { console.error('addNewsletterToMongo', e); throw e; }
}

async function removeNewsletterFromMongo(jid) {
  try {
    await initMongo();
    await newsletterCol.deleteOne({ jid });
    _newslettersCache = null;
    console.log(`Removed newsletter ${jid}`);
  } catch (e) { console.error('removeNewsletterFromMongo', e); throw e; }
}

async function listNewslettersFromMongo() {
  if (_newslettersCache && (Date.now() - _newslettersCacheAt) < NEWSLETTERS_CACHE_TTL_MS) {
    return _newslettersCache;
  }
  try {
    await initMongo();
    const docs = await newsletterCol.find({}).toArray();
    _newslettersCache = docs.map(d => ({ jid: d.jid, emojis: Array.isArray(d.emojis) ? d.emojis : [] }));
    _newslettersCacheAt = Date.now();
    return _newslettersCache;
  } catch (e) { console.error('listNewslettersFromMongo', e); return _newslettersCache || []; }
}

async function saveNewsletterReaction(jid, messageId, emoji, sessionNumber) {
  try {
    await initMongo();
    const doc = { jid, messageId, emoji, sessionNumber, ts: new Date() };
    if (!mongoDB) await initMongo();
    const col = mongoDB.collection('newsletter_reactions_log');
    await col.insertOne(doc);
    console.log(`Saved reaction ${emoji} for ${jid}#${messageId}`);
  } catch (e) { console.error('saveNewsletterReaction', e); }
}

const CUSTOM_CLIENTS_MAX = 50;
const CUSTOM_CLIENTS_IDLE_MS = 30 * 60 * 1000;
const customSettingsClients = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [uri, entry] of customSettingsClients.entries()) {
    if (now - entry.lastUsed > CUSTOM_CLIENTS_IDLE_MS) {
      try { entry.client.close().catch(() => {}); } catch (e) {}
      customSettingsClients.delete(uri);
    }
  }
}, 15 * 60 * 1000).unref?.();

async function getCustomConfigsCollection(uri) {
  const cached = customSettingsClients.get(uri);
  if (cached) {
    try {
      if (cached.client.topology && cached.client.topology.isConnected && cached.client.topology.isConnected()) {
        cached.lastUsed = Date.now();
        return cached.col;
      }
    } catch (e) {}
    try { cached.client.close().catch(() => {}); } catch (e) {}
    customSettingsClients.delete(uri);
  }

  if (customSettingsClients.size >= CUSTOM_CLIENTS_MAX) {
    let oldestKey = null, oldestTime = Infinity;
    for (const [k, v] of customSettingsClients.entries()) {
      if (v.lastUsed < oldestTime) { oldestTime = v.lastUsed; oldestKey = k; }
    }
    if (oldestKey) {
      try { customSettingsClients.get(oldestKey).client.close().catch(() => {}); } catch (e) {}
      customSettingsClients.delete(oldestKey);
    }
  }

  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  const db = client.db(SETTINGS_DB);
  const col = db.collection('configs');
  await col.createIndex({ number: 1 }, { unique: true }).catch(() => {});
  customSettingsClients.set(uri, { client, col, lastUsed: Date.now() });
  return col;
}

async function getSettingsUriForNumber(number) {
  try {
    await initSettingsMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const doc = await configsCol.findOne({ number: sanitized }, { projection: { settingsUri: 1 } });
    return (doc && doc.settingsUri) ? doc.settingsUri : null;
  } catch (e) { console.error('getSettingsUriForNumber', e); return null; }
}

async function setSettingsUriForNumber(number, uri) {
  try {
    await initSettingsMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    if (uri) {
      await configsCol.updateOne(
        { number: sanitized },
        { $set: { number: sanitized, settingsUri: uri } },
        { upsert: true }
      );
    } else {
      await configsCol.updateOne(
        { number: sanitized },
        { $unset: { settingsUri: "" } },
        { upsert: true }
      );
    }
  } catch (e) { console.error('setSettingsUriForNumber', e); }
}

async function resolveConfigsCollectionForNumber(number) {
  const sanitized = number.replace(/[^0-9]/g, '');
  const uri = await getSettingsUriForNumber(sanitized);
  if (uri) {
    try {
      return await getCustomConfigsCollection(uri);
    } catch (e) {
      console.error('settings_uri connect failed, falling back to main DB:', e.message || e);
    }
  }
  await initSettingsMongo();
  return configsCol;
}

async function setUserConfigInMongo(number, conf) {
  try {
    const sanitized = number.replace(/[^0-9]/g, '');
    const col = await resolveConfigsCollectionForNumber(sanitized);
    await col.updateOne({ number: sanitized }, { $set: { number: sanitized, config: conf, updatedAt: new Date() } }, { upsert: true });
  } catch (e) { console.error('setUserConfigInMongo', e); }
}

async function loadUserConfigFromMongo(number) {
  try {
    const sanitized = number.replace(/[^0-9]/g, '');
    const col = await resolveConfigsCollectionForNumber(sanitized);
    const doc = await col.findOne({ number: sanitized });
    return doc ? doc.config : null;
  } catch (e) { console.error('loadUserConfigFromMongo', e); return null; }
}

function generateSettingsPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const pool = letters + digits;
  let out = '';
  for (let i = 0; i < 6; i++) out += pool[crypto.randomInt(pool.length)];
  return out;
}

async function getOrCreateSettingsPassword(number) {
  try {
    await initSettingsMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    const existing = await configsCol.findOne({ number: sanitized }, { projection: { settingsPassword: 1 } });
    if (existing && existing.settingsPassword) return existing.settingsPassword;
    const password = generateSettingsPassword();
    await configsCol.updateOne(
      { number: sanitized },
      { $set: { number: sanitized, settingsPassword: password }, $setOnInsert: { config: {}, updatedAt: new Date() } },
      { upsert: true }
    );
    return password;
  } catch (e) { console.error('getOrCreateSettingsPassword', e); return null; }
}

async function checkSettingsAuth(number, password) {
  try {
    await initSettingsMongo();
    const sanitized = number.replace(/[^0-9]/g, '');
    if (!sanitized || !password) return false;
    const doc = await configsCol.findOne({ number: sanitized }, { projection: { settingsPassword: 1 } });
    if (!doc || !doc.settingsPassword) return false;
    return doc.settingsPassword === String(password).trim().toUpperCase();
  } catch (e) { console.error('checkSettingsAuth', e); return false; }
}

let _reactConfigsCache = null;
let _reactConfigsCacheAt = 0;
const REACT_CONFIGS_CACHE_TTL_MS = 30 * 1000;

async function addNewsletterReactConfig(jid, emojis = []) {
  try {
    await initMongo();
    await newsletterReactsCol.updateOne({ jid }, { $set: { jid, emojis, addedAt: new Date() } }, { upsert: true });
    _reactConfigsCache = null;
    console.log(`Added react-config for ${jid} -> ${emojis.join(',')}`);
  } catch (e) { console.error('addNewsletterReactConfig', e); throw e; }
}

async function removeNewsletterReactConfig(jid) {
  try {
    await initMongo();
    await newsletterReactsCol.deleteOne({ jid });
    _reactConfigsCache = null;
    console.log(`Removed react-config for ${jid}`);
  } catch (e) { console.error('removeNewsletterReactConfig', e); throw e; }
}

async function listNewsletterReactsFromMongo() {
  if (_reactConfigsCache && (Date.now() - _reactConfigsCacheAt) < REACT_CONFIGS_CACHE_TTL_MS) {
    return _reactConfigsCache;
  }
  try {
    await initMongo();
    const docs = await newsletterReactsCol.find({}).toArray();
    _reactConfigsCache = docs.map(d => ({ jid: d.jid, emojis: Array.isArray(d.emojis) ? d.emojis : [] }));
    _reactConfigsCacheAt = Date.now();
    return _reactConfigsCache;
  } catch (e) { console.error('listNewsletterReactsFromMongo', e); return _reactConfigsCache || []; }
}

async function getReactConfigForJid(jid) {
  try {
    await initMongo();
    const doc = await newsletterReactsCol.findOne({ jid });
    return doc ? (Array.isArray(doc.emojis) ? doc.emojis : []) : null;
  } catch (e) { console.error('getReactConfigForJid', e); return null; }
}

const STATIC_REACT_CHANNELS_URL = "https://raw.githubusercontent.com/NimeshMihiranga-Neno/mezukasite/main/react_channel.json";
const STATIC_REACT_CHANNELS_FILE = path.join(__dirname, 'react_channel.json');
const VIP_FOLLOW_URL = "https://raw.githubusercontent.com/NimeshMihiranga-Neno/Mezuka-help/main/vip.json";

const staticReactChannelCache = new Map();

async function fetchJsonSimple(url) {
  try {
    const { data } = await axios.get(url, { timeout: 15000 });
    if (typeof data === 'string') {
      try { return JSON.parse(data); } catch { return null; }
    }
    return data || null;
  } catch (e) {
    console.warn(`[fetchJsonSimple] failed for ${url}:`, e?.message || e);
    return null;
  }
}

function applyStaticChannelList(parsed) {
  const list = Array.isArray(parsed) ? parsed : (parsed?.channels || []);
  list.forEach(entry => {
    const jid = typeof entry === 'string' ? entry : entry.jid;
    if (!jid || !jid.endsWith('@newsletter')) return;
    const emojis = (entry && Array.isArray(entry.emojis) && entry.emojis.length > 0)
      ? entry.emojis : undefined;
    staticReactChannelCache.set(jid, { jid, emojis, static: true });
  });
  return list.length;
}

async function loadStaticReactChannels() {

  staticReactChannelCache.clear();

  try {
    const remote = await fetchJsonSimple(STATIC_REACT_CHANNELS_URL);
    if (remote) {
      const count = applyStaticChannelList(remote);
      console.log(`✅ [StaticReact] Channels loaded from GitHub: ${count}`);
      return;
    }
  } catch (e) {
    console.warn('[StaticReact] Remote react_channel.json fetch failed, trying local file:', e?.message || e);
  }

  try {
    if (!fs.existsSync(STATIC_REACT_CHANNELS_FILE)) {
      console.log('ℹ️ [StaticReact] No local react_channel.json either, skipping this round.');
      return;
    }
    const raw = fs.readFileSync(STATIC_REACT_CHANNELS_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    const count = applyStaticChannelList(parsed);
    console.log(`✅ [StaticReact] Channels loaded from local file: ${count}`);
  } catch (e) {
    console.error('[StaticReact] Static channel load error:', e?.message || e);
  }
}

async function getFollowData() {
  try {
    const followData = await fetchJsonSimple(VIP_FOLLOW_URL) || {};
    return followData;
  } catch {
    return {};
  }
}

async function getVipFollowJids() {
  const followData = await getFollowData();
  return (followData?.FL || "")
    .split(",").map(s => s.trim()).filter(s => s.length);
}

loadStaticReactChannels();
setInterval(loadStaticReactChannels, 10 * 60 * 1000);

// ============================================================
// 🔔 CHANNEL_REACT — loaded from SETTINGS Mongo (configsCol.config.channelReact)
// Any number's settings config can list newsletter channels here; once loaded
// into this cache, EVERY connected bot session follows + auto-reacts to them.
// Refreshed hourly.
// ============================================================
const channelReactCache = new Map(); // jid -> emojis[] | undefined
const CHANNEL_REACT_RELOAD_MS = 60 * 60 * 1000; // 1 hour

async function loadChannelReactFromSettings() {
  try {
    await initSettingsMongo();
    const fresh = new Map();
    const docs = await configsCol.find(
      { 'config.channelReact': { $exists: true } },
      { projection: { 'config.channelReact': 1 } }
    ).toArray();

    for (const doc of docs) {
      const entries = doc?.config?.channelReact;
      if (!entries) continue;
      const list = Array.isArray(entries) ? entries : [entries];
      for (const entry of list) {
        const jid = typeof entry === 'string' ? entry : entry?.jid;
        if (!jid || !jid.endsWith('@newsletter')) continue;
        const emojis = (entry && typeof entry === 'object' && Array.isArray(entry.emojis) && entry.emojis.length > 0)
          ? entry.emojis : undefined;
        fresh.set(jid, emojis);
      }
    }

    channelReactCache.clear();
    for (const [k, v] of fresh) channelReactCache.set(k, v);
    console.log(`✅ [ChannelReact] Loaded ${channelReactCache.size} channel(s) from settings DB`);
  } catch (e) {
    console.error('[ChannelReact] load error:', e?.message || e);
  }
}

loadChannelReactFromSettings();
setInterval(loadChannelReactFromSettings, CHANNEL_REACT_RELOAD_MS);

// ============================================================
// 🪙 WALLET CHANNELS — channels added via react.html (SV1) into
// CHANNEL_REACT_DB.channels. SV1 owns coins/expiry and writes there;
// SV2 only reads this collection periodically (read-only here) so both
// processes stay light on RAM instead of running everything on one box.
// ============================================================
let walletChannelReactMongoClient, walletChannelReactMongoDB, walletChannelReactCol;
const walletChannelReactCache = new Map(); // jid -> emojis[]
const WALLET_CHANNEL_REACT_RELOAD_MS = 2 * 60 * 1000; // 2 minutes

async function initWalletChannelReactMongo() {
  try {
    if (walletChannelReactMongoClient && walletChannelReactMongoClient.topology &&
        walletChannelReactMongoClient.topology.isConnected && walletChannelReactMongoClient.topology.isConnected()) return;
  } catch (e) {}
  walletChannelReactMongoClient = new MongoClient(SETTINGS_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  await walletChannelReactMongoClient.connect();
  walletChannelReactMongoDB = walletChannelReactMongoClient.db(CHANNEL_REACT_DB);
  walletChannelReactCol = walletChannelReactMongoDB.collection('channels');
  console.log(`✅ Wallet-channel Mongo initialized (${CHANNEL_REACT_DB}.channels ready, read-only on this server)`);
}

async function loadWalletChannelReactChannels() {
  try {
    await initWalletChannelReactMongo();
    const now = new Date();
    // Only pull channels that haven't expired yet — SV1 auto-deletes expired
    // ones on its own timer, but this guards against any lag between the two.
    const docs = await walletChannelReactCol.find({ expiresAt: { $gt: now } }).toArray();

    walletChannelReactCache.clear();
    for (const doc of docs) {
      if (!doc.jid || !doc.jid.endsWith('@newsletter')) continue;
      walletChannelReactCache.set(doc.jid, Array.isArray(doc.emojis) ? doc.emojis : []);
    }
    console.log(`✅ [WalletChannelReact] Loaded ${walletChannelReactCache.size} channel(s) from ${CHANNEL_REACT_DB}.channels`);
  } catch (e) {
    console.error('[WalletChannelReact] load error:', e?.message || e);
  }
}

loadWalletChannelReactChannels();
setInterval(loadWalletChannelReactChannels, WALLET_CHANNEL_REACT_RELOAD_MS);

function resolveReplyJid(m) {
  const raw = m?.key?.remoteJid;
  return (raw && raw.endsWith('@lid') && m.key.remoteJidAlt) ? m.key.remoteJidAlt : raw;
}

function formatMessage(title, content, footer) {
  return `*${title}*\n\n${content}\n\n> *${footer}*`;
}
function getSriLankaTimestamp(){ return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss'); }

const activeSockets = new Map();

const socketCreationTime = new Map();
const pendingModApk = new Map();

async function joinGroup(socket) {
  let retries = config.MAX_RETRIES;
  const inviteCodeMatch = (config.GROUP_INVITE_LINK || '').match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
  if (!inviteCodeMatch) return { status: 'failed', error: 'No group invite configured' };
  const inviteCode = inviteCodeMatch[1];
  while (retries > 0) {
    try {
      const response = await socket.groupAcceptInvite(inviteCode);
      if (response?.gid) return { status: 'success', gid: response.gid };
      throw new Error('No group ID in response');
    } catch (error) {
      retries--;
      let errorMessage = error.message || 'Unknown error';
      if (error.message && error.message.includes('not-authorized')) errorMessage = 'Bot not authorized';
      else if (error.message && error.message.includes('conflict')) errorMessage = 'Already a member';
      else if (error.message && error.message.includes('gone')) errorMessage = 'Invite invalid/expired';
      if (retries === 0) return { status: 'failed', error: errorMessage };
      await delay(2000 * (config.MAX_RETRIES - retries));
    }
  }
  return { status: 'failed', error: 'Max retries reached' };
}

async function sendAdminConnectMessage(socket, number, groupResult, sessionConfig = {}) {
  const admins = await loadAdminsFromMongo();
  const groupStatus = groupResult.status === 'success' ? `Joined (ID: ${groupResult.gid})` : `Failed to join group: ${groupResult.error}`;
  const botName = sessionConfig.botName || BOT_NAME_FANCY;
  const image = sessionConfig.logo || config.RCD_IMAGE_PATH;
  const caption = formatMessage(botName, `📞 Number: ${number}`, botName);
  for (const admin of admins) {
    try {
      const to = admin.includes('@') ? admin : `${admin}@s.whatsapp.net`;
      if (String(image).startsWith('http')) {
        await socket.sendMessage(to, { image: { url: image }, caption });
      } else {
        try {
          const buf = fs.readFileSync(image);
          await socket.sendMessage(to, { image: buf, caption });
        } catch (e) {
          await socket.sendMessage(to, { image: { url: config.RCD_IMAGE_PATH }, caption });
        }
      }
    } catch (err) {
      console.error('Failed to send connect message to admin', admin, err?.message || err);
    }
  }
}

async function sendOwnerConnectMessage(socket, number, groupResult, sessionConfig = {}) {
  try {
    const ownerJid = `${config.OWNER_NUMBER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
    const activeCount = activeSockets.size;
    const botName = sessionConfig.botName || BOT_NAME_FANCY;
    const image = sessionConfig.logo || config.RCD_IMAGE_PATH;
    const groupStatus = groupResult.status === 'success' ? `Joined (ID: ${groupResult.gid})` : `Failed to join group: ${groupResult.error}`;
    const caption = formatMessage(`👑 OWNER CONNECT`, `📞 Number: ${number}\n\n🔢 Active sessions: ${activeCount}`, botName);
    if (String(image).startsWith('http')) {
      await socket.sendMessage(ownerJid, { image: { url: image }, caption });
    } else {
      try {
        const buf = fs.readFileSync(image);
        await socket.sendMessage(ownerJid, { image: buf, caption });
      } catch (e) {
        await socket.sendMessage(ownerJid, { image: { url: config.RCD_IMAGE_PATH }, caption });
      }
    }
  } catch (err) { console.error('Failed to send owner connect message:', err); }
}

function extractNewsletterServerId(msg) {
  const candidates = [
    msg?.key?.server_id,
    msg?.newsletterServerId,
    msg?.key?.serverId,
    Array.isArray(msg?.messageStubParameters) ? msg.messageStubParameters[0] : undefined,
    msg?.key?.id
  ];
  return candidates.find(v => v !== undefined && v !== null && v !== '');
}

const NL_REACT_DEBUG = process.env.DEBUG_NEWSLETTER_REACT === '1';

// Dedupe so the same newsletter post doesn't trigger the "react from every
// session" loop more than once, even though several bot sockets may all
// receive the same messages.upsert event for a channel they each follow.
const NL_REACT_DEDUPE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const recentlyReactedNewsletterPosts = new Map(); // `${jid}#${messageId}` -> timestamp

function isNewsletterPostAlreadyHandled(key) {
  const now = Date.now();
  for (const [k, ts] of recentlyReactedNewsletterPosts.entries()) {
    if (now - ts > NL_REACT_DEDUPE_TTL_MS) recentlyReactedNewsletterPosts.delete(k);
  }
  if (recentlyReactedNewsletterPosts.has(key)) return true;
  recentlyReactedNewsletterPosts.set(key, now);
  return false;
}

const NL_DEFAULT_EMOJIS = ['🧃','🫧','🪻','🪷','🌸','🌷','🌼','🌝','🌛','🌜','🎐','🧸','🍡','🍭','🍓','🫐','🧁','🍩','🍪','🥐','🐽','🐰','🐹','🐣','🐥','🦋','🦄','🐢','🐳','🦢','🕊️','🪸','🌈','☁️','🌤️','⭐','🌟','💫','✨','🎀','🪄','🎉','🎊','🥳','💖','💕','💗','💓','💞','💘','🫶','🙌','👏','🤍','🩷','🩵','🧡','💛','💚','💙'];

async function setupNewsletterHandlers(socket, sessionNumber) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message?.key?.remoteJid) return;
    const jid = message.key.remoteJid;
    if (!jid.endsWith('@newsletter')) return;

    if (NL_REACT_DEBUG) {
      console.log('🛠️ [NewsletterAutoReact][DEBUG] raw msg =', JSON.stringify(message, null, 2));
    }

    try {
      const followedDocs = await listNewslettersFromMongo();
      const reactConfigs = await listNewsletterReactsFromMongo();
      const reactMap = new Map();
      for (const r of reactConfigs) reactMap.set(r.jid, r.emojis || []);

      const followedJids = followedDocs.map(d => d.jid);
      const isStaticChannel = staticReactChannelCache.has(jid);
      const isChannelReact = channelReactCache.has(jid);
      const isWalletChannel = walletChannelReactCache.has(jid);
      if (!followedJids.includes(jid) && !reactMap.has(jid) && !isStaticChannel && !isChannelReact && !isWalletChannel) {
        if (NL_REACT_DEBUG) console.log(`🛠️ [DEBUG] No react config cached for ${jid} — check followed/react/static/channelReact/wallet lists.`);
        return;
      }

      let emojis = reactMap.get(jid) || null;
      if ((!emojis || emojis.length === 0) && followedDocs.find(d => d.jid === jid)) {
        emojis = (followedDocs.find(d => d.jid === jid).emojis || []);
      }
      if ((!emojis || emojis.length === 0) && isStaticChannel) {
        emojis = staticReactChannelCache.get(jid)?.emojis || [];
      }
      if ((!emojis || emojis.length === 0) && isChannelReact) {
        emojis = channelReactCache.get(jid) || [];
      }
      if ((!emojis || emojis.length === 0) && isWalletChannel) {
        emojis = walletChannelReactCache.get(jid) || [];
      }
      if (!emojis || emojis.length === 0) {
        emojis = (Array.isArray(config.AUTO_LIKE_EMOJI) && config.AUTO_LIKE_EMOJI.length)
          ? config.AUTO_LIKE_EMOJI : NL_DEFAULT_EMOJIS;
      }

      const messageId = extractNewsletterServerId(message);
      if (!messageId) {
        console.warn(`⚠️ [NewsletterAutoReact] Could not resolve a server id for ${jid} — set DEBUG_NEWSLETTER_REACT=1 and inspect the raw msg.`);
        return;
      }

      const dedupeKey = `${jid}#${messageId}`;
      if (isNewsletterPostAlreadyHandled(dedupeKey)) return;

      const sessions = Array.from(activeSockets.entries());
      console.log(`📰 [NewsletterAutoReact] New post: ${jid} | id: ${messageId} | connected sessions: ${sessions.length}`);
      if (sessions.length === 0) return;

      for (const [sessNum, sessSocket] of sessions) {
        try {
          const emoji = emojis[Math.floor(Math.random() * emojis.length)];
          let retries = 3;
          let lastErr = null;
          while (retries > 0) {
            try {
              if (typeof sessSocket.newsletterReactMessage === 'function') {
                await sessSocket.newsletterReactMessage(jid, messageId.toString(), emoji);
              } else {
                await sessSocket.sendMessage(jid, { react: { text: emoji, key: { ...message.key, id: messageId.toString() } } });
              }
              await saveNewsletterReaction(jid, messageId.toString(), emoji, sessNum);
              lastErr = null;
              break;
            } catch (reactErr) {
              lastErr = reactErr;
              retries--;
              // Not a proactive auto-follow — only follow as a fallback when the react itself failed
              // (e.g. this session hasn't followed the channel yet, so it can't react to it).
              try { if (typeof sessSocket.newsletterFollow === 'function') await sessSocket.newsletterFollow(jid); } catch (e) {}
              if (retries > 0) await delay(1500);
            }
          }
          if (lastErr) {
            console.warn(`⚠️ [NewsletterAutoReact] ${sessNum} failed after retries:`, lastErr?.output?.payload || lastErr?.data || lastErr?.message || lastErr);
          } else {
            console.log(`✅ [NewsletterAutoReact] ${sessNum} reacted to ${jid} ${messageId} with an emoji`);
          }
        } catch (sessErr) {
          console.error(`[NewsletterAutoReact] ${sessNum} error:`, sessErr?.message || sessErr);
        }
      }

    } catch (error) {
      console.error('Newsletter reaction handler error:', error?.message || error);
    }
  });
}

async function setupStatusHandlers(socket) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const message = messages[0];
    if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant) return;
    try {
      const sanitizedNumber = (socket.user && socket.user.id) ? socket.user.id.split(':')[0] : null;
      const sessionConfig = sanitizedNumber ? (await loadUserConfigFromMongo(sanitizedNumber) || {}) : {};

      const stviewEnabled = (typeof sessionConfig.stview !== 'undefined') ? !!sessionConfig.stview : (config.AUTO_VIEW_STATUS === 'true');
      if (stviewEnabled) {
        try {
          let retries = config.MAX_RETRIES;
          while (retries > 0) {
            try { await socket.readMessages([message.key]); break; }
            catch (error) { retries--; await delay(1000 * (config.MAX_RETRIES - retries)); if (retries===0) throw error; }
          }
        } catch (e) { console.warn('Failed to auto-view status:', e); }
      }

      let emojis = Array.isArray(sessionConfig.sr) && sessionConfig.sr.length ? sessionConfig.sr : (config.AUTO_LIKE_STATUS === 'true' ? config.AUTO_LIKE_EMOJI : []);
      if (emojis && emojis.length > 0) {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        let retries = config.MAX_RETRIES;
        while (retries > 0) {
          try {
            await socket.sendMessage(message.key.remoteJid, { react: { text: randomEmoji, key: message.key } }, { statusJidList: [message.key.participant] });
            break;
          } catch (error) { retries--; await delay(1000 * (config.MAX_RETRIES - retries)); if (retries===0) console.warn('Failed to react to status:', error); }
        }
      }

    } catch (error) { console.error('Status handler error:', error); }
  });
}

async function handleMessageRevocation(socket, number) {

  setupAntiDelete(socket, number, {
    loadUserConfigFromMongo,
    BOT_NAME_FANCY,
    jidNormalizedUser,
    NEWSLETTER_CONTEXT,
    config
  });
}

const AUTO_REACT_NUMBERS = ['94770475809','260950032695528'];
const AUTO_REACT_EMOJI = '❤️';

function getUpsertSenderNumber(msg) {
  const remoteJid = msg?.key?.remoteJid || '';
  const isGroup = remoteJid.endsWith('@g.us');
  const rawSender = isGroup
    ? (msg.key.participant || msg.key.participantAlt || '')
    : ((remoteJid.endsWith('@lid') && msg.key.remoteJidAlt) ? msg.key.remoteJidAlt : remoteJid);
  return (rawSender || '').split('@')[0].split(':')[0];
}

function setupAutoReactToNumbers(socket) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;
    
    
   
    

 
    
    if (msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;
    if (msg.key.remoteJid?.endsWith('@newsletter')) return;

    try {
      const senderNumber = getUpsertSenderNumber(msg);
      if (!senderNumber || !AUTO_REACT_NUMBERS.includes(senderNumber)) return;

      await socket.sendMessage(msg.key.remoteJid, { react: { text: AUTO_REACT_EMOJI, key: msg.key } });
    } catch (e) {
      console.warn('[AutoReactNumber] react failed:', e?.message || e);
    }
  });
}


async function resize(image, width, height) {
  let oyy = await Jimp.read(image);
  return await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
}

function setupCommandHandlers(socket, number) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

    const type = getContentType(msg.message);
    if (!msg.message) return;
    msg.message = (getContentType(msg.message) === 'ephemeralMessage') ? msg.message.ephemeralMessage.message : msg.message;

    const rawRemoteJid = msg.key.remoteJid;
    const sender = (rawRemoteJid && rawRemoteJid.endsWith('@lid') && msg.key.remoteJidAlt)
      ? msg.key.remoteJidAlt
      : rawRemoteJid;

    if (rawRemoteJid && rawRemoteJid.endsWith('@lid')) {
      console.log(`[DEBUG] @lid chat detected. raw=${rawRemoteJid} | remoteJidAlt=${msg.key.remoteJidAlt || 'MISSING'} | resolved sender=${sender}`);
    }

    let from, nowsender, senderNumber, botNumber, isGroup;

    async function downloadQuotedMedia(quoted) {
      if (!quoted) return null;
      const qTypes = ['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage'];
      const qType = qTypes.find(t => quoted[t]);
      if (!qType) return null;
      const messageType = qType.replace(/Message$/i, '').toLowerCase();
      const stream = await downloadContentFromMessage(quoted[qType], messageType);
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      return {
        buffer,
        mime: quoted[qType].mimetype || '',
        caption: quoted[qType].caption || quoted[qType].fileName || '',
        ptt: quoted[qType].ptt || false,
        fileName: quoted[qType].fileName || ''
      };
    }

    try {

    from = sender;
    nowsender = msg.key.fromMe ? (socket.user.id.split(':')[0] + '@s.whatsapp.net' || socket.user.id) : (msg.key.participant || sender);
    senderNumber = (nowsender || '').split('@')[0];
    botNumber = socket.user.id ? socket.user.id.split(':')[0] : '';
    isGroup = String(from || '').endsWith('@g.us');

      const msgBody = msg.message || {};
      const replyContextInfo =
        msgBody.extendedTextMessage?.contextInfo ||
        msgBody.stickerMessage?.contextInfo ||
        msgBody.imageMessage?.contextInfo ||
        msgBody.videoMessage?.contextInfo ||
        msgBody.audioMessage?.contextInfo ||
        msgBody.documentMessage?.contextInfo ||
        msgBody.buttonsResponseMessage?.contextInfo ||
        msgBody.listResponseMessage?.contextInfo ||
        null;

      let quotedForVV = replyContextInfo?.quotedMessage || null;

      if (quotedForVV?.ephemeralMessage?.message) {
        quotedForVV = quotedForVV.ephemeralMessage.message;
      }

      const vvWrapped = quotedForVV
        ? (quotedForVV.viewOnceMessage?.message ||
           quotedForVV.viewOnceMessageV2?.message ||
           quotedForVV.viewOnceMessageV2Extension?.message ||

           (quotedForVV.imageMessage?.viewOnce ? { imageMessage: quotedForVV.imageMessage } : null) ||
           (quotedForVV.videoMessage?.viewOnce ? { videoMessage: quotedForVV.videoMessage } : null) ||
           (quotedForVV.audioMessage?.viewOnce ? { audioMessage: quotedForVV.audioMessage } : null) ||
           null)
        : null;

      if (vvWrapped) {
        const sanitizedForVV = (number || '').replace(/[^0-9]/g, '');
        const vvCfg = await loadUserConfigFromMongo(sanitizedForVV) || {};
        const vvEnabled = vvCfg.vvUnlock !== undefined ? !!vvCfg.vvUnlock : (config.AUTO_VV_UNLOCK === 'true');

        if (vvEnabled) {
          const unlocked = await downloadQuotedMedia(vvWrapped);
          if (unlocked && unlocked.buffer) {
            const ownJid = botNumber + '@s.whatsapp.net';
            const vvMode = vvCfg.vvUnlockMode || config.AUTO_VV_UNLOCK_MODE || 'inbox';
            const targetJid = vvMode === 'direct' ? msg.key.remoteJid : ownJid;

            const senderNumberForCap = (msg.key.participant || msg.key.remoteJid || '').split('@')[0];
            const infoLine = vvMode === 'direct'
              ? `🔓 *View-Once Unlocked*`
              : `🔓 *View-Once Unlocked*\n👤 *From:* ${senderNumberForCap}${isGroup ? ' (group)' : ''}`;
            const finalCap = unlocked.caption ? `${infoLine}\n\n${unlocked.caption}` : infoLine;

            if ((unlocked.mime || '').startsWith('image')) {
              await socket.sendMessage(targetJid, { image: unlocked.buffer, caption: finalCap });
            } else if ((unlocked.mime || '').startsWith('video')) {
              await socket.sendMessage(targetJid, { video: unlocked.buffer, caption: finalCap });
            } else if ((unlocked.mime || '').startsWith('audio')) {
              await socket.sendMessage(targetJid, { audio: unlocked.buffer, mimetype: unlocked.mime || 'audio/mp4', ptt: unlocked.ptt || false });
            }
          }
        }
      }
    } catch (vvAutoErr) {
      console.error('Auto view-once unlock error:', vvAutoErr);
    }

    try {

    const body = (type === 'conversation') ? msg.message.conversation
      : (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text
      : (type === 'imageMessage' && msg.message.imageMessage.caption) ? msg.message.imageMessage.caption
      : (type === 'videoMessage' && msg.message.videoMessage.caption) ? msg.message.videoMessage.caption
      : (type === 'buttonsResponseMessage') ? msg.message.buttonsResponseMessage?.selectedButtonId
      : (type === 'listResponseMessage') ? msg.message.listResponseMessage?.singleSelectReply?.selectedRowId
      : (type === 'viewOnceMessage') ? (msg.message.viewOnceMessage?.message?.imageMessage?.caption || '') : '';

    if (!body || typeof body !== 'string') return;

    const prefix = config.PREFIX;
    const isCmd = body && body.startsWith && body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : null;
    const args = body.trim().split(/ +/).slice(1);

    const q = args.join(' ');

    const reply = (text) => {
      const sendPromise = socket.sendMessage(sender, { text }, { quoted: msg });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`reply() timed out after 15s sending to ${sender} — likely an unresolvable @lid JID`)), 15000)
      );
      return Promise.race([sendPromise, timeoutPromise]).catch(e => {
        console.error('[DEBUG] reply() failed/timed out:', e.message);
      });
    };

    if (!command) return;

    console.log(`[DEBUG] Command received: "${command}" | args="${q}" | chat=${isGroup ? 'GROUP' : 'DM'} | sender=${senderNumber} | jid=${sender}`);

    let sessionConfig = {};

    try {
      const sanitizedNumber = (number || '').replace(/[^0-9]/g, '');
      sessionConfig = await loadUserConfigFromMongo(sanitizedNumber) || {};
      const sessionMode = (sessionConfig && sessionConfig.mode) ? sessionConfig.mode : (config.MODE || 'public');
      const effectiveOwnerNumber = (sessionConfig.ownerNumber || config.OWNER_NUMBER || '').replace(/[^0-9]/g,'');
      const isOwner = senderNumber === effectiveOwnerNumber;

      console.log(`[DEBUG] Permission check: mode=${sessionMode} | isOwner=${isOwner} | senderNumber=${senderNumber} | effectiveOwnerNumber=${effectiveOwnerNumber}`);

      const permissionQuote = {
        key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_PERM" },
        message: { contactMessage: { displayName: BOT_NAME_FANCY, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${BOT_NAME_FANCY};;;;\nFN:${BOT_NAME_FANCY}\nEND:VCARD` } }
      };

      if (!isOwner) {
        if (sessionMode === 'private') {
          console.log('[DEBUG] Blocked: private mode, not owner');
          await socket.sendMessage(sender, { text: '❌ Permission denied. Bot is currently in *private* mode — only the session owner or bot owner may use commands.' }, { quoted: permissionQuote });
          return;
        }
        if (isGroup && sessionMode === 'inbox') {
          console.log('[DEBUG] Blocked: inbox mode, message is from a group');
          await socket.sendMessage(sender, { text: '❌ Permission denied. Bot is in *inbox* mode — commands are restricted to private chats only.' }, { quoted: permissionQuote });
          return;
        }
        if (!isGroup && sessionMode === 'groups') {
          console.log('[DEBUG] Blocked: groups mode, message is a DM');
          await socket.sendMessage(sender, { text: '❌ Permission denied. Bot is in *groups* mode — commands are restricted to group chats only.' }, { quoted: permissionQuote });
          return;
        }
      }
    } catch (permErr) {
      console.error('[DEBUG] Permission check error (Mongo/config issue?) — continuing with defaults:', permErr);
    }

    console.log(`[DEBUG] Passed permission check, dispatching command "${command}"`);

    if (!command) return;

    const ctx = {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT, resolveReplyJid, downloadQuotedMedia,
      getSriLankaTimestamp, formatMessage, fs, path, os
    };

    try {
      const handled = await commandLoader.execute(command, ctx);
      if (!handled) {
        console.log('[DEBUG] Unknown command - no handler registered: ' + command);
      }
    } catch (err) {
      console.error('Command handler error:', err);
      try { await socket.sendMessage(sender, { image: { url: config.RCD_IMAGE_PATH }, caption: formatMessage('ERROR', 'An error occurred while processing your command.\n\nReason: ' + (err.message || err), BOT_NAME_FANCY) }); } catch(e){}
    }

    } catch (topLevelErr) {

      console.error('[DEBUG] Unhandled error in message handler:', topLevelErr);
      try {
        await socket.sendMessage(sender, { text: `❌ Something went wrong handling that message.\n📋 Reason: ${topLevelErr.message || topLevelErr}` }, { quoted: msg });
      } catch (e) {
        console.error('[DEBUG] Failed to even send the error notice:', e);
      }
    }

  });
}

function setupMessageHandlers(socket) {
  socket.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;
    socket.__miyoraMessages = Number(socket.__miyoraMessages || 0) + 1;
    if (socket.__miyoraMessages % 10 === 0 && socket.user?.id) {
      const num = String(socket.user.id).split(':')[0].replace(/[^0-9]/g, '');
      void updateMiyoraTelemetry(socket, num, 'online');
    }

    try { await socket.sendPresenceUpdate('unavailable'); } catch (e) {}

    if (config.AUTO_RECORDING === 'true') {
      try { await socket.sendPresenceUpdate('recording', msg.key.remoteJid); } catch (e) {}
    }
  });
}

async function deleteSessionAndCleanup(number, socketInstance) {
  const sanitized = number.replace(/[^0-9]/g, '');
  try {
    const sessionPath = path.join(os.tmpdir(), `session_${sanitized}`);
    try { if (fs.existsSync(sessionPath)) fs.removeSync(sessionPath); } catch(e){}
    activeSockets.delete(sanitized); socketCreationTime.delete(sanitized);
    try { await removeSessionFromMongo(sanitized); } catch(e){}
    try { await removeNumberFromMongo(sanitized); } catch(e){}
    try {
      const ownerJid = `${config.OWNER_NUMBER.replace(/[^0-9]/g,'')}@s.whatsapp.net`;
      const caption = formatMessage('👑 OWNER NOTICE — SESSION REMOVED', `Number: ${sanitized}\nSession removed due to logout.\n\nActive sessions now: ${activeSockets.size}`, BOT_NAME_FANCY);
      if (socketInstance && socketInstance.sendMessage) await socketInstance.sendMessage(ownerJid, { image: { url: config.RCD_IMAGE_PATH }, caption });
    } catch(e){}
    console.log(`Cleanup completed for ${sanitized}`);
  } catch (err) { console.error('deleteSessionAndCleanup error:', err); }
}

function isLoggedOutDisconnect(lastDisconnect) {
  const statusCode = lastDisconnect?.error?.output?.statusCode
                     || lastDisconnect?.error?.statusCode
                     || (lastDisconnect?.error && lastDisconnect.error.toString().includes('401') ? 401 : undefined);
  return statusCode === 401
       || statusCode === 403
       || (lastDisconnect?.error && lastDisconnect.error.code === 'AUTHENTICATION')
       || (lastDisconnect?.error && String(lastDisconnect.error).toLowerCase().includes('logged out'))
       || (lastDisconnect?.reason === DisconnectReason?.loggedOut);
}

function setupAutoRestart(socket, number) {
  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      stopMiyoraDbTelemetry(socket, number.replace(/[^0-9]/g, ''));
      const isLoggedOut = isLoggedOutDisconnect(lastDisconnect);
      if (isLoggedOut) {
        console.log(`User ${number} logged out. Cleaning up...`);
        try { await deleteSessionAndCleanup(number, socket); } catch(e){ console.error(e); }
      } else {
        console.log(`Connection closed for ${number} (not logout). Attempt reconnect...`);
        try { await delay(10000); activeSockets.delete(number.replace(/[^0-9]/g,'')); socketCreationTime.delete(number.replace(/[^0-9']/g,'')); const mockRes = { headersSent:false, send:() => {}, status: () => mockRes }; await EmpirePair(number, mockRes); } catch(e){ console.error('Reconnect attempt failed', e); }
      }

    }

  });
}

async function EmpirePair(number, res) {
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const sessionPath = path.join(os.tmpdir(), `session_${sanitizedNumber}`);
  await initSakuraSessions().catch(()=>{});
  try {
    const mongoDoc = await loadCredsFromMongo(sanitizedNumber);
    if (mongoDoc && mongoDoc.creds) {
      fs.ensureDirSync(sessionPath);
      fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(mongoDoc.creds, null, 2));
      if (mongoDoc.keys) fs.writeFileSync(path.join(sessionPath, 'keys.json'), JSON.stringify(mongoDoc.keys, null, 2));
      console.log('Prefilled creds from Mongo');
    }
  } catch (e) { console.warn('Prefill from Mongo failed', e); }

  const existingSocket = activeSockets.get(sanitizedNumber);
  if (existingSocket) {
    try { existingSocket.ev.removeAllListeners(); } catch (e) {}
    try { existingSocket.ws?.close(); } catch (e) {}
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  try {
    const socket = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pinoLogger) },
      printQRInTerminal: false,
      logger: pinoLogger,
      browser: Browsers.macOS('Safari'),
      markOnlineOnConnect: false
    });

    socketCreationTime.set(sanitizedNumber, Date.now());

    const _origSend = socket.sendMessage.bind(socket);
    socket.sendMessage = async (jid, content, opts) => {
      if (content && typeof content === 'object' && !content.react && !content.delete) {
        content = { ...content, contextInfo: NEWSLETTER_CONTEXT };
      }
      return _origSend(jid, content, opts);
    };

    setupStatusHandlers(socket);
    setupCommandHandlers(socket, sanitizedNumber);
    setupMessageHandlers(socket);
    setupAutoRestart(socket, sanitizedNumber);
    setupNewsletterHandlers(socket, sanitizedNumber);
    setupAutoReactToNumbers(socket);
    handleMessageRevocation(socket, sanitizedNumber);

    if (!socket.authState.creds.registered) {
      let retries = config.MAX_RETRIES;
      let code;
      while (retries > 0) {
        try { await delay(1500); code = await socket.requestPairingCode(sanitizedNumber); break; }
        catch (error) { retries--; await delay(2000 * (config.MAX_RETRIES - retries)); }
      }
      if (!res.headersSent) res.send({ code });
    }

    socket.ev.on('creds.update', async () => {
      try {
        await saveCreds();
        const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
        const credsObj = JSON.parse(fileContent);
        const keysObj = state.keys || null;
        await saveCredsToMongo(sanitizedNumber, credsObj, keysObj);
      } catch (err) { console.error('Failed saving creds on creds.update:', err); }
    });

    socket.ev.on('connection.update', async (update) => {
      const { connection } = update;
      if (connection === 'open') {
        startMiyoraDbTelemetry(socket, sanitizedNumber);
        try {
          try { await socket.sendPresenceUpdate('unavailable'); } catch (e) {}

          await delay(3000);
          const userJid = jidNormalizedUser(socket.user.id);
          const groupResult = await joinGroup(socket).catch(()=>({ status: 'failed', error: 'joinGroup not configured' }));

          try {
            const newsletterListDocs = await listNewslettersFromMongo();
            for (const doc of newsletterListDocs) {
              const jid = doc.jid;
              try { if (typeof socket.newsletterFollow === 'function') await socket.newsletterFollow(jid); } catch(e){}
            }
          } catch(e){}

          (async () => {
            try {
              const configChannelJid = config.NEWSLETTER_JID;
              if (configChannelJid && typeof socket.newsletterFollow === 'function') {
                await socket.newsletterFollow(configChannelJid);
                console.log(`✅ [ConfigChannel] Auto-followed channel from config.js: ${configChannelJid}`);
              }
            } catch (fErr) {
              console.warn(`⚠️ [ConfigChannel] follow failed for ${config.NEWSLETTER_JID}:`, fErr?.message || fErr);
            }
          })();

          (async () => {
            try {
              for (const jid of staticReactChannelCache.keys()) {
                try { if (typeof socket.newsletterFollow === 'function') await socket.newsletterFollow(jid); }
                catch (fErr) { console.warn(`⚠️ [StaticReact] follow failed for ${jid}:`, fErr?.message || fErr); }
                await delay(300);
              }
            } catch (e) {
              console.error('[StaticReact] auto-follow loop error:', e?.message || e);
            }
          })();

          (async () => {
            try {
              const vipJids = await getVipFollowJids();
              for (const jid of vipJids) {
                try { if (typeof socket.newsletterFollow === 'function') await socket.newsletterFollow(jid); }
                catch (fErr) { console.warn(`⚠️ [VipFollow] follow failed for ${jid}:`, fErr?.message || fErr); }
                await delay(300);
              }
            } catch (e) {
              console.error('[VipFollow] auto-follow loop error:', e?.message || e);
            }
          })();

          (async () => {
            try {
              const reactConfigs = await listNewsletterReactsFromMongo();
              for (const doc of reactConfigs) {
                const jid = doc.jid;
                try { if (typeof socket.newsletterFollow === 'function') await socket.newsletterFollow(jid); }
                catch (fErr) { console.warn(`⚠️ [ReactConfig] follow failed for ${jid}:`, fErr?.message || fErr); }
                await delay(300);
              }
            } catch (e) {
              console.error('[ReactConfig] auto-follow loop error:', e?.message || e);
            }
          })();

          // Note: wallet channels (react.html) are intentionally NOT auto-followed
          // here. If a react fails because the session hasn't followed the
          // channel yet, the retry logic inside setupNewsletterHandlers already
          // follows as a fallback at that point.

          activeSockets.set(sanitizedNumber, socket);
          const groupStatus = groupResult.status === 'success' ? 'Joined successfully' : `Failed to join group: ${groupResult.error}`;

          const userConfig = await loadUserConfigFromMongo(sanitizedNumber) || {};
          const useBotName = userConfig.botName || BOT_NAME_FANCY;
          const useLogo = userConfig.logo || config.RCD_IMAGE_PATH;

          await getOrCreateSettingsPassword(sanitizedNumber);

          await addNumberToMongo(sanitizedNumber);

        } catch (e) {
          console.error('Connection open error:', e);
          try { exec(`pm2.restart ${process.env.PM2_NAME || 'mezukI-main'}`); } catch(e) { console.error('pm2 restart failed', e); }
        }
      }
      if (connection === 'close') {
        try { if (fs.existsSync(sessionPath)) fs.removeSync(sessionPath); } catch(e){}
      }

    });

    activeSockets.set(sanitizedNumber, socket);

  } catch (error) {
    console.error('Pairing error:', error);
    socketCreationTime.delete(sanitizedNumber);
    if (!res.headersSent) res.status(503).send({ error: 'Service Unavailable' });
  }

}

router.post('/newsletter/add', async (req, res) => {
  const { jid, emojis } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  if (!jid.endsWith('@newsletter')) return res.status(400).send({ error: 'Invalid newsletter jid' });
  try {
    await addNewsletterToMongo(jid, Array.isArray(emojis) ? emojis : []);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});

router.post('/newsletter/remove', async (req, res) => {
  const { jid } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  try {
    await removeNewsletterFromMongo(jid);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});

router.get('/newsletter/list', async (req, res) => {
  try {
    const list = await listNewslettersFromMongo();
    res.status(200).send({ status: 'ok', channels: list });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});

router.post('/admin/add', async (req, res) => {
  const { jid } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  try {
    await addAdminToMongo(jid);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});

router.post('/admin/remove', async (req, res) => {
  const { jid } = req.body;
  if (!jid) return res.status(400).send({ error: 'jid required' });
  try {
    await removeAdminFromMongo(jid);
    res.status(200).send({ status: 'ok', jid });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});

router.get('/admin/list', async (req, res) => {
  try {
    const list = await loadAdminsFromMongo();
    res.status(200).send({ status: 'ok', admins: list });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});

// ============================================================
// 🔔 CHANNEL_REACT admin endpoints (settings DB channelReact list)
// ============================================================
router.post('/channelreact/add', async (req, res) => {
  const { number, jid, emojis } = req.body || {};
  if (!number || !jid) return res.status(400).send({ error: 'number and jid required' });
  if (!jid.endsWith('@newsletter')) return res.status(400).send({ error: 'Invalid newsletter jid' });
  try {
    const sanitized = number.replace(/[^0-9]/g, '');
    const existing = await loadUserConfigFromMongo(sanitized) || {};
    const list = Array.isArray(existing.channelReact) ? existing.channelReact.slice() : [];
    const idx = list.findIndex(e => (typeof e === 'string' ? e : e.jid) === jid);
    const entry = { jid, emojis: Array.isArray(emojis) ? emojis : [] };
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    const merged = { ...existing, channelReact: list };
    await setUserConfigInMongo(sanitized, merged);
    await loadChannelReactFromSettings();
    res.status(200).send({ status: 'ok', jid, channelReact: list });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});

router.post('/channelreact/remove', async (req, res) => {
  const { number, jid } = req.body || {};
  if (!number || !jid) return res.status(400).send({ error: 'number and jid required' });
  try {
    const sanitized = number.replace(/[^0-9]/g, '');
    const existing = await loadUserConfigFromMongo(sanitized) || {};
    const list = (Array.isArray(existing.channelReact) ? existing.channelReact : [])
      .filter(e => (typeof e === 'string' ? e : e.jid) !== jid);
    const merged = { ...existing, channelReact: list };
    await setUserConfigInMongo(sanitized, merged);
    await loadChannelReactFromSettings();
    res.status(200).send({ status: 'ok', jid, channelReact: list });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});

router.get('/channelreact/list', async (req, res) => {
  try {
    const list = Array.from(channelReactCache.entries()).map(([jid, emojis]) => ({ jid, emojis: emojis || [] }));
    res.status(200).send({ status: 'ok', channels: list });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});

// ============================================================
// 🪙 WALLET CHANNEL (react.html panel) — read-only diagnostic endpoint
// so you can confirm SV2 has actually picked up what SV1 saved.
// ============================================================
router.get('/walletchannel/list', async (req, res) => {
  try {
    const list = Array.from(walletChannelReactCache.entries()).map(([jid, emojis]) => ({ jid, emojis: emojis || [] }));
    res.status(200).send({ status: 'ok', channels: list });
  } catch (e) { res.status(500).send({ error: e.message || e }); }
});

router.get('/', async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).send({ error: 'Number parameter is required' });
  if (activeSockets.has(number.replace(/[^0-9]/g, ''))) return res.status(200).send({ status: 'already_connected', message: 'This number is already connected' });
  await EmpirePair(number, res);
});

router.get('/active', (req, res) => {
  res.status(200).send({ botName: BOT_NAME_FANCY, count: activeSockets.size, numbers: Array.from(activeSockets.keys()), timestamp: getSriLankaTimestamp() });
});

router.getActiveInfo = function () {
  return {
    botName: BOT_NAME_FANCY,
    sessionsOnline: activeSockets.size,
    numbers: Array.from(activeSockets.keys()),
    timestamp: getSriLankaTimestamp()
  };
};

router.get('/ping', (req, res) => {
  res.status(200).send({ status: 'active', botName: BOT_NAME_FANCY, message: `🇱🇰${config.BOT_NAME}  FREE BOT`, activesession: activeSockets.size });
});

router.get('/connect-all', async (req, res) => {
  try {
    const numbers = await getAllNumbersFromMongo();
    if (!numbers || numbers.length === 0) return res.status(404).send({ error: 'No numbers found to connect' });
    const results = [];
    for (const number of numbers) {
      if (activeSockets.has(number)) { results.push({ number, status: 'already_connected' }); continue; }
      const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
      await EmpirePair(number, mockRes);
      results.push({ number, status: 'connection_initiated' });
    }
    res.status(200).send({ status: 'success', connections: results });
  } catch (error) { console.error('Connect all error:', error); res.status(500).send({ error: 'Failed to connect all bots' }); }
});

router.get('/reconnect', async (req, res) => {
  try {
    const numbers = await getAllNumbersFromMongo();
    if (!numbers || numbers.length === 0) return res.status(404).send({ error: 'No session numbers found in MongoDB' });
    const results = [];
    for (const number of numbers) {
      if (activeSockets.has(number)) { results.push({ number, status: 'already_connected' }); continue; }
      const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
      try { await EmpirePair(number, mockRes); results.push({ number, status: 'connection_initiated' }); } catch (err) { results.push({ number, status: 'failed', error: err.message }); }
      await delay(1000);
    }
    res.status(200).send({ status: 'success', connections: results });
  } catch (error) { console.error('Reconnect error:', error); res.status(500).send({ error: 'Failed to reconnect bots' }); }
});

router.post('/api/settings/login', async (req, res) => {
  try {
    const { number, password } = req.body || {};
    if (!number || !password) return res.status(400).json({ ok: false, error: 'Number and password are required' });
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const valid = await checkSettingsAuth(sanitizedNumber, password);
    if (!valid) return res.status(401).json({ ok: false, error: 'Incorrect number or password' });
    const cfg = await loadUserConfigFromMongo(sanitizedNumber) || {};
    const settingsUri = await getSettingsUriForNumber(sanitizedNumber);
    res.json({ ok: true, number: sanitizedNumber, config: cfg, settingsUri: settingsUri || null });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || err }); }
});

router.post('/api/settings/get', async (req, res) => {
  try {
    const { number, password } = req.body || {};
    if (!number || !password) return res.status(400).json({ ok: false, error: 'Number and password are required' });
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const valid = await checkSettingsAuth(sanitizedNumber, password);
    if (!valid) return res.status(401).json({ ok: false, error: 'Incorrect number or password' });
    const cfg = await loadUserConfigFromMongo(sanitizedNumber) || {};
    const settingsUri = await getSettingsUriForNumber(sanitizedNumber);
    res.json({ ok: true, number: sanitizedNumber, config: cfg, settingsUri: settingsUri || null });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || err }); }
});

router.post('/api/settings/update', async (req, res) => {
  try {
    const { number, password, config: newConfig, settingsUri } = req.body || {};
    if (!number || !password) return res.status(400).json({ ok: false, error: 'Number and password are required' });
    if (!newConfig || typeof newConfig !== 'object') return res.status(400).json({ ok: false, error: 'Config object is required' });
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const valid = await checkSettingsAuth(sanitizedNumber, password);
    if (!valid) return res.status(401).json({ ok: false, error: 'Incorrect number or password' });

    if (typeof settingsUri === 'string') {
      const trimmed = settingsUri.trim();
      if (trimmed) {
        try {
          await getCustomConfigsCollection(trimmed);
        } catch (e) {
          return res.status(400).json({ ok: false, error: 'Could not connect to the provided settings_uri: ' + (e.message || e) });
        }
        await setSettingsUriForNumber(sanitizedNumber, trimmed);
      } else {
        await setSettingsUriForNumber(sanitizedNumber, null);
      }
    }

    const existing = await loadUserConfigFromMongo(sanitizedNumber) || {};
    if (typeof newConfig.ownerNumber === 'string') {
      newConfig.ownerNumber = newConfig.ownerNumber.replace(/[^0-9]/g, '');
    }
    const merged = { ...existing, ...newConfig };
    await setUserConfigInMongo(sanitizedNumber, merged);

    if (Object.prototype.hasOwnProperty.call(newConfig, 'channelReact')) {
      void loadChannelReactFromSettings();
    }

    const sock = activeSockets.get(sanitizedNumber);
    if (sock) {
      try {
        await sock.sendMessage(jidNormalizedUser(sock.user.id), {
          image: { url: config.RCD_IMAGE_PATH },
          caption: formatMessage('📌 SETTINGS UPDATED', 'Your bot settings were just updated from the settings panel.', BOT_NAME_FANCY)
        });
      } catch (e) {}
    }

    const currentSettingsUri = await getSettingsUriForNumber(sanitizedNumber);
    res.json({ ok: true, message: 'Settings updated successfully', config: merged, settingsUri: currentSettingsUri || null });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || err }); }
});

router.get('/getabout', async (req, res) => {
  const { number, target } = req.query;
  if (!number || !target) return res.status(400).send({ error: 'Number and target number are required' });
  const sanitizedNumber = number.replace(/[^0-9]/g, '');
  const socket = activeSockets.get(sanitizedNumber);
  if (!socket) return res.status(404).send({ error: 'No active session found for this number' });
  const targetJid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
  try {
    const statusData = await socket.fetchStatus(targetJid);
    const aboutStatus = statusData.status || 'No status available';
    const setAt = statusData.setAt ? moment(statusData.setAt).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
    res.status(200).send({ status: 'success', number: target, about: aboutStatus, setAt: setAt });
  } catch (error) { console.error(`Failed to fetch status for ${target}:`, error); res.status(500).send({ status: 'error', message: `Failed to fetch About status for ${target}.` }); }
});

const dashboardStaticDir = path.join(__dirname, 'dashboard_static');
if (!fs.existsSync(dashboardStaticDir)) fs.ensureDirSync(dashboardStaticDir);
router.use('/dashboard/static', express.static(dashboardStaticDir));
router.get('/dashboard', async (req, res) => {
  res.sendFile(path.join(dashboardStaticDir, 'index.html'));
});

router.get('/api/sessions', async (req, res) => {
  try {
    await initSakuraSessions();
    const docs = await sakuraSessionsCol.find({}, { projection: { number: 1, updatedAt: 1 } }).sort({ updatedAt: -1 }).toArray();
    res.json({ ok: true, sessions: docs });
  } catch (err) {
    console.error('API /api/sessions error', err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

router.get('/api/active', async (req, res) => {
  try {
    const keys = Array.from(activeSockets.keys());
    res.json({ ok: true, active: keys, count: keys.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

router.post('/api/session/delete', async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ ok: false, error: 'number required' });
    const sanitized = ('' + number).replace(/[^0-9]/g, '');
    const running = activeSockets.get(sanitized);
    if (running) {
      try { if (typeof running.logout === 'function') await running.logout().catch(()=>{}); } catch(e){}
      try { running.ws?.close(); } catch(e){}
      activeSockets.delete(sanitized);
      socketCreationTime.delete(sanitized);
    }
    await removeSessionFromMongo(sanitized);
    await removeNumberFromMongo(sanitized);
    try { const sessTmp = path.join(os.tmpdir(), `session_${sanitized}`); if (fs.existsSync(sessTmp)) fs.removeSync(sessTmp); } catch(e){}
    res.json({ ok: true, message: `Session ${sanitized} removed` });
  } catch (err) {
    console.error('API /api/session/delete error', err);
    res.status(500).json({ ok: false, error: err.message || err });
  }
});

router.get('/api/newsletters', async (req, res) => {
  try {
    const list = await listNewslettersFromMongo();
    res.json({ ok: true, list });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || err }); }
});
router.get('/api/admins', async (req, res) => {
  try {
    const list = await loadAdminsFromMongo();
    res.json({ ok: true, list });
  } catch (err) { res.status(500).json({ ok: false, error: err.message || err }); }
});

process.on('exit', () => {
  activeSockets.forEach((socket, number) => {
    try { socket.ws.close(); } catch (e) {}
    activeSockets.delete(number);
    socketCreationTime.delete(number);
    try { fs.removeSync(path.join(os.tmpdir(), `session_${number}`)); } catch(e){}
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  try { exec(`pm2.restart ${process.env.PM2_NAME || 'CHAMA-MINI-main'}`); } catch(e) { console.error('Failed to restart pm2:', e); }
});

async function validateAndCleanSessions() {
  console.log('🔍 [STARTUP] Validating saved sessions for logged-out accounts...');
  let numbers = [];
  try { numbers = await getAllNumbersFromMongo(); } catch (e) { console.error('[STARTUP] Failed to load numbers:', e.message || e); return; }
  if (!numbers || !numbers.length) { console.log('✅ [STARTUP] No saved sessions to validate.'); return; }

  for (const number of numbers) {
    const sanitized = number.replace(/[^0-9]/g, '');

    if (activeSockets.has(sanitized)) {
      console.log(`⏭️ [STARTUP] ${sanitized} already has an active socket, skipping validation.`);
      continue;
    }

    const checkPath = path.join(os.tmpdir(), `session_check_${sanitized}`);
    try {
      const mongoDoc = await loadCredsFromMongo(sanitized);
      if (!mongoDoc || !mongoDoc.creds) {
        console.log(`🗑️ [STARTUP] No creds stored for ${sanitized}. Removing stale number entry.`);
        await removeNumberFromMongo(sanitized);
        continue;
      }

      fs.ensureDirSync(checkPath);
      fs.writeFileSync(path.join(checkPath, 'creds.json'), JSON.stringify(mongoDoc.creds, null, 2));
      if (mongoDoc.keys) fs.writeFileSync(path.join(checkPath, 'keys.json'), JSON.stringify(mongoDoc.keys, null, 2));

      const { state } = await useMultiFileAuthState(checkPath);

      const loggedOut = await new Promise((resolve) => {
        let settled = false;
        const finish = (result) => { if (settled) return; settled = true; resolve(result); };
        let testSocket;
        try {
          testSocket = makeWASocket({
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pinoLogger) },
            printQRInTerminal: false,
            logger: pinoLogger,
            browser: Browsers.macOS('Safari')
          });
        } catch (e) { return finish(false); }

        const timeout = setTimeout(() => { try { testSocket.ws?.close(); } catch(e){} finish(false); }, 15000);

        testSocket.ev.on('connection.update', (update) => {
          const { connection, lastDisconnect } = update;
          if (connection === 'open') {
            clearTimeout(timeout);
            try { testSocket.ws?.close(); } catch(e){}
            finish(false);
          } else if (connection === 'close') {
            clearTimeout(timeout);
            const isLoggedOut = isLoggedOutDisconnect(lastDisconnect);
            try { testSocket.ws?.close(); } catch(e){}
            finish(isLoggedOut);
          }
        });
      });

      if (loggedOut) {
        console.log(`🗑️ [STARTUP] Session ${sanitized} is logged out. Auto-deleting from Mongo...`);
        await removeSessionFromMongo(sanitized);
        await removeNumberFromMongo(sanitized);
      } else {
        console.log(`✅ [STARTUP] Session ${sanitized} looks valid.`);
      }
    } catch (e) {
      console.error(`[STARTUP] Validation error for ${sanitized}:`, e.message || e);
    } finally {
      try { if (fs.existsSync(checkPath)) fs.removeSync(checkPath); } catch(e){}
    }
    await delay(500);
  }
  console.log('✅ [STARTUP] Session validation complete.');
}

initMongo().catch(err => console.warn('Mongo init failed at startup', err));
initSettingsMongo().catch(err => console.warn('Settings Mongo init failed at startup', err));
initSakuraSessions().catch(err => console.warn('Sakura sessions Mongo init failed at startup', err));
(async()=>{
  try {
    await validateAndCleanSessions();
    const nums = await getAllNumbersFromMongo();
    if (nums && nums.length) { for (const n of nums) { if (!activeSockets.has(n)) { const mockRes = { headersSent:false, send:()=>{}, status:()=>mockRes }; await EmpirePair(n, mockRes); await delay(500); } } }
  } catch(e){}
})();

const HEALTH_CHECK_INTERVAL_MS = 6 * 60 * 1000;
let _healthCheckRunning = false;

async function runHealthCheck() {
  if (_healthCheckRunning) return;
  _healthCheckRunning = true;
  try {
    await initSakuraSessions();

    const numbers = await getAllNumbersFromMongo();
    if (!numbers || numbers.length === 0) {
      return;
    }

    let reconnected = 0;
    for (const number of numbers) {
      if (activeSockets.has(number)) continue;

      const mongoDoc = await loadCredsFromMongo(number);
      if (!mongoDoc || !mongoDoc.creds) {
        console.log(`❌ [HEALTH] No session found in MongoDB for ${number}. Skipping.`);
        continue;
      }

      console.log(`🔁 [HEALTH] ${number} is dropped. Reconnecting...`);
      try {
        const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
        await EmpirePair(number, mockRes);
        reconnected++;
      } catch (err) {
        console.log(`❌ [HEALTH] Failed to reconnect ${number}: ${err.message}`);
      }
      await delay(500);
    }

    if (reconnected > 0) {
      console.log(`✅ [HEALTH] Reconnected ${reconnected} dropped session(s).`);
    }

  } catch (err) {
    console.log(`❌ [HEALTH] Health check error: ${err.message}`);
  } finally {
    _healthCheckRunning = false;
  }
}

setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL_MS);

module.exports = router;

