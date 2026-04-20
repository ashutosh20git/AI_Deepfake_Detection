import rateLimit from 'express-rate-limit';

const userKeyGenerator = (req) => req.user?.id || req.ip;

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
});

export const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: userKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Analyze rate limit exceeded. Try again later.' },
});

export const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: userKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many chat requests from this user, please try again after an hour' },
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: userKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Admin rate limit exceeded. Try again shortly.' },
});
