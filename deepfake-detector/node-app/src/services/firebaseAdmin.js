import admin from 'firebase-admin';
import fs from 'fs';
import logger from '../utils/logger.js';

let firebaseApp = null;
let firebaseAuth = null;

if (process.env.OFFLINE_MODE === 'true') {
  logger.warn('OFFLINE_MODE is true. Skipping Firebase Admin initialization.');
} else {
  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      firebaseAuth = firebaseApp.auth();
      logger.info('Firebase Admin initialized successfully.');
    } else {
      logger.warn(`Firebase service account config not found at ${serviceAccountPath}. Cannot initialize Firebase Admin.`);
    }
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin:', error);
  }
}

export { firebaseApp, firebaseAuth };
