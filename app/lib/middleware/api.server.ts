import { json } from '@remix-run/node';
import type { LoaderFunction, ActionFunction } from '@remix-run/node';
import { authenticator } from '~/lib/auth.server';

type MiddlewareConfig = {
  requireAuth?: boolean;
  rateLimit?: {
    max: number;
    windowMs: number;
  };
};

const defaultConfig: MiddlewareConfig = {
  requireAuth: true,
  rateLimit: {
    max: 100,
    windowMs: 15 * 60 * 1000 // 15 minutes
  }
};

// In-memory store for rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function withApiMiddleware(
  handler: LoaderFunction | ActionFunction,
  config: MiddlewareConfig = defaultConfig
) {
  return async (args: Parameters<LoaderFunction>[0]) => {
    const { request } = args;

    try {
      // Authentication check
      if (config.requireAuth) {
        const user = await authenticator.isAuthenticated(request);
        if (!user && process.env.NODE_ENV !== 'development') {
          return json({ error: 'Unauthorized' }, { status: 401 });
        }
      }

      // Rate limiting
      if (config.rateLimit) {
        const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
        const now = Date.now();
        const rateData = rateLimitStore.get(clientIp);

        if (rateData) {
          if (now > rateData.resetTime) {
            rateLimitStore.set(clientIp, { count: 1, resetTime: now + config.rateLimit.windowMs });
          } else if (rateData.count >= config.rateLimit.max) {
            return json(
              { error: 'Too many requests' },
              { 
                status: 429,
                headers: {
                  'Retry-After': String(Math.ceil((rateData.resetTime - now) / 1000))
                }
              }
            );
          } else {
            rateData.count++;
          }
        } else {
          rateLimitStore.set(clientIp, { count: 1, resetTime: now + config.rateLimit.windowMs });
        }
      }

      // Execute the handler
      return await handler(args);
    } catch (error) {
      console.error('API Error:', error);
      return json(
        { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
        { status: 500 }
      );
    }
  };
}