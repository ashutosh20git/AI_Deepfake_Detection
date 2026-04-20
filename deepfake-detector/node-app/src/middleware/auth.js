import jwt from 'jsonwebtoken';
import { firebaseAuth } from '../services/firebaseAdmin.js';
import prisma from '../utils/db.js';
import logger from '../utils/logger.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decodedHeader = jwt.decode(token, { complete: true })?.header;

    if (!decodedHeader) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token format' });
    }

    let user;

    // Firebase Token
    if (decodedHeader.kid && decodedHeader.alg === 'RS256') {
      if (!firebaseAuth) {
        return res.status(500).json({ error: 'Firebase Auth is disabled but a Firebase token was provided.' });
      }
      
      const decodedToken = await firebaseAuth.verifyIdToken(token);
      user = await prisma.user.findUnique({
        where: { firebaseUid: decodedToken.uid }
      });
      
      if (!user) {
        return res.status(401).json({ error: 'User not synced with database yet.' });
      }
    } 
    // Local JWT Token
    else if (decodedHeader.alg === 'HS256') {
      const decodedLocal = jwt.verify(token, process.env.JWT_SECRET);
      user = await prisma.user.findUnique({
        where: { id: decodedLocal.userId }
      });
    } else {
      return res.status(401).json({ error: 'Unauthorized: Unsupported token type' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};
