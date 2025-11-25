import axios from 'axios';
import { successResponse, errorResponse } from '../utils/response.js';

// Import your new Google Cloud wrappers
import { synthesizeSpeech } from '../lib/googleTTS.js';
import { transcribeAudio } from '../lib/googleSpeech.js';

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export default () => {
    const controller = {};

    // 4.1 STT (Speech to Text) — POST /api/ai/stt
    // Expects: { audio: "base64 string" }
    controller.stt = async (req, res) => {
        const { audio } = req.body;
        if (!audio) return res.status(400).json(errorResponse("BAD_REQ", "Audio data required", 400));

        try {
            // Convert base64 string back to Buffer for Google API
            const audioBuffer = Buffer.from(audio, 'base64');
            
            // Use your library function
            const text = await transcribeAudio(audioBuffer);

            res.json(successResponse({
                text: text,
                confidence: 0.95 // Mock confidence or extract from Google response if updated
            }));
        } catch (err) {
            console.error("STT Error:", err);
            res.status(500).json(errorResponse("AI_ERR", "STT Failed"));
        }
    };

    // 4.2.1 AI Text Chat
    controller.chat = async (req, res) => {
        const { text } = req.body;
        if(!text) return res.status(400).json(errorResponse("BAD_REQ", "Text required", 400));

        try {
            const response = await axios.post(`${AI_URL}/chat`, { text });
            res.json(successResponse({ text: response.data.text }));
        } catch (err) {
            res.status(500).json(errorResponse("AI_ERR", "AI Service Failed"));
        }
    };

    // 4.3.1 TTS (Text to Speech) — POST /api/ai/tts
    // Uses your GoogleTTS.js library
    controller.tts = async (req, res) => {
        const { text } = req.body;
        if(!text) return res.status(400).json(errorResponse("BAD_REQ", "Text required", 400));

        try {
            // Use your library function
            const audioBuffer = await synthesizeSpeech(text);

            res.json(successResponse({
                audio: audioBuffer.toString('base64'), // Convert Buffer to Base64 for JSON response
                mime: "audio/mp3"
            }));
        } catch (err) {
            console.error("TTS Error:", err);
            res.status(500).json(errorResponse("AI_ERR", "TTS Failed"));
        }
    };

    // 4.4.1 AI Feedback
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
            res.status(500).json(errorResponse("AI_ERR", "Feedback Failed"));
        }
    };

    // 4.3 Correct Grammar
    controller.correct = async (req, res) => {
        const { text } = req.body;
        try {
            const response = await axios.post(`${AI_URL}/correct`, { text });
            res.json(successResponse({
                corrected: response.data.corrected,
                explanation: response.data.explanation
            }));
        } catch (err) {
            res.status(500).json(errorResponse("AI_ERR", "Correction Failed"));
        }
    };
    
    // 4.4 Explain
    controller.explain = async (req, res) => {
        const { text } = req.body;
        try {
            const response = await axios.post(`${AI_URL}/explain`, { text });
            res.json(successResponse({ explanation: response.data.explanation }));
        } catch (err) {
            res.status(500).json(errorResponse("AI_ERR", "Explanation Failed"));
        }
    };

    // 7.1 Get Phrases
    controller.getPhrases = async (req, res) => {
        const phrases = [
            { "id": 1, "en": "Way to go.", "kr": "잘했어" },
            { "id": 2, "en": "Time flies.", "kr": "시간 빠르다" }
        ];
        res.json(successResponse(phrases));
    };

    return controller;
};