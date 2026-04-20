import express from 'express';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import prisma from '../utils/db.js';
import { verifyCaptcha } from '../services/captcha.js';
import { firebaseAuth } from '../services/firebaseAdmin.js';
import { logEvent, AUDIT_ACTIONS } from '../services/auditLog.js';
import { requireAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { authLimiter } from '../middleware/rateLimits.js';

const router = express.Router();

router.use(authLimiter);

router.post('/sync', async (req, res, next) => {
  try {
    const { captchaToken } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];

    const isHuman = await verifyCaptcha(captchaToken, req.ip);
    if (!isHuman) return res.status(403).json({ error: 'Captcha verification failed' });

    if (!firebaseAuth) {
      return res.status(500).json({ error: 'Firebase is offline. Sync unavailable.' });
    }

    const decodedToken = await firebaseAuth.verifyIdToken(token);
    const email = decodedToken.email;
    const uid = decodedToken.uid;
    
    if (!email) return res.status(400).json({ error: 'Token missing email' });

    const existingUser = await prisma.user.findUnique({ where: { email } });

    const user = await prisma.user.upsert({
      where: { email },
      update: { firebaseUid: uid },
      create: { email, firebaseUid: uid, role: 'ANALYST' }
    });

    if (!existingUser) {
      await logEvent(req, AUDIT_ACTIONS.REGISTER, { userId: user.id, method: 'firebase' });
    }
    await logEvent(req, AUDIT_ACTIONS.LOGIN_FIREBASE, { userId: user.id });

    res.json({ id: user.id, email: user.email, role: user.role });
  } catch (error) {
    logger.error('Sync error:', error);
    next(error);
  }
});

router.post('/offline/setup-recovery', requireAuth, async (req, res, next) => {
  try {
    const { recoveryPassword } = req.body;
    
    // Validate password (>=12 chars, mixed)
    if (!recoveryPassword || recoveryPassword.length < 12 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(recoveryPassword)) {
      return res.status(400).json({ error: 'Password must be at least 12 characters and contain uppercase, lowercase, and numbers.' });
    }

    const hashedPassword = await bcrypt.hash(recoveryPassword, 10);
    const secret = speakeasy.generateSecret({ name: `DeepfakeDetector (${req.user.email})` });

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        offlinePasswordHash: hashedPassword,
        offlineMfaSecret: secret.base32,
        offlineMfaEnabled: false
      }
    });

    const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url);

    await logEvent(req, AUDIT_ACTIONS.MFA_SETUP, {});

    res.json({ qrCodeDataURL });
  } catch (error) {
    next(error);
  }
});

router.post('/offline/verify-recovery-mfa', requireAuth, async (req, res, next) => {
  try {
    const { code } = req.body;
    
    if (!req.user.offlineMfaSecret) {
      return res.status(400).json({ error: 'MFA setup not initiated' });
    }

    const verified = speakeasy.totp.verify({
      secret: req.user.offlineMfaSecret,
      encoding: 'base32',
      token: code
    });

    if (!verified) return res.status(401).json({ error: 'Invalid MFA code' });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { offlineMfaEnabled: true }
    });

    await logEvent(req, AUDIT_ACTIONS.MFA_VERIFY, {});

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/offline/login', async (req, res, next) => {
  try {
    if (process.env.OFFLINE_MODE !== 'true') {
      return res.status(403).json({ error: 'Offline login is disabled' });
    }

    const { email, recoveryPassword, mfaCode, captchaToken } = req.body;

    const isHuman = await verifyCaptcha(captchaToken, req.ip);
    if (!isHuman) return res.status(403).json({ error: 'Captcha verification failed' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.offlinePasswordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(recoveryPassword, user.offlinePasswordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.offlineMfaEnabled) {
      if (!mfaCode) return res.status(401).json({ error: 'MFA code required' });
      
      const verified = speakeasy.totp.verify({
        secret: user.offlineMfaSecret,
        encoding: 'base32',
        token: mfaCode
      });

      if (!verified) return res.status(401).json({ error: 'Invalid MFA code' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, mode: 'offline' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    req.user = user;
    await logEvent(req, AUDIT_ACTIONS.LOGIN_OFFLINE, { method: 'offline' });

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });

  } catch (error) {
    next(error);
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  await logEvent(req, AUDIT_ACTIONS.LOGOUT, {});
  res.json({ ok: true });
});

export default router;
