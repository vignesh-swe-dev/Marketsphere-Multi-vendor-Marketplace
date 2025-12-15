import { Router, type Request, type Response } from 'express';
import { makeAsyncSafe } from './lib/asyncRoutes.ts';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { NewsletterSubscriberModel } from './models/index.ts';
import { sendError } from './auth.ts';

export const newsletterRouter = makeAsyncSafe(Router());

// Rate limiter: 5 requests per 15 minutes per IP
export const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (_req: Request, res: Response) => {
    return sendError(
      res,
      429,
      'RATE_LIMITED',
      'Too many newsletter subscription attempts. Please try again in 15 minutes.'
    );
  },
});

const subscribeSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .email('Please enter a valid email address')
    .max(255, 'Email must not exceed 255 characters')
    .trim()
    .toLowerCase(),
  source: z.string().trim().max(100).optional().default('footer'),
});

/**
 * POST /api/v1/newsletter/subscribe
 * Idempotently subscribes an email to the marketplace newsletter.
 */
newsletterRouter.post('/subscribe', newsletterLimiter, async (req: Request, res: Response) => {
  const result = subscribeSchema.safeParse(req.body);

  if (!result.success) {
    const issue = result.error.issues[0];
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      issue?.message || 'Invalid email address provided',
      result.error.flatten()
    );
  }

  const { email, source } = result.data;

  try {
    // Check if already subscribed (Idempotent response)
    const existing = await NewsletterSubscriberModel.findOne({ email });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Subscribed to platform updates successfully.',
        email,
        isExisting: true,
      });
    }

    // Insert new subscriber
    await NewsletterSubscriberModel.create({
      email,
      source,
    });

    return res.status(201).json({
      success: true,
      message: 'Subscribed to platform updates successfully.',
      email,
    });
  } catch (err: any) {
    // Handle concurrent duplicate key race (code 11000 in MongoDB)
    if (err?.code === 11000 || err?.codeName === 'DuplicateKey') {
      return res.status(200).json({
        success: true,
        message: 'Subscribed to platform updates successfully.',
        email,
        isExisting: true,
      });
    }

    console.error('[NEWSLETTER ERROR]', err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Could not complete subscription. Please try again later.');
  }
});
