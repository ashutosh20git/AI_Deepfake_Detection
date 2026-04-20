import express from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth, requireRole } from '../middleware/auth.js';
import analyzeRouter from './analyze.js';
import helpRouter from './help.js';
import { createWeeklyBatch } from '../services/retrainingBatchService.js';
import prisma from '../utils/db.js';
import logger from '../utils/logger.js';
import { adminLimiter } from '../middleware/rateLimits.js';
import { logEvent, AUDIT_ACTIONS } from '../services/auditLog.js';

const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
    offlineMfaEnabled: req.user.offlineMfaEnabled
  });
});

router.get('/admin/ping', requireAuth, adminLimiter, requireRole('ADMIN'), (req, res) => {
  res.json({ message: 'pong' });
});

router.use('/', analyzeRouter);
router.use('/help', helpRouter);

router.get('/admin/retraining-batches', requireAuth, adminLimiter, requireRole('ADMIN'), (req, res) => {
  try {
    const dataPath = '/app/retraining-data';
    if (!fs.existsSync(dataPath)) {
      return res.json([]);
    }
    
    const folders = fs.readdirSync(dataPath).filter(f => fs.statSync(path.join(dataPath, f)).isDirectory());
    
    const batches = folders.map(batchId => {
      const manifestPath = path.join(dataPath, batchId, 'manifest.json');
      let itemCount = 0;
      let createdAt = null;
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        itemCount = manifest.length;
        if (itemCount > 0) {
           createdAt = manifest[0].createdAt;
        }
      }
      
      const stats = fs.statSync(path.join(dataPath, batchId));
      if (!createdAt) createdAt = stats.mtime;

      return { batchId, itemCount, createdAt };
    });

    batches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(batches);

  } catch (error) {
     res.status(500).json({ error: error.message });
  }
});

router.post('/admin/retraining-batches/trigger', requireAuth, adminLimiter, requireRole('ADMIN'), async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await createWeeklyBatch(force);
    await logEvent(req, AUDIT_ACTIONS.ADMIN_BATCH_TRIGGERED, { force, created: !!result });
    
    if (!result) {
      return res.json({ message: 'Skipped batch creation: not enough items and force=false.' });
    }
    
    res.json({ message: 'Batch created successfully', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  '/admin/retraining-batches/:batchId/mark-trained',
  requireAuth,
  adminLimiter,
  requireRole('ADMIN'),
  async (req, res) => {
  try {
    const { batchId } = req.params;
    await logEvent(req, AUDIT_ACTIONS.ADMIN_BATCH_MARKED_TRAINED, { batchId });

    logger.info(`Retraining completed for batch ${batchId}`);
    res.json({ message: 'Retraining marked as completed' });
  } catch (error) {
     res.status(500).json({ error: error.message });
  }
}
);

router.patch('/admin/users/:userId/role', requireAuth, adminLimiter, requireRole('ADMIN'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!['ADMIN', 'ANALYST', 'FIELD_OPERATIVE'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    await logEvent(req, AUDIT_ACTIONS.ADMIN_USER_ROLE_CHANGED, {
      targetUserId: updated.id,
      targetEmail: updated.email,
      role: updated.role,
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/audit-log', requireAuth, adminLimiter, requireRole('ADMIN'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const requestedLimit = parseInt(req.query.limit, 10) || 50;
    const limit = Math.min(200, Math.max(1, requestedLimit));
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.userId) where.userId = req.query.userId;
    if (req.query.action) where.action = req.query.action;

    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to);
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      page,
      limit,
      total,
      items: items.map((item) => ({
        ...item,
        userEmail: item.user?.email || null,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
