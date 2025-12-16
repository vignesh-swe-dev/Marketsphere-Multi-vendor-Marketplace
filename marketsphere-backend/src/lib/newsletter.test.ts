import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import express from 'express';
import { newsletterRouter } from '../newsletter.ts';
import { NewsletterSubscriberModel } from '../models/NewsletterSubscriber.ts';

let server: Server;
let baseUrl: string;

// In-memory mock storage for newsletter subscribers during tests
const mockSubscribers = new Map<string, { email: string; source: string; createdAt: Date }>();

test.before(async () => {
  // Mock Mongoose model methods to make tests deterministic and self-contained
  (NewsletterSubscriberModel as any).findOne = async ({ email }: { email: string }) => {
    return mockSubscribers.get(email.toLowerCase()) || null;
  };

  (NewsletterSubscriberModel as any).create = async (doc: { email: string; source: string }) => {
    const record = { ...doc, email: doc.email.toLowerCase(), createdAt: new Date() };
    mockSubscribers.set(record.email, record);
    return record;
  };

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/v1/newsletter', newsletterRouter);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}/api/v1/newsletter`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

test('POST /subscribe validates email format with Zod and returns 400 on invalid input', async () => {
  const invalidPayloads = [
    {},
    { email: '' },
    { email: 'not-an-email' },
    { email: 'missing-tld@domain' },
  ];

  for (const body of invalidPayloads) {
    const res = await fetch(`${baseUrl}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.168.1.1',
      },
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 400, `Expected 400 for payload ${JSON.stringify(body)}`);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'VALIDATION_ERROR');
  }
});

test('POST /subscribe successfully subscribes a new valid email with 201 status', async () => {
  const res = await fetch(`${baseUrl}/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '192.168.1.2',
    },
    body: JSON.stringify({ email: 'newsubscriber@example.in', source: 'footer' }),
  });

  assert.equal(res.status, 201);
  const data = (await res.json()) as any;
  assert.equal(data.success, true);
  assert.equal(data.email, 'newsubscriber@example.in');
});

test('POST /subscribe is idempotent: subscribing an existing email returns 200 with success', async () => {
  // First subscription
  const res1 = await fetch(`${baseUrl}/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '192.168.1.3',
    },
    body: JSON.stringify({ email: 'duplicate@example.in' }),
  });
  assert.equal(res1.status, 201);

  // Second subscription with same email
  const res2 = await fetch(`${baseUrl}/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '192.168.1.3',
    },
    body: JSON.stringify({ email: 'DUPLICATE@example.in' }), // case insensitive
  });

  assert.equal(res2.status, 200);
  const data = (await res2.json()) as any;
  assert.equal(data.success, true);
  assert.equal(data.email, 'duplicate@example.in');
  assert.equal(data.isExisting, true);
});

test('POST /subscribe enforces rate limit (5 attempts per 15 minutes per IP)', async () => {
  const testIp = '192.168.1.99';
  let rateLimited = false;

  for (let i = 0; i < 7; i++) {
    const res = await fetch(`${baseUrl}/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': testIp,
      },
      body: JSON.stringify({ email: `ratelimit_${i}@example.in` }),
    });

    if (res.status === 429) {
      rateLimited = true;
      const data = (await res.json()) as any;
      assert.equal(data.error.code, 'RATE_LIMITED');
      break;
    }
  }

  assert.ok(rateLimited, 'Expected rate limiter to trigger HTTP 429 on 6th request from same IP');
});
