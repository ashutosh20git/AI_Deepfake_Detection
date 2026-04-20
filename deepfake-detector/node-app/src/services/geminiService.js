import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const generateReply = async (history, userMessage, contextSummary) => {
  try {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: `You are the Help Assistant for an Edge-Based Deepfake Detection System. You help users understand:
- What risk levels mean (HIGH_RISK, MEDIUM_SUSPICION, AUTHENTIC)
- How to interpret Grad-CAM heatmaps
- Why a video was flagged
- How the agentic decision logic works (thresholds, frame aggregation, variance)
- How continuous learning works
Be concise, technical when needed, friendly. If asked about topics outside the deepfake detection system, politely redirect.
Current user context: ${contextSummary}`
    });

    const formattedHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({ history: formattedHistory });
    const result = await chat.sendMessage(userMessage);
    
    return result.response.text();
  } catch (error) {
    logger.error(`Error in generateReply: ${error.message}`);
    return "I'm sorry, but I am currently unavailable due to system quotas or an internal error. Please try again later.";
  }
};

export const generateAnalysisExplanation = async (analysis) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Explain the following deepfake detection analysis result to a user in a quick, plain-English paragraph. Be concise and helpful.

Risk Level: ${analysis.riskLevel}
Confidence Score: ${(analysis.aggregatedConfidence*100).toFixed(1)}%
Standard Deviation of frames: ${analysis.scoreStd}
Faces Detected: ${analysis.facesDetected}
System Reasoning: ${analysis.reasoning}

Explanation:`;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    logger.error(`Error in generateAnalysisExplanation: ${error.message}`);
    return "Explanation unavailable at the moment due to communication errors.";
  }
};
