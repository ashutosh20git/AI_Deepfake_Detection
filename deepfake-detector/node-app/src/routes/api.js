import express from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth, requireRole } from '../middleware/auth.js';
import analyzeRouter from './analyze.js';
import helpRouter from './help.js';
import { createWeeklyBatch } from '../services/retrainingBatchService.js';
import prisma from '../utils/db.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
    offlineMfaEnabled: req.user.offlineMfaEnabled
  });
});

router.get('/admin/ping', requireAuth, requireRole('ADMIN'), (req, res) => {
  res.json({ message: 'pong' });
});

router.use('/', analyzeRouter);
router.use('/help', helpRouter);

router.get('/admin/retraining-batches', requireAuth, requireRole('ADMIN'), (req, res) => {
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

router.post('/admin/retraining-batches/trigger', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await createWeeklyBatch(force);
    
    if (!result) {
      return res.json({ message: 'Skipped batch creation: not enough items and force=false.' });
    }
    
    res.json({ message: 'Batch created successfully', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/retraining-batches/:batchId/mark-trained', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { batchId } = req.params;
    
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'RETRAINING_COMPLETED',
        metadata: { batchId }
      }
    });

    logger.info(`Retraining completed for batch ${batchId}`);
    res.json({ message: 'Retraining marked as completed' });
  } catch (error) {
     res.status(500).json({ error: error.message });
  }
});

export default router;
