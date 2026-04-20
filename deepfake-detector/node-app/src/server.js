import dotenv from 'dotenv';
import app from './app.js';
import logger from './utils/logger.js';
import { startCron } from './utils/cron.js';
import prisma from './utils/db.js';
import { validateEnv } from './utils/envSchema.js';

dotenv.config();

let env;
let modeLabel = 'offline';
try {
  env = validateEnv(process.env);
  modeLabel = env.OFFLINE_MODE ? 'offline' : 'online';
} catch (error) {
  logger.error('Environment validation failed', {
    errors: error?.issues?.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })) || error.message,
  });
  process.exit(1);
}

const PORT = env.PORT || 3000;

prisma
  .$connect()
  .then(() => {
    logger.info('Database connected successfully');
    logger.info(
      '\n+-------------------------------------------------------------+\n' +
        `| ✓ Environment validated · mode: ${modeLabel} · db: connected |\n` +
        '+-------------------------------------------------------------+'
    );
  })
  .catch((error) => {
    logger.error('Database connection failed', { message: error.message });
    process.exit(1);
  });

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  startCron();
});
