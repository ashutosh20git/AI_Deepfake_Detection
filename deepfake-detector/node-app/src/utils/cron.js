import cron from 'node-cron';
import logger from './logger.js';
import { createWeeklyBatch } from '../services/retrainingBatchService.js';

export const startCron = () => {
  cron.schedule('0 2 * * 0', async () => {
    logger.info('Starting scheduled weekly retraining batch creation...');
    try {
      await createWeeklyBatch(false);
    } catch (error) {
      logger.error(`Cron job failed: ${error.message}`);
    }
  });
  logger.info('Cron jobs scheduled successfully.');
};
