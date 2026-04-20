import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import logger from '../utils/logger.js';

export const analyzeVideo = async (filePath) => {
  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://ml-service:8000';
  
  try {
    const form = new FormData();
    form.append('video', fs.createReadStream(filePath));

    const response = await axios.post(`${mlServiceUrl}/predict`, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 120000, // 120s timeout
    });

    return response.data;
  } catch (error) {
    logger.error(`Error communicating with ML service: ${error.message}`);
    throw error;
  }
};
