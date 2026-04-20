import prisma from '../utils/db.js';
import logger from '../utils/logger.js';

export const log = async (action, userId, metadata = {}, req = null) => {
  try {
    const ipAddress = req ? (req.ip || req.connection?.remoteAddress) : null;
    await prisma.auditLog.create({
      data: {
        action,
        userId,
        metadata,
        ipAddress
      }
    });
  } catch (error) {
    logger.error(`Failed to create audit log for action ${action}:`, error);
  }
};
