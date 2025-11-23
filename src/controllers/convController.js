import prisma from '../lib/prisma.js';
import axios from 'axios';

// The URL of your AI Team's Server (Python)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export default (wss) => {
    const controller = {};

    // 2.1 Start Session
    // POST /api/conversation/start
    controller.startSession = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;

        try {
            // 1. Find User
            const user = await prisma.user.findUnique({ where: { auth0Sub } });
            if (!user) return res.status(404).json({ success: false, message: "User not found" });

            // 2. Create Conversation using User's current settings
            const conversation = await prisma.conversation.create({
                data: {
                    userId: user.id,
                    countryUsed: user.countryPref,
                    styleUsed: user.stylePref,
                    genderUsed: user.genderPref
                }
            });

            // 3. Return v2.0 Format
            res.json({
                success: true,
                data: {
                    sessionId: conversation.id,
                    startTime: conversation.startedAt
                }
            });
        } catch (err) {
            console.error("Start Session Error:", err);
            res.status(500).json({ success: false, message: "Server Error" });
        }
    };

    // 2.2 Send Message
    // POST /api/conversation/send
    controller.sendMessage = async (req, res) => {
        const { sessionId, message } = req.body;
        
        if (!sessionId || !message) {
            return res.status(400).json({ success: false, message: "Missing sessionId or message" });
        }

        try {
            // 1. Save User's Message to DB
            await prisma.message.create({
                data: {
                    conversationId: parseInt(sessionId),
                    sender: 'USER',
                    content: message
                }
            });

            // 2. Call AI Team's API to get a reply
            // We assume their endpoint is POST /chat
            let aiText = "I am having trouble connecting to my brain.";
            try {
                const aiResponse = await axios.post(`${AI_SERVICE_URL}/chat`, {
                    text: message,
                    sessionId: sessionId // Send context if AI needs it
                });
                aiText = aiResponse.data.reply || aiResponse.data.text || aiText;
            } catch (aiError) {
                console.error("AI Service Failed:", aiError.message);
            }

            // 3. Save AI's Reply to DB
            await prisma.message.create({
                data: {
                    conversationId: parseInt(sessionId),
                    sender: 'AI',
                    content: aiText
                }
            });

            // 4. Return v2.0 Format
            res.json({
                success: true,
                data: {
                    user: { text: message },
                    ai: { text: aiText },
                    sttConfidence: 1.0 // Placeholder if not using voice
                }
            });

        } catch (err) {
            console.error("Send Message Error:", err);
            res.status(500).json({ success: false, message: "Failed to process message" });
        }
    };

    // 2.3 History
    // GET /api/conversation/history
    controller.getHistory = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;
        
        try {
            const user = await prisma.user.findUnique({ where: { auth0Sub } });
            
            // Fetch conversations with message count
            const conversations = await prisma.conversation.findMany({
                where: { userId: user.id },
                orderBy: { startedAt: 'desc' },
                include: {
                    _count: {
                        select: { messages: true }
                    }
                }
            });

            // Map to v2.0 Spec
            const data = conversations.map(c => ({
                sessionId: c.id,
                title: `Chat (${c.styleUsed} / ${c.countryUsed})`, // Auto-generate a title
                messageCount: c._count.messages,
                createdAt: c.startedAt
            }));

            res.json({
                success: true,
                data: data,
                meta: { total: data.length }
            });

        } catch (err) {
            res.status(500).json({ success: false, message: "Failed to load history" });
        }
    };

    // 2.4 Get Specific Session
    // GET /api/conversation/:sessionId
    controller.getSession = async (req, res) => {
        const { sessionId } = req.params;

        try {
            const conv = await prisma.conversation.findUnique({
                where: { id: parseInt(sessionId) },
                include: {
                    messages: {
                        orderBy: { timestamp: 'asc' }
                    }
                }
            });

            if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" });

            res.json({
                success: true,
                data: {
                    sessionId: conv.id,
                    title: `Chat (${conv.styleUsed})`,
                    messages: conv.messages.map(m => ({
                        id: m.id,
                        from: m.sender.toLowerCase(), // 'user' or 'ai'
                        text: m.content,
                        createdAt: m.timestamp
                    }))
                }
            });

        } catch (err) {
            res.status(500).json({ success: false, message: "Failed to load session" });
        }
    };

    // 2.5 Delete Session
    // DELETE /api/conversation/delete
    controller.deleteSession = async (req, res) => {
        const { sessionId } = req.body;
        
        if (!sessionId) return res.status(400).json({ success: false, message: "sessionId required" });

        try {
            await prisma.conversation.delete({
                where: { id: parseInt(sessionId) }
            });
            res.json({ success: true, message: "Conversation deleted" });
        } catch (err) {
            res.status(500).json({ success: false, message: "Delete failed" });
        }
    };

    return controller;
};