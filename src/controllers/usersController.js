import prisma from '../lib/prisma.js';

export default (wss) => {
    const controller = {};

    // 1. Get User Profile (GET /api/users/me)
    controller.getMyProfile = async (req, res) => {
        const auth0Sub = req.auth?.sub; 

        try {
            const user = await prisma.user.findUnique({
                where: { auth0Sub: auth0Sub },
                include: {
                    stats: true,       
                    subscription: true 
                }
            });

            if (!user) return res.status(404).json({ error: "User not found" });
            res.status(200).json(user);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server Error" });
        }
    };

    // [NEW] 2. Get Dashboard Data (GET /api/dashboard)
    // Fetches Profile + Stats + Recent Activity
    controller.getDashboard = async (req, res) => {
        const auth0Sub = req.auth?.sub;

        try {
            // Find the user first
            const user = await prisma.user.findUnique({
                where: { auth0Sub: auth0Sub },
                include: {
                    stats: true,
                    subscription: true
                }
            });

            if (!user) return res.status(404).json({ error: "User not found" });

            // Also fetch their 3 most recent conversations
            const recentConversations = await prisma.conversation.findMany({
                where: { userId: user.id },
                take: 3, // Limit to 3
                orderBy: { startedAt: 'desc' },
                include: {
                    topic: {
                        select: { titleEn: true, titleJp: true, imageUrl: true }
                    }
                }
            });

            // Combine everything into one nice response
            const dashboardData = {
                user: {
                    username: user.username,
                    avatarUrl: user.avatarUrl,
                    plan: user.subscription?.planName || "Free"
                },
                stats: user.stats, // { totalSentences, studyStreak... }
                recentActivity: recentConversations
            };

            res.status(200).json(dashboardData);

        } catch (err) {
            console.error("Dashboard Error:", err);
            res.status(500).json({ error: "Failed to load dashboard" });
        }
    };

    // 3. Update Settings (PUT /api/users/me/settings)
    controller.updateSettings = async (req, res) => {
        const auth0Sub = req.auth?.sub;
        const { voiceSetting, toneSetting, nickname } = req.body;

        try {
            const updatedUser = await prisma.user.update({
                where: { auth0Sub: auth0Sub },
                data: {
                    voiceSetting,
                    toneSetting,
                    username: nickname
                }
            });
            res.status(200).json(updatedUser);
        } catch (err) {
            res.status(500).json({ error: "Failed to update settings" });
        }
    };

    return controller;
};