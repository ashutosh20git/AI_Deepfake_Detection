import prisma from '../utils/db.js';
import logger from '../utils/logger.js';

export const AUDIT_ACTIONS = {
  LOGIN_FIREBASE: 'LOGIN_FIREBASE',
  LOGIN_OFFLINE: 'LOGIN_OFFLINE',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  MFA_SETUP: 'MFA_SETUP',
  MFA_VERIFY: 'MFA_VERIFY',
  ANALYZE_STARTED: 'ANALYZE_STARTED',
  ANALYZE_COMPLETED: 'ANALYZE_COMPLETED',
  ANALYZE_FAILED: 'ANALYZE_FAILED',
  ANALYSIS_VIEWED: 'ANALYSIS_VIEWED',
  GRADCAM_ACCESSED: 'GRADCAM_ACCESSED',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  EXPLAIN_REQUESTED: 'EXPLAIN_REQUESTED',
  ADMIN_QUEUE_VIEWED: 'ADMIN_QUEUE_VIEWED',
  ADMIN_BATCH_TRIGGERED: 'ADMIN_BATCH_TRIGGERED',
  ADMIN_BATCH_MARKED_TRAINED: 'ADMIN_BATCH_MARKED_TRAINED',
  ADMIN_USER_ROLE_CHANGED: 'ADMIN_USER_ROLE_CHANGED',
};

export const log = async (action, userId, metadata = {}, req = null) => {
  try {
    const ipAddress = req ? req.ip || req.connection?.remoteAddress || null : null;
    const userAgent = req?.headers?.['user-agent'] || null;
    await prisma.auditLog.create({
      data: {
        action,
        userId,
        metadata: { ...(metadata || {}), userAgent },
        ipAddress,
      },
    });
  } catch (error) {
    logger.error(`Failed to create audit log for action ${action}:`, error);
  }
};

export const logEvent = async (req, action, metadata = {}) => {
  const userId = req?.user?.id || null;
  await log(action, userId, metadata, req);
};
