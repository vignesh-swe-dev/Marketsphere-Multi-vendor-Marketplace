// npm run db:reset   -> deletes ALL data and loads the demo marketplace again
import './_db.ts';
import { requireConfirmationForRemote } from './_db.ts';
import { connectDB, disconnectDB, getDbMode, seedDatabase } from '../src/db.ts';

try {
  // Connect first (without auto-seeding being a problem: seedDatabase clears everything anyway)
  await connectDB();
  requireConfirmationForRemote('erase and reseed', getDbMode());
  await seedDatabase();
  console.log('Database reset and demo data loaded.');
} catch (err) {
  console.error('Database reset failed:', err);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
