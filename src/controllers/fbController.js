// feedbackController.js
import prisma from '../lib/prisma.js';
import WebSocket from 'ws';

export default (wss) => {
    const controller = {};

    // Helper to broadcast to specific events
    const broadcast = (type, data) => {
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type, ...data }));
            }
        });
    };

    // 4. Generate AI Feedback (POST /api/conversations/:id/feedback)
    // This is called when the user clicks "End Chat" or "Review"
    controller.generateFeedback = async (req, res) => {
        const { conversationId } = req.params;

        try {
            // 1. Fetch recent user messages that don't have corrections
            const messagesToCorrect = await prisma.message.findMany({
                where: {
                    conversationId: parseInt(conversationId),
                    sender: 'USER',
                    correction: null 
                }
            });

            // 2. [MOCK AI] In a real app, you send `messagesToCorrect` to Python/OpenAI here.
            // We will simulate the AI updating the DB after 2 seconds.
            
            setTimeout(async () => {
                // Simulating AI writing back to DB
                for (const msg of messagesToCorrect) {
                    await prisma.message.update({
                        where: { id: msg.id },
                        data: {
                            correction: `Better: ${msg.content} (Polite)`,
                            explanation: "Using formal polite form is better here."
                        }
                    });
                }

                // 3. WebSocket: Notify Frontend that feedback is ready
                broadcast('FEEDBACK_READY', { conversationId });
                console.log(`[AI] Feedback generated for Conversation ${conversationId}`);
            }, 2000);

            res.status(200).json({ message: "AI analysis started. You will receive a WebSocket event when ready." });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Failed to start AI feedback" });
        }
    };

    return controller;
};