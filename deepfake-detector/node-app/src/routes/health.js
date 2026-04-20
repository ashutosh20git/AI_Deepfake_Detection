import express from 'express';
import prisma from '../utils/db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    res.json({
      status: 'ok',
      db: result && result.length > 0 ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
