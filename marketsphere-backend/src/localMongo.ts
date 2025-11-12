/**
 * "Local" database mode: runs a real MongoDB on this computer, no account and no manual setup.
 *
 *  - Data is stored on disk in ./data/mongo, so it survives restarts.
 *  - It runs as a single-node replica set, so transactions behave exactly like MongoDB Atlas.
 *  - The mongod program is taken from, in this order:
 *      1. MONGOD_PATH                    (explicit path to a mongod binary)
 *      2. `mongod` found on your PATH    (a normal MongoDB installation)
 *      3. an automatic download          (first run only, via mongodb-memory-server)
 *
 * Set MONGODB_URI to use MongoDB Atlas (or any other MongoDB) instead; this file is then not used.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import mongoose from 'mongoose';

export interface LocalMongoOptions {
  /** Folder for database files. Default: ./data/mongo */
  dir?: string;
  /** TCP port. Default: 27018 (not 27017, so it never clashes with a MongoDB you installed yourself). */
  port?: number;
  dbName?: string;
}

export interface LocalMongoHandle {
  uri: string;
  dir: string;
  port: number;
  /** false when an already-running local MongoDB was reused */
  started: boolean;
  stop(): Promise<void>;
}

const REPL_SET = 'marketsphere';

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function findOnPath(name: string): string | null {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        /* not here */
      }
    }
  }
  return null;
}

async function resolveMongodBinary(): Promise<string> {
  const explicit = process.env.MONGOD_PATH?.trim() || process.env.MONGOMS_SYSTEM_BINARY?.trim();
  if (explicit) {
    if (!fs.existsSync(explicit)) throw new Error(`MONGOD_PATH points to a file that does not exist: ${explicit}`);
    return explicit;
  }

  const onPath = findOnPath('mongod');
  if (onPath) return onPath;

  try {
    console.log('[DB] No MongoDB installation found. Downloading one (first run only, about 200 MB)...');
    const { MongoBinary } = await import('mongodb-memory-server');
    return await MongoBinary.getPath();
  } catch (err: any) {
    throw new Error(
      'Could not find or download MongoDB for local mode.\n' +
        `  Reason: ${err?.message || err}\n\n` +
        '  Choose one:\n' +
        '    1. Install MongoDB Community Server (https://www.mongodb.com/try/download/community), then run again.\n' +
        '    2. Use a free MongoDB Atlas cluster: put its connection string in MONGODB_URI in backend/.env.\n' +
        '    3. Set MONGOD_PATH to the full path of an existing mongod program.'
    );
  }
}

async function connectDirect(port: number): Promise<mongoose.mongo.MongoClient> {
  const client = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, {
    serverSelectionTimeoutMS: 1500,
  });
  await client.connect();
  return client;
}

/** Make sure the single-node replica set is initialised and has elected itself primary. */
async function ensureReplicaSet(port: number): Promise<void> {
  const client = await connectDirect(port);
  try {
    const admin = client.db('admin');
    let hello = await admin.command({ hello: 1 });
    if (!hello.setName) {
      await admin.command({ replSetInitiate: { _id: REPL_SET, members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    }
    for (let i = 0; i < 60; i++) {
      hello = await admin.command({ hello: 1 });
      if (hello.isWritablePrimary) return;
      await sleep(500);
    }
    throw new Error('Local MongoDB did not become ready in time');
  } finally {
    await client.close();
  }
}

export async function startLocalMongo(options: LocalMongoOptions = {}): Promise<LocalMongoHandle> {
  const dir = path.resolve(options.dir || process.env.LOCAL_DB_DIR || './data/mongo');
  const port = options.port ?? (Number(process.env.LOCAL_MONGO_PORT) || 27018);
  const dbName = options.dbName || 'marketsphere';
  const uri = `mongodb://127.0.0.1:${port}/${dbName}?replicaSet=${REPL_SET}`;

  // A previous run may have left its MongoDB running (for example after a crash). Reuse it.
  if (await isPortOpen(port)) {
    try {
      await ensureReplicaSet(port);
      console.log(`[DB] Reusing the local MongoDB already running on port ${port}.`);
      return { uri, dir, port, started: false, stop: async () => {} };
    } catch (err: any) {
      throw new Error(
        `Port ${port} is in use by something that is not the MarketSphere local database (${err?.message}). ` +
          'Set LOCAL_MONGO_PORT to a free port, or stop the other program.'
      );
    }
  }

  fs.mkdirSync(dir, { recursive: true });
  const binary = await resolveMongodBinary();
  const logFile = path.join(dir, 'mongod.log');

  const args = [
    '--dbpath', dir,
    '--port', String(port),
    '--bind_ip', '127.0.0.1',
    '--replSet', REPL_SET,
    '--logpath', logFile,
    '--logappend',
    '--wiredTigerCacheSizeGB', '0.5',
  ];
  const child: ChildProcess = spawn(binary, args, { stdio: 'ignore', windowsHide: true });

  let exited = false;
  let exitInfo = '';
  child.once('exit', (code, signal) => {
    exited = true;
    exitInfo = `code ${code ?? 'null'}${signal ? `, signal ${signal}` : ''}`;
  });
  child.once('error', (err) => {
    exited = true;
    exitInfo = err.message;
  });

  // Wait until it accepts connections
  const deadline = Date.now() + 45_000;
  while (!(await isPortOpen(port))) {
    if (exited) {
      let tail = '';
      try {
        tail = fs.readFileSync(logFile, 'utf8').split('\n').slice(-8).join('\n');
      } catch {
        /* no log */
      }
      throw new Error(`Local MongoDB stopped right after starting (${exitInfo}).\n${tail}`);
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`Local MongoDB did not start within 45 seconds. See ${logFile}`);
    }
    await sleep(300);
  }

  await ensureReplicaSet(port);

  let stopped = false;
  const stop = async () => {
    if (stopped || exited) return;
    stopped = true;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 10_000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill('SIGTERM');
    });
  };
  // Never leave the database process running if this server dies
  process.once('exit', () => {
    if (!exited) child.kill('SIGTERM');
  });

  return { uri, dir, port, started: true, stop };
}
