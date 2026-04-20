import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

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

export default router;
