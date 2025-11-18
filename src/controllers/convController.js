import prisma from '../lib/prisma.js';
import WebSocket from 'ws';

export default (wss) => {
    const controller = {};

    /**
     * Helper function to broadcast a message to all connected clients
     * Note: In production, you should filter this to only the relevant userId!
     */
    const broadcastMessage = (type, payload) => {
        const message = JSON.stringify({ type, payload });
        
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    };

    // 1. Create New Conversation
    // REQ BODY NEEDS: { userId, topicId, languageUsed }
    controller.newConversation = async (req, res) => {
        // FIXED: Matching your Schema (User + Topic + Language)
        const { userId, topicId, languageUsed } = req.body;

        // Basic validation
        if (!userId || !topicId || !languageUsed) {
            return res.status(400).json({ error: "userId, topicId, and languageUsed are required." });
        }

        try {
            const savedConv = await prisma.conversation.create({
                data: {
                    userId: parseInt(userId),       // Schema relation
                    topicId: parseInt(topicId),     // Schema relation
                    languageUsed: languageUsed      // Schema field
                },
                // FIXED: Include related data to display titles immediately
                include: {
                    topic: true, 
                    user: {
                        select: { username: true }
                    }
                }
            });
            
            // --- WEBSOCKET LOGIC ---
            broadcastMessage('NEW_CONVERSATION', {
                message: 'A new conversation session started.',
                conversation: savedConv
            });
            // -----------------------

            res.status(200).json(savedConv);
        } catch (err) {
            console.error("Error creating conversation:", err);
            res.status(500).json({ error: "Failed to create new conversation", details: err.message });
        }
    };

    // 2. Get User Conversations
    // URL: /api/conversations/:userId
    controller.getConversations = async (req, res) => {
        const { userId } = req.params;

        try {
            const conversations = await prisma.conversation.findMany({
                where: {
                    // FIXED: Schema uses a direct relationship, not an array
                    userId: parseInt(userId), 
                },
                // Optional: Include the Topic details so the UI can show "At the Coffee Shop"
                include: {
                    topic: {
                        select: { titleEn: true, titleJp: true, category: true }
                    }
                },
                orderBy: {
                    startedAt: 'desc' // Show newest first
                }
            });
            res.status(200).json(conversations);
        } catch (err) {
            console.error("Error fetching conversations:", err);
            res.status(500).json({ error: "Failed to fetch conversations", details: err.message });
        }
    };

    // 3. Delete Conversation
    // URL: /api/conversations/:conversationId
    controller.deleteConversation = async (req, res) => {
        const { conversationId } = req.params;

        try {
            // FIXED: Convert string param to Integer
            const id = parseInt(conversationId);

            const deletedConv = await prisma.conversation.delete({
                where: {
                    id: id,
                },
            });
            
            res.status(200).json(`Conversation ${id} has been deleted.`);
        } catch (err) {
            if (err.code === 'P2025') {
                 return res.status(404).json("Conversation not found!");
            }
            console.error("Error deleting conversation:", err);
            res.status(500).json({ error: "Failed to delete conversation", details: err.message });
        }
    };

    return controller;
};