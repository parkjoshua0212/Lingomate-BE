import prisma from '../lib/prisma.js';
import { successResponse, errorResponse } from '../utils/response.js';

export default (wss) => {
    const controller = {};

    // 2.1 Start Session — POST /api/conversation/start
    controller.startSession = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;
        
        try {
            const user = await prisma.user.findUnique({ where: { auth0Sub } });
            if (!user) return res.status(404).json(errorResponse("USER_404", "User not found", 404));

            // Create chat with current settings
            const conversation = await prisma.conversation.create({
                data: {
                    userId: user.id,
                    countryUsed: user.countryPref,
                    styleUsed: user.stylePref,
                    genderUsed: user.genderPref
                }
            });

            res.json(successResponse({
                sessionId: conversation.id,
                startTime: conversation.startedAt
            }));
        } catch (err) {
            res.status(500).json(errorResponse("SERVER_ERR", err.message));
        }
    };

    // 2.2 Finish Session + Upload Script — POST /api/conversation/finish
    controller.finishSession = async (req, res) => {
        const { sessionId, script } = req.body; // script: [{from: 'user', text: '...'}, ...]

        if (!sessionId || !Array.isArray(script)) {
            return res.status(400).json(errorResponse("BAD_REQ", "Missing sessionId or script array", 400));
        }

        try {
            const id = parseInt(sessionId);

            // 1. Update conversation status (Mark as finished)
            await prisma.conversation.update({
                where: { id },
                data: { finishedAt: new Date() }
            });

            // 2. Save all messages in bulk
            // Map 'from' (user/ai) to 'sender' (USER/AI)
            const messagesData = script.map(msg => ({
                conversationId: id,
                sender: msg.from.toLowerCase() === 'ai' ? 'AI' : 'USER',
                content: msg.text
            }));

            if (messagesData.length > 0) {
                await prisma.message.createMany({
                    data: messagesData
                });
            }

            res.json(successResponse({
                sessionId: id,
                savedMessages: messagesData.length
            }));

        } catch (err) {
            console.error(err);
            res.status(500).json(errorResponse("SERVER_ERR", "Failed to save script"));
        }
    };

    // 2.3 History — GET /api/conversation/history
    controller.getHistory = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        
        try {
            const user = await prisma.user.findUnique({ where: { auth0Sub } });
            
            const conversations = await prisma.conversation.findMany({
                where: { userId: user.id, finishedAt: { not: null } }, // Only show finished chats
                orderBy: { startedAt: 'desc' },
                take: limit,
                skip: (page - 1) * limit,
                include: { _count: { select: { messages: true } } }
            });

            const total = await prisma.conversation.count({ where: { userId: user.id, finishedAt: { not: null } } });

            const data = conversations.map(c => ({
                sessionId: c.id,
                title: `Conversation in ${c.countryUsed}`,
                messageCount: c._count.messages,
                createdAt: c.startedAt
            }));

            res.json({
                ...successResponse(data),
                meta: { page, limit, total } // Override meta for pagination
            });

        } catch (err) {
            res.status(500).json(errorResponse("SERVER_ERR", err.message));
        }
    };

    // 2.4 Get Specific Session — GET /api/conversation/:sessionId
    controller.getSession = async (req, res) => {
        const { sessionId } = req.params;
        try {
            const conv = await prisma.conversation.findUnique({
                where: { id: parseInt(sessionId) },
                include: { messages: { orderBy: { id: 'asc' } } }
            });

            if (!conv) return res.status(404).json(errorResponse("NOT_FOUND", "Conversation not found", 404));

            res.json(successResponse({
                sessionId: conv.id,
                script: conv.messages.map(m => ({
                    from: m.sender.toLowerCase(),
                    text: m.content
                }))
            }));
        } catch (err) {
            res.status(500).json(errorResponse("SERVER_ERR", err.message));
        }
    };

    // 2.5 Delete Session — DELETE /api/conversation/delete
    controller.deleteSession = async (req, res) => {
        const { sessionId, all } = req.body;
        const auth0Sub = req.auth?.payload?.sub;

        try {
            const user = await prisma.user.findUnique({ where: { auth0Sub } });

            if (all) {
                await prisma.conversation.deleteMany({ where: { userId: user.id } });
                return res.json(successResponse(null, "All conversations deleted"));
            }

            if (sessionId) {
                await prisma.conversation.delete({ where: { id: parseInt(sessionId) } });
                return res.json(successResponse(null, "Conversation deleted"));
            }

            res.status(400).json(errorResponse("BAD_REQ", "Provide sessionId or all:true", 400));
        } catch (err) {
            res.status(500).json(errorResponse("SERVER_ERR", "Delete failed"));
        }
    };

    return controller;
};