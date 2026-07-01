'use strict';

/**
 * MongoDB store (used when DATABASE_URL is a mongodb:// / mongodb+srv:// string).
 *
 * Works with MongoDB Atlas (free tier) and any standard MongoDB. The `mongoose`
 * driver is required LAZILY so the file/Postgres backends never need it.
 * On first connect it seeds the reference data if the database is empty.
 *
 * The daily voucher limit is enforced by a compound UNIQUE index on
 * (email, locationId, date, mealType).
 *
 * All timestamps are stored as ISO strings and the application `id` is a plain
 * indexed field, so documents map 1:1 to the shape used by the other backends.
 */

const { getSeedData } = require('../seed');

const backend = 'mongodb';
let mongoose = null;
let models = null;

function strip(doc) {
  if (!doc) return null;
  const { _id, __v, ...rest } = doc;
  return rest;
}

async function init() {
  try {
    mongoose = require('mongoose');
  } catch (e) {
    throw new Error(
      "DATABASE_URL points to MongoDB but the 'mongoose' package is not installed. " +
        "Run `npm install mongoose` (it is listed in optionalDependencies)."
    );
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(process.env.DATABASE_URL);

  const { Schema } = mongoose;
  const opts = { versionKey: false };

  const Meta = model('Meta', new Schema({ key: { type: String, unique: true }, event: String, city: String, subtitle: String }, opts));
  const Location = model('Location', new Schema({ id: { type: String, unique: true }, name: String, type: String, zone: String, window: String }, opts));
  const User = model('User', new Schema({ email: { type: String, unique: true }, accreditationNumber: String, createdAt: String }, opts));

  const voucherSchema = new Schema({
    id: { type: String, unique: true },
    email: String,
    accreditationNumber: String,
    locationId: String,
    locationName: String,
    locationType: String,
    mealType: String,
    date: String,
    status: String,
    issuedAt: String,
    redeemedAt: { type: String, default: null },
  }, opts);
  voucherSchema.index({ email: 1, locationId: 1, date: 1, mealType: 1 }, { unique: true });
  const Voucher = model('Voucher', voucherSchema);

  const News = model('News', new Schema({ id: { type: String, unique: true }, title: String, body: String, category: String, pinned: Boolean, timestamp: String, attachments: { type: Array, default: [] } }, opts));
  const Press = model('Press', new Schema({ id: { type: String, unique: true }, date: String, time: String, team: String, room: String, status: String, note: String }, opts));
  const Transport = model('Transport', new Schema({ id: { type: String, unique: true }, route: String, type: String, from: String, to: String, frequency: String, firstDeparture: String, lastDeparture: String, duration: String, notes: String }, opts));
  const Category = model('Category', new Schema({ id: { type: String, unique: true }, name: String, color: String }, opts));

  models = { Meta, Location, User, Voucher, News, Press, Transport, Category };

  // Ensure indexes (incl. the unique voucher constraint) are built.
  await Promise.all(Object.values(models).map((m) => m.init()));
  await seedIfEmpty();
  await seedCategoriesIfEmpty();
}

/** Reuse an already-compiled model if init() runs more than once. */
function model(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

async function seedIfEmpty() {
  const count = await models.Location.countDocuments();
  if (count > 0) return;

  const seed = getSeedData();
  console.log('[store:mongodb] Empty database — seeding reference data.');

  await models.Meta.updateOne({ key: 'meta' }, { $set: { key: 'meta', ...seed.meta } }, { upsert: true });
  if (seed.locations.length) await models.Location.insertMany(seed.locations);
  if (seed.users.length) await models.User.insertMany(seed.users);
  if (seed.news.length) await models.News.insertMany(seed.news);
  if (seed.pressConferences.length) await models.Press.insertMany(seed.pressConferences);
  if (seed.transport.length) await models.Transport.insertMany(seed.transport);
}

// Seed default categories independently (databases created before this feature
// still get the defaults on the next boot).
async function seedCategoriesIfEmpty() {
  if (await models.Category.countDocuments()) return;
  await models.Category.insertMany(getSeedData().categories);
}

// ---- meta -------------------------------------------------------------------

async function getMeta() {
  const doc = await models.Meta.findOne({ key: 'meta' }).lean();
  if (!doc) return getSeedData().meta;
  const { key, ...meta } = strip(doc);
  return meta;
}

// ---- locations --------------------------------------------------------------

async function listLocations() {
  const rows = await models.Location.find().sort({ type: 1, name: 1 }).lean();
  return rows.map(strip);
}

async function getLocation(id) {
  return strip(await models.Location.findOne({ id }).lean());
}

async function createLocation(loc) {
  await models.Location.create(loc);
  return loc;
}

async function updateLocation(id, fields) {
  const allowed = pick(fields, ['name', 'type', 'zone', 'window']);
  return strip(await models.Location.findOneAndUpdate({ id }, { $set: allowed }, { new: true }).lean());
}

async function deleteLocation(id) {
  const r = await models.Location.deleteOne({ id });
  return r.deletedCount > 0;
}

// ---- users ------------------------------------------------------------------

async function getUserByEmail(email) {
  return strip(await models.User.findOne({ email }).lean());
}

async function createUser(user) {
  await models.User.updateOne({ email: user.email }, { $setOnInsert: user }, { upsert: true });
  return user;
}

async function listUsers() {
  return (await models.User.find().lean()).map(strip);
}

async function countUsers() {
  return models.User.countDocuments();
}

// ---- vouchers ---------------------------------------------------------------

async function createVoucher(v) {
  try {
    await models.Voucher.create(v);
    return v;
  } catch (err) {
    if (err && err.code === 11000) {
      const e = new Error('Duplicate voucher');
      e.code = 'DUP_VOUCHER';
      throw e;
    }
    throw err;
  }
}

async function getVoucher(id) {
  return strip(await models.Voucher.findOne({ id }).lean());
}

async function findDayVouchers({ email, locationId, date }) {
  return (await models.Voucher.find({ email, locationId, date }).lean()).map(strip);
}

async function findUserDayVouchers({ email, date }) {
  return (await models.Voucher.find({ email, date }).sort({ issuedAt: 1 }).lean()).map(strip);
}

async function redeemVoucher(id, atIso) {
  const doc = await models.Voucher.findOneAndUpdate(
    { id, status: 'Pending' },
    { $set: { status: 'Redeemed', redeemedAt: atIso } },
    { new: true }
  ).lean();
  return strip(doc);
}

async function listVouchers() {
  return (await models.Voucher.find().sort({ issuedAt: 1 }).lean()).map(strip);
}

async function expireStale(today) {
  await models.Voucher.updateMany({ status: 'Pending', date: { $lt: today } }, { $set: { status: 'Expired' } });
}

// ---- news -------------------------------------------------------------------

async function listNews() {
  return (await models.News.find().lean()).map(strip);
}

async function createNews(item) {
  await models.News.create(item);
  return item;
}

async function updateNews(id, fields) {
  const allowed = pick(fields, ['title', 'body', 'category', 'pinned', 'attachments']);
  return strip(await models.News.findOneAndUpdate({ id }, { $set: allowed }, { new: true }).lean());
}

async function deleteNews(id) {
  const r = await models.News.deleteOne({ id });
  return r.deletedCount > 0;
}

// ---- press conferences ------------------------------------------------------

async function listPress() {
  return (await models.Press.find().lean()).map(strip);
}

async function createPress(item) {
  await models.Press.create(item);
  return item;
}

async function updatePress(id, fields) {
  const allowed = pick(fields, ['date', 'time', 'team', 'room', 'status', 'note']);
  return strip(await models.Press.findOneAndUpdate({ id }, { $set: allowed }, { new: true }).lean());
}

async function deletePress(id) {
  const r = await models.Press.deleteOne({ id });
  return r.deletedCount > 0;
}

// ---- transport --------------------------------------------------------------

async function listTransport() {
  return (await models.Transport.find().lean()).map(strip);
}

async function createTransport(item) {
  await models.Transport.create(item);
  return item;
}

async function updateTransport(id, fields) {
  const allowed = pick(fields, ['route', 'type', 'from', 'to', 'frequency', 'firstDeparture', 'lastDeparture', 'duration', 'notes']);
  return strip(await models.Transport.findOneAndUpdate({ id }, { $set: allowed }, { new: true }).lean());
}

async function deleteTransport(id) {
  const r = await models.Transport.deleteOne({ id });
  return r.deletedCount > 0;
}

// ---- categories -------------------------------------------------------------

async function listCategories() {
  return (await models.Category.find().sort({ name: 1 }).lean()).map(strip);
}

async function createCategory(item) {
  await models.Category.create(item);
  return item;
}

async function updateCategory(id, fields) {
  const allowed = pick(fields, ['name', 'color']);
  return strip(await models.Category.findOneAndUpdate({ id }, { $set: allowed }, { new: true }).lean());
}

async function deleteCategory(id) {
  const r = await models.Category.deleteOne({ id });
  return r.deletedCount > 0;
}

// ---- helpers ----------------------------------------------------------------

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

module.exports = {
  backend,
  init,
  getMeta,
  listLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  getUserByEmail,
  createUser,
  listUsers,
  countUsers,
  createVoucher,
  getVoucher,
  findDayVouchers,
  findUserDayVouchers,
  redeemVoucher,
  listVouchers,
  expireStale,
  listNews,
  createNews,
  updateNews,
  deleteNews,
  listPress,
  createPress,
  updatePress,
  deletePress,
  listTransport,
  createTransport,
  updateTransport,
  deleteTransport,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
