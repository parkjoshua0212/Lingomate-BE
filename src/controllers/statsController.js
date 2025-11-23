import prisma from '../lib/prisma.js';
import { successResponse, errorResponse } from '../utils/response.js';

export default () => {
    const controller = {};

    // 6.1 Get Stats — GET /api/stats
    // Fetches the user's learning statistics
    controller.getStats = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;

        try {
            // Find the user and include their stats relation
            const user = await prisma.user.findUnique({ 
                where: { auth0Sub }, 
                include: { stats: true } 
            });
            
            if (!user) {
                return res.status(404).json(errorResponse("USER_404", "User not found", 404));
            }

            // Default values if stats haven't been initialized yet
            const stats = user.stats || {};

            // In a real app, some of these might be calculated dynamically from the 'Conversation' or 'Message' tables
            // For example, 'totalSessions' could be: await prisma.conversation.count({ where: { userId: user.id, finishedAt: { not: null } } });

            res.json(successResponse({
                totalSessions: 127, // Hardcoded as per v2.1 spec example, replace with real DB count later
                totalMinutes: stats.totalTimeMins || 0,
                avgScore: 83,       // Hardcoded placeholder
                bestScore: 97,      // Hardcoded placeholder
                streak: stats.studyStreak || 0,
                newWordsLearned: 53,// Hardcoded placeholder
                progress: [1, 1, 1, 0, 0, 0, 0, 0, 0] // Hardcoded progress bar data
            }));

        } catch (err) {
            console.error("Get Stats Error:", err.message);
            res.status(500).json(errorResponse("SERVER_ERR", err.message));
        }
    };

    return controller;
};