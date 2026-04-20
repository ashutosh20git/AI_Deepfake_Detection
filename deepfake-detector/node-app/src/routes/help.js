import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { generateReply, generateAnalysisExplanation } from '../services/geminiService.js';
import prisma from '../utils/db.js';
import logger from '../utils/logger.js';

const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30, // Limit each user to 30 requests per hour
  keyGenerator: (req) => req.user.id,
  message: { error: 'Too many chat requests from this user, please try again after an hour' }
});

router.post('/chat', requireAuth, chatLimiter, async (req, res) => {
  const { message, sessionId } = req.body;
  
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    let currentSessionId = sessionId;

    if (!currentSessionId) {
      const newSession = await prisma.chatSession.create({
        data: {
          userId: req.user.id,
          title: message.substring(0, 40)
        }
      });
      currentSessionId = newSession.id;
    } else {
      const session = await prisma.chatSession.findUnique({ where: { id: currentSessionId } });
      if (!session || session.userId !== req.user.id) {
        return res.status(403).json({ error: 'Session not found or forbidden' });
      }
    }

    await prisma.chatMessage.create({
      data: {
        sessionId: currentSessionId,
        role: 'user',
        content: message
      }
    });

    const oldMessages = await prisma.chatMessage.findMany({
      where: { sessionId: currentSessionId },
      orderBy: { createdAt: 'asc' },
      take: 21
    });
    
    oldMessages.pop(); // Remove the current user message to separate it from the history array
    const history = oldMessages.slice(-20);

    const lastAnalyses = await prisma.analysis.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    let contextSummary = "No videos analyzed yet.";
    if (lastAnalyses.length > 0) {
        let high = 0, authentic = 0, review = 0;
        for (const a of lastAnalyses) {
          if (a.riskLevel === 'HIGH_RISK') high++;
          else if (a.riskLevel === 'AUTHENTIC') authentic++;
          if (a.needsReview) review++;
        }
        contextSummary = `You've analyzed ${lastAnalyses.length} videos recently: ${high} high risk, ${authentic} authentic, ${review} needing review.`;
    }

    const replyText = await generateReply(history, message, contextSummary);

    await prisma.chatMessage.create({
      data: {
        sessionId: currentSessionId,
        role: 'model',
        content: replyText
      }
    });

    res.json({ sessionId: currentSessionId, reply: replyText });

  } catch (error) {
    logger.error(`Error in /chat: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true }
        }
      }
    });
    
    const mapped = sessions.map(s => ({
      ...s,
      lastMessage: s.messages.length > 0 ? s.messages[0].content : null
    }));
    
    res.json(mapped);
  } catch (error) {
    logger.error(`Error fetching sessions: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: req.params.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });
    
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    
    res.json(session);
  } catch (error) {
    logger.error(`Error fetching session: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const session = await prisma.chatSession.findUnique({ where: { id: req.params.id }});
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.chatMessage.deleteMany({ where: { sessionId: session.id } });
    await prisma.chatSession.delete({ where: { id: session.id } });
    
    res.json({ message: 'Session deleted' });
  } catch (error) {
    logger.error(`Error deleting session: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/explain-analysis/:analysisId', requireAuth, async (req, res) => {
  try {
    const analysis = await prisma.analysis.findUnique({
      where: { id: req.params.analysisId }
    });
    
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    
    if (analysis.userId !== req.user.id && !['ADMIN', 'ANALYST'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const explanation = await generateAnalysisExplanation(analysis);
    res.json({ explanation });
  } catch (error) {
     logger.error(`Error in explain-analysis: ${error.message}`);
     res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
