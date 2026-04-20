import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { fileTypeFromBuffer } from 'file-type';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { analyzeVideo } from '../services/mlService.js';
import { classifyRisk } from '../services/agenticDecision.js';
import prisma from '../utils/db.js';
import logger from '../utils/logger.js';
import { analyzeLimiter, adminLimiter } from '../middleware/rateLimits.js';
import { logEvent, AUDIT_ACTIONS } from '../services/auditLog.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join('uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, MOV, and AVI are allowed.'));
    }
  }
});

const ALLOWED_MAGIC_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/x-msvideo']);

router.post('/analyze', requireAuth, analyzeLimiter, upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided.' });
  }

  const filePath = req.file.path;
  const analysisId = uuidv4();
  const baseFilename = path.parse(req.file.filename).name;

  try {
    await logEvent(req, AUDIT_ACTIONS.ANALYZE_STARTED, {
      uploadFilename: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    const fileBuffer = fs.readFileSync(filePath);
    const magicHeader = fileBuffer.subarray(0, 4100);
    const fileType = await fileTypeFromBuffer(magicHeader);
    const fileStats = fs.statSync(filePath);

    if (fileStats.size > 50 * 1024 * 1024) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Invalid file format' });
    }

    if (!fileType || !ALLOWED_MAGIC_MIME_TYPES.has(fileType.mime)) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Invalid file format' });
    }

    const mlResult = await analyzeVideo(filePath);
    const decision = classifyRisk(mlResult);

    const gradcamPath = path.join('uploads', 'gradcams', `${baseFilename}.png`);
    const gradcamUrl = `/gradcams/${baseFilename}.png`;

    if (mlResult.gradcam_base64) {
      fs.writeFileSync(gradcamPath, Buffer.from(mlResult.gradcam_base64, 'base64'));
    }

    const newAnalysis = await prisma.analysis.create({
      data: {
        id: analysisId,
        userId: req.user.id,
        videoFilename: req.file.filename,
        frameScores: mlResult.frame_scores,
        aggregatedConfidence: mlResult.aggregated_confidence,
        scoreStd: mlResult.score_std,
        framesAnalyzed: mlResult.frames_analyzed,
        facesDetected: mlResult.faces_detected,
        riskLevel: decision.riskLevel,
        needsReview: decision.needsReview,
        reasoning: decision.reasoning,
        gradcamPath: gradcamUrl
      }
    });

    if (decision.needsReview) {
      await prisma.reviewQueueItem.create({
        data: {
          analysisId: newAnalysis.id,
          status: 'PENDING'
        }
      });
    }

    await logEvent(req, AUDIT_ACTIONS.ANALYZE_COMPLETED, {
      analysisId: newAnalysis.id,
      riskLevel: decision.riskLevel,
      confidence: decision.confidence,
      needsReview: decision.needsReview,
    });

    res.json({
      analysisId: newAnalysis.id,
      riskLevel: decision.riskLevel,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      needsReview: decision.needsReview,
      gradcamUrl: gradcamUrl,
      frameScores: mlResult.frame_scores,
      framesAnalyzed: mlResult.frames_analyzed,
      facesDetected: mlResult.faces_detected,
      scoreStd: mlResult.score_std
    });

  } catch (error) {
    logger.error(`Analysis failed: ${error.message}`);
    await logEvent(req, AUDIT_ACTIONS.ANALYZE_FAILED, {
      uploadFilename: req.file?.filename,
      error: error.message,
    });
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(500).json({ error: 'An error occurred during analysis.' });
  }
});

router.get('/analyses', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const analyses = await prisma.analysis.findMany({
      where: { userId: req.user.id },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        riskLevel: true,
        aggregatedConfidence: true,
        createdAt: true,
        needsReview: true
      }
    });

    const mapped = analyses.map(a => ({
      ...a,
      confidence: a.aggregatedConfidence
    }));

    res.json(mapped);
  } catch (error) {
    logger.error(`Error fetching analyses: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch analyses.' });
  }
});

router.get('/analyses/:id', requireAuth, async (req, res) => {
  try {
    const analysis = await prisma.analysis.findUnique({
      where: { id: req.params.id }
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    if (analysis.userId !== req.user.id && !['ADMIN', 'ANALYST'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await logEvent(req, AUDIT_ACTIONS.ANALYSIS_VIEWED, { analysisId: analysis.id });

    res.json({
      ...analysis,
      confidence: analysis.aggregatedConfidence,
      gradcamUrl: analysis.gradcamPath
    });
  } catch (error) {
    logger.error(`Error fetching analysis detail: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch analysis.' });
  }
});

router.get(
  '/admin/review-queue',
  requireAuth,
  adminLimiter,
  requireRole('ADMIN', 'ANALYST'),
  async (req, res) => {
  try {
    await logEvent(req, AUDIT_ACTIONS.ADMIN_QUEUE_VIEWED, {});
    const items = await prisma.reviewQueueItem.findMany({
      where: { status: 'PENDING' },
      include: {
        analysis: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(items);
  } catch (error) {
    logger.error(`Error fetching review queue: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch review queue.' });
  }
}
);

export default router;
