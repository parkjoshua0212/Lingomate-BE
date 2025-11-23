import axios from 'axios';
import prisma from '../lib/prisma.js';

// Your AI Team's URL
const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export default () => {
    const controller = {};

    // 4.1 Chat (Stateless)
    controller.chat = async (req, res) => {
        const { text, sessionId } = req.body;
        try {
            // Call AI Team
            const response = await axios.post(`${AI_URL}/chat`, { text });
            res.json({
                success: true,
                data: {
                    user: { text },
                    ai: { text: response.data.reply }
                }
            });
        } catch (err) {
            res.status(500).json({ success: false, message: "AI Error" });
        }
    };

    // 4.3 Correct Grammar
    controller.correct = async (req, res) => {
        const { text } = req.body;
        try {
            const response = await axios.post(`${AI_URL}/correct`, { text });
            res.json({
                success: true,
                data: {
                    corrected: response.data.corrected,
                    explanation: response.data.explanation
                }
            });
        } catch (err) {
            res.status(500).json({ success: false, message: "AI Error" });
        }
    };

    // 4.4 Explain
    controller.explain = async (req, res) => {
        const { sentence } = req.body;
        try {
            const response = await axios.post(`${AI_URL}/explain`, { sentence });
            res.json({
                success: true,
                data: response.data 
            });
        } catch (err) {
            res.status(500).json({ success: false, message: "AI Error" });
        }
    };

    // 4.5 Get Phrases (Bookmarks)
    controller.getPhrases = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;
        // Fetch bookmarked messages
        const user = await prisma.user.findUnique({ where: { auth0Sub } });
        const bookmarks = await prisma.message.findMany({
            where: { conversation: { userId: user.id }, isBookmarked: true }
        });

        res.json({
            success: true,
            data: bookmarks.map(b => ({
                id: b.id,
                en: b.content,
                kr: b.explanation || "번역 없음" // Or store KR translation separately
            }))
        });
    };

    return controller;
};