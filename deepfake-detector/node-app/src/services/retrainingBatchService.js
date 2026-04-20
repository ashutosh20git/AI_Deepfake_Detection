import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../utils/db.js';
import logger from '../utils/logger.js';

export const createWeeklyBatch = async (force = false) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pendingItems = await prisma.reviewQueueItem.findMany({
      where: {
        status: 'PENDING',
        createdAt: { gte: sevenDaysAgo }
      },
      include: {
        analysis: true
      }
    });

    if (pendingItems.length < 3 && !force) {
      logger.info(`skipping batch: only ${pendingItems.length} items found, requires at least 3.`);
      return null;
    }

    const batchId = uuidv4();
    const batchPath = path.join('/app/retraining-data', batchId);
    
    if (!fs.existsSync(batchPath)) {
      fs.mkdirSync(batchPath, { recursive: true });
    }

    const manifest = [];
    
    for (const item of pendingItems) {
      const { analysis } = item;
      
      const sourcePath = path.join('/app/uploads', analysis.videoFilename);
      const destPath = path.join(batchPath, analysis.videoFilename);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
      } else {
        logger.warn(`Source video missing for analysis: ${analysis.id}`);
      }

      manifest.push({
        filename: analysis.videoFilename,
        predictedScore: analysis.aggregatedConfidence,
        predictedRiskLevel: analysis.riskLevel,
        analysisId: analysis.id,
        createdAt: analysis.createdAt
      });
    }

    fs.writeFileSync(
      path.join(batchPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    const itemIds = pendingItems.map(i => i.id);
    
    await prisma.reviewQueueItem.updateMany({
      where: { id: { in: itemIds } },
      data: {
        status: 'USED_FOR_RETRAINING',
        batchId: batchId
      }
    });

    logger.info(`Created retraining batch ${batchId} with ${pendingItems.length} items.`);
    
    return {
      batchId,
      batchPath,
      itemCount: pendingItems.length
    };
    
  } catch (error) {
    logger.error('Error creating weekly batch: ' + error.message);
    throw error;
  }
};
