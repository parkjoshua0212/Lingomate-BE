import axios from 'axios';
import { successResponse, errorResponse } from '../utils/response.js';

// Your AI Team's URL (Make sure this matches your .env file)
const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export default () => {
    const controller = {};

    // 4.2.1 AI Text Chat — POST /api/ai/chat
    // Sends a user message to the AI service and returns the AI's response
    controller.chat = async (req, res) => {
        const { text } = req.body;
        if(!text) return res.status(400).json(errorResponse("BAD_REQ", "Text required", 400));

        try {
            // Call AI Team's API
            // Expected response from AI service: { text: "AI response text" }
            const response = await axios.post(`${AI_URL}/chat`, { text });
            
            res.json(successResponse({
                text: response.data.text 
            }));
        } catch (err) {
            console.error("AI Chat Error:", err.message);
            res.status(500).json(errorResponse("AI_ERR", "AI Service Failed"));
        }
    };

    // 4.3.1 Text-to-Speech (TTS) — POST /api/ai/tts
    // Converts text to audio
    controller.tts = async (req, res) => {
        const { text, voice } = req.body;
        if(!text) return res.status(400).json(errorResponse("BAD_REQ", "Text required", 400));

        try {
            const response = await axios.post(`${AI_URL}/tts`, { text, voice });
            
            res.json(successResponse({
                audio: response.data.audio, // Base64 encoded audio string
                mime: "audio/wav"
            }));
        } catch (err) {
            console.error("AI TTS Error:", err.message);
            res.status(500).json(errorResponse("AI_ERR", "TTS Failed"));
        }
    };

    // 4.4.1 AI Feedback — POST /api/ai/feedback
    // Provides meaning and examples for a given text
    controller.feedback = async (req, res) => {
        const { text } = req.body;
        if(!text) return res.status(400).json(errorResponse("BAD_REQ", "Text required", 400));

        try {
            const response = await axios.post(`${AI_URL}/feedback`, { text });
            
            res.json(successResponse({
                meaning: response.data.meaning,
                examples: response.data.examples
            }));
        } catch (err) {
            console.error("AI Feedback Error:", err.message);
            res.status(500).json(errorResponse("AI_ERR", "Feedback Failed"));
        }
    };

    // 4.3 Grammar Correction — POST /api/ai/correct
    // Corrects grammatical errors in the provided text
    controller.correct = async (req, res) => {
        const { text } = req.body;
        try {
            const response = await axios.post(`${AI_URL}/correct`, { text });
            
            res.json(successResponse({
                corrected: response.data.corrected,
                explanation: response.data.explanation
            }));
        } catch (err) {
            console.error("AI Correct Error:", err.message);
            res.status(500).json(errorResponse("AI_ERR", "Correction Failed"));
        }
    };
    
    // 4.4.1 Explain (Alternative for Feedback) — POST /api/ai/explain
    // Similar to feedback but might focus more on explanation
    controller.explain = async (req, res) => {
        const { text } = req.body;
        try {
            const response = await axios.post(`${AI_URL}/explain`, { text });
            
            res.json(successResponse({
                explanation: response.data.explanation
            }));
        } catch (err) {
             console.error("AI Explain Error:", err.message);
            res.status(500).json(errorResponse("AI_ERR", "Explanation Failed"));
        }
    };
    
    // 7.1 Get Phrases — GET /api/phrases
    // Returns a list of predefined phrases (currently hardcoded as per v2.1 spec example)
    controller.getPhrases = async (req, res) => {
        // In a real app, this would fetch from a database table 'Phrase'
        const phrases = [
            { "id": 1, "en": "Way to go.", "kr": "잘했어" },
            { "id": 2, "en": "Time flies.", "kr": "시간 빠르다" }
        ];
        
        res.json(successResponse(phrases));
    };

    return controller;
};