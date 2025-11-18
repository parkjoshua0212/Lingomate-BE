//Handles fetching the full message list for the chat screen.
import prisma from '../lib/prisma.js';

export default (wss) => {
    const controller = {};

    // 3. Get Messages for a Conversation (GET /api/conversations/:id/messages)
    controller.getMessages = async (req, res) => {
        const { conversationId } = req.params;

        try {
            const messages = await prisma.message.findMany({
                where: { conversationId: parseInt(conversationId) },
                orderBy: { timestamp: 'asc' } // Oldest first (standard chat order)
            });
            res.status(200).json(messages);
        } catch (err) {
            res.status(500).json({ error: "Failed to fetch messages" });
        }
    };

    return controller;
};