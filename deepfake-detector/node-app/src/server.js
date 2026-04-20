import app from './app.js';
import logger from './utils/logger.js';
import dotenv from 'dotenv';
import { startCron } from './utils/cron.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  startCron();
});
