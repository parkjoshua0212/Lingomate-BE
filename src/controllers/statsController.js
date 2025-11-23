import prisma from '../lib/prisma.js';

export default () => {
    const controller = {};

    // 6.1 Get Stats
    controller.getStats = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;
        const user = await prisma.user.findUnique({ where: { auth0Sub }, include: { stats: true } });

        res.json({
            success: true,
            data: {
                totalSessions: 0, // Calculate from DB if needed
                totalMinutes: user.stats?.totalTimeMins || 0,
                streak: user.stats?.studyStreak || 0,
                // ... other fields
            }
        });
    };

    return controller;
};