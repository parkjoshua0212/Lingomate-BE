import prisma from '../lib/prisma.js';
import WebSocket from 'ws';

export default (wss) => {
    const controller = {};

    const broadcastMessage = (type, payload) => {
        const message = JSON.stringify({ type, payload });
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    };

    // 1. Create New Conversation (FREE TALKING MODE)
    // REQ BODY NEEDS: { userId } (Topic is gone)
    controller.newConversation = async (req, res) => {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "userId is required." });
        }

        try {
            // 1. Fetch User to get their Preferences (Country, Style, Gender)
            const user = await prisma.user.findUnique({
                where: { id: parseInt(userId) }
            });

            if (!user) return res.status(404).json({ error: "User not found" });

            // 2. Create Conversation using User's Preferences
            const savedConv = await prisma.conversation.create({
                data: {
                    userId: parseInt(userId),
                    // Snapshot the preferences for this specific chat
                    countryUsed: user.countryPref,
                    styleUsed: user.stylePref,
                    genderUsed: user.genderPref
                },
                include: {
                    user: {
                        select: { username: true }
                    }
                }
            });
            
            broadcastMessage('NEW_CONVERSATION', {
                message: 'Free talking session started.',
                conversation: savedConv
            });

            res.status(200).json(savedConv);
        } catch (err) {
            console.error("Error creating conversation:", err);
            res.status(500).json({ error: "Failed to create new conversation", details: err.message });
        }
    };

    // 2. Get User Conversations
    controller.getConversations = async (req, res) => {
        const { userId } = req.params;

        try {
            const conversations = await prisma.conversation.findMany({
                where: {
                    userId: parseInt(userId), 
                },
                // Topic include removed
                orderBy: {
                    startedAt: 'desc' 
                }
            });
            res.status(200).json(conversations);
        } catch (err) {
            console.error("Error fetching conversations:", err);
            res.status(500).json({ error: "Failed to fetch conversations", details: err.message });
        }
    };

    // 3. Delete Conversation (Same as before)
    controller.deleteConversation = async (req, res) => {
        const { conversationId } = req.params;

        try {
            const id = parseInt(conversationId);
            const deletedConv = await prisma.conversation.delete({
                where: { id: id },
            });
            res.status(200).json(`Conversation ${id} has been deleted.`);
        } catch (err) {
            if (err.code === 'P2025') return res.status(404).json("Conversation not found!");
            res.status(500).json({ error: "Failed to delete conversation", details: err.message });
        }
    };

    return controller;
};