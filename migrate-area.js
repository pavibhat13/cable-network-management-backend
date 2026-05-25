require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cable-network';

async function migrate() {
  console.log('[MIGRATE] Connecting to:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('[MIGRATE] Connected.');

  const result = await mongoose.connection.collection('jointboxes').updateMany(
    { area: 'Hosabandikeri' },
    { $set: { area: 'Medarakeri' } }
  );

  console.log(`[MIGRATE] Updated ${result.modifiedCount} documents (matched ${result.matchedCount}).`);
  await mongoose.disconnect();
  console.log('[MIGRATE] Done.');
}

migrate().catch((err) => {
  console.error('[MIGRATE] Error:', err.message);
  process.exit(1);
});
