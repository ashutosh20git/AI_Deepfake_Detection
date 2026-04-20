export const classifyRisk = (mlResult) => {
  let riskLevel = 'AUTHENTIC';
  let needsReview = false;
  let reasoning = 'Video appears authentic with low suspicion of manipulation.';
  
  const conf = mlResult.aggregated_confidence;

  if (conf >= 0.85) {
    riskLevel = 'HIGH_RISK';
    reasoning = 'High confidence of manipulation identified.';
  } else if (conf >= 0.60 && conf < 0.85) {
    riskLevel = 'MEDIUM_SUSPICION';
    needsReview = true;
    reasoning = 'Medium suspicion of manipulation detected, review required.';
  } else {
    riskLevel = 'AUTHENTIC';
    reasoning = 'Video appears authentic with low suspicion of manipulation.';
  }

  // Overrides
  if (mlResult.score_std > 0.20) {
    needsReview = true;
    reasoning = 'High variance in frame scores detected, review required.';
  }
  
  if (mlResult.frame_scores.length < 5) {
    needsReview = true;
    reasoning = 'Insufficient number of frames extracted, manual review required.';
  }

  if (mlResult.faces_detected === 0) {
    needsReview = true;
    reasoning = 'No faces detected in the video, manual review required.';
  }

  return { riskLevel, confidence: conf, needsReview, reasoning };
};
