import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import logger from './utils/logger.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import apiRouter from './routes/api.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

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
