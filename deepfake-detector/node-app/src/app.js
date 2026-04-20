import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import logger from './utils/logger.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import apiRouter from './routes/api.js';
import errorHandler from './middleware/errorHandler.js';
import path from 'path';
import prisma from './utils/db.js';
import { requireAuth } from './middleware/auth.js';
import { logEvent, AUDIT_ACTIONS } from './services/auditLog.js';

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'cdn.tailwindcss.com',
          'cdn.jsdelivr.net',
          'www.gstatic.com',
          'www.googleapis.com',
          'js.hcaptcha.com',
          '*.hcaptcha.com',
        ],
        connectSrc: [
          "'self'",
          '*.googleapis.com',
          '*.firebaseio.com',
          'securetoken.googleapis.com',
          'identitytoolkit.googleapis.com',
          '*.hcaptcha.com',
          'generativelanguage.googleapis.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        fontSrc: ["'self'", 'fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        frameSrc: ['*.hcaptcha.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'PATCH'],
  })
);

app.use(express.json());

// Serve frontend public HTML assets
app.use(express.static('public'));

app.get('/', (req, res) => res.redirect('/login.html'));

app.get('/config.js', (req, res) => {
  const configStr = `window.ENV = {
    OFFLINE_MODE: "${process.env.OFFLINE_MODE || 'false'}",
    HCAPTCHA_SITE_KEY: "${process.env.HCAPTCHA_SITE_KEY || ''}",
    FIREBASE_API_KEY: "${process.env.FIREBASE_API_KEY || ''}",
    FIREBASE_AUTH_DOMAIN: "${process.env.FIREBASE_AUTH_DOMAIN || ''}",
    FIREBASE_PROJECT_ID: "${process.env.FIREBASE_PROJECT_ID || ''}",
    FIREBASE_APP_ID: "${process.env.FIREBASE_APP_ID || ''}",
    FIREBASE_MESSAGING_SENDER_ID: "${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}"
  };`;
  res.type('application/javascript').send(configStr);
});

app.get('/gradcams/:filename', requireAuth, async (req, res) => {
  try {
    const filename = req.params.filename;
    const gradcamPath = `/gradcams/${filename}`;
    const analysis = await prisma.analysis.findFirst({
      where: { gradcamPath },
      select: { id: true, userId: true },
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Grad-CAM image not found' });
    }

    const authorized =
      analysis.userId === req.user.id || ['ADMIN', 'ANALYST'].includes(req.user.role);

    if (!authorized) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await logEvent(req, AUDIT_ACTIONS.GRADCAM_ACCESSED, {
      analysisId: analysis.id,
      filename,
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(path.resolve(process.cwd(), 'uploads', 'gradcams', filename));
  } catch (error) {
    logger.error(`Grad-CAM access failed: ${error.message}`);
    res.status(500).json({ error: 'Unable to retrieve Grad-CAM image' });
  }
});

// Request logger middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.use(errorHandler);

export default app;
