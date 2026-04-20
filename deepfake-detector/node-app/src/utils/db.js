import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

prisma.$connect()
  .then(() => logger.info('Database connected successfully'))
  .catch((error) => logger.error('Database connection failed:', error));

export default prisma;
