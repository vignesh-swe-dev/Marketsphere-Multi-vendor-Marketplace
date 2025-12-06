/**
 * Test helper: starts a throw-away local MongoDB (temporary folder, free port), connects to it and loads
 * the demo data. Needs a MongoDB program (see src/localMongo.ts: MONGOD_PATH, a normal install, or auto-download).
 */
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { connectDB, disconnectDB, seedDatabase } from '../db.ts';
import { startLocalMongo } from '../localMongo.ts';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export async function startTestDb(): Promise<() => Promise<void>> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marketsphere-test-'));
  const mongo = await startLocalMongo({ dir, port: await freePort(), dbName: 'marketsphere_test' });
  await connectDB(mongo.uri);
  await seedDatabase();
  return async () => {
    await disconnectDB();
    await mongo.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  };
}
