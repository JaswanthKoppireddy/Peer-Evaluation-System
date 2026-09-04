"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAnomaly = void 0;
const Evaluation_1 = __importDefault(require("../models/Evaluation"));
/**
 * Calculates mean, standard deviation, and Z-score to detect anomalies.
 * If a peer score deviates significantly (e.g., Z-score > 2 or < -2), it flags it.
 * @param submissionId The ID of the submission to check
 * @returns boolean indicating if the latest evaluation triggered an anomaly
 */
const checkAnomaly = async (submissionId) => {
    try {
        const evaluations = await Evaluation_1.default.find({ submissionId });
        if (evaluations.length < 3)
            return false; // Need sufficient data points
        const scores = evaluations.map(e => e.score);
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev === 0)
            return false; // All scores are identical
        // Check the most recently added evaluation (or we could check all)
        // Here we'll iterate and update any that are anomalous
        let anomalyFound = false;
        for (const evalDoc of evaluations) {
            const zScore = (evalDoc.score - mean) / stdDev;
            // Z-score threshold (e.g., 1.5 or 2 depending on strictness)
            if (Math.abs(zScore) > 1.5) {
                if (!evalDoc.isAnomaly) {
                    evalDoc.isAnomaly = true;
                    evalDoc.escalationStatus = 'Flagged'; // State machine: Pending -> Flagged
                    await evalDoc.save();
                    anomalyFound = true;
                }
            }
        }
        return anomalyFound;
    }
    catch (error) {
        console.error('Error in anomaly detection:', error);
        return false;
    }
};
exports.checkAnomaly = checkAnomaly;
