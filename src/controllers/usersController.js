import prisma from '../lib/prisma.js';

export default (wss) => {
    const controller = {};

    // 1. Get User Profile & Stats (GET /api/users/me)
    // Combines User info + UserStat info
    controller.getMyProfile = async (req, res) => {
        // In real app, use req.auth.sub from Auth0 to find user
        // For now, we assume userId is passed in headers or query for testing, OR logic uses a test ID
        const auth0Sub = req.auth?.sub; 

        try {
            const user = await prisma.user.findUnique({
                where: { auth0Sub: auth0Sub },
                include: {
                    stats: true,       // Load Dashboard numbers
                    subscription: true // Load Plan status
                }
            });

            if (!user) return res.status(404).json({ error: "User not found" });
            res.status(200).json(user);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server Error" });
        }
    };

    // 2. Update Settings (PUT /api/users/me/settings)
    // Handles Voice (Male/Female) and Tone (Formal/Casual)
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