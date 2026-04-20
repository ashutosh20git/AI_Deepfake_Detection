import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import logger from './utils/logger.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import apiRouter from './routes/api.js';
import errorHandler from './middleware/errorHandler.js';

import path from 'path';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: false })); // allow images to be loaded
app.use(cors());
app.use(express.json());

// Serve gradcams statically
app.use('/gradcams', express.static(path.join(process.cwd(), 'uploads', 'gradcams')));

// Serve frontend public HTML assets
app.use(express.static('public'));

app.get('/', (req, res) => res.redirect('/login.html'));

app.get('/config.js', (req, res) => {
  const configStr = `window.ENV = {
    FIREBASE_SERVICE_ACCOUNT_PATH: "${process.env.FIREBASE_SERVICE_ACCOUNT_PATH || ''}",
    HCAPTCHA_SECRET: "${process.env.HCAPTCHA_SECRET || ''}",
    OFFLINE_MODE: "${process.env.OFFLINE_MODE || 'false'}"
  };`;
  res.type('application/javascript').send(configStr);
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
