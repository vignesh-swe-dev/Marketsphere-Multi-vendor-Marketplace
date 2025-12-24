// npm run db:seed   -> same as db:reset (clears everything, loads the demo marketplace)
import './_db.ts';
import { requireConfirmationForRemote } from './_db.ts';
import { connectDB, disconnectDB, getDbMode, seedDatabase } from '../src/db.ts';

try {
  await connectDB();
  requireConfirmationForRemote('erase and reseed', getDbMode());
  await seedDatabase();
  console.log('Demo data loaded.');
} catch (err) {
  console.error('Seeding failed:', err);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
