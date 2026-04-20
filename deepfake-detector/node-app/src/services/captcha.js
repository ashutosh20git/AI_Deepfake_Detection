import axios from 'axios';
import logger from '../utils/logger.js';

export const verifyCaptcha = async (token, ip) => {
  const secret = process.env.HCAPTCHA_SECRET;
  
  if (secret === 'changeme' || process.env.NODE_ENV === 'test') {
    return true; // dev bypass
  }

  try {
    const response = await axios.post('https://api.hcaptcha.com/siteverify', null, {
      params: {
        secret: secret,
        response: token,
        remoteip: ip
      }
    });
    
    return response.data.success === true;
  } catch (error) {
    logger.error('Error verifying hCaptcha:', error.message);
    return false;
  }
};
