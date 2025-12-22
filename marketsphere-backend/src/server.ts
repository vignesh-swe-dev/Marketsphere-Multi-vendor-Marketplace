import 'dotenv/config'; // must stay first: loads .env before other modules read process.env
import { createApp } from './app.ts';
import { connectDB, disconnectDB } from './db.ts';

const PORT = Number(process.env.PORT) || 4000;

// Connect to MongoDB Atlas
try {
  await connectDB();
} catch (err) {
  console.error('[FATAL] Could not connect to MongoDB:', err);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  if (process.env.ALLOW_SANDBOX_PAYMENTS === 'true') {
    console.warn('[PAYMENTS WARNING] The SANDBOX payment provider is enabled in production. Orders can be marked paid without real money.');
  } else {
    console.warn('[PAYMENTS] No real payment gateway is connected, so checkout payment is disabled in production.');
  }
}

const app = createApp();

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`MarketSphere API running on http://localhost:${PORT}/api/v1`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    try {
      await disconnectDB();
    } catch {
      /* already closed */
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

// A failure in one request must never take the whole API down
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
