import prisma from '../lib/prisma.js';

export default (wss) => {
    const controller = {};

    // 1. Get User Profile (GET /api/users/me)
    controller.getMyProfile = async (req, res) => {
        // Use optional chaining in case auth is missing for some reason
        const auth0Sub = req.auth?.payload?.sub; 

        if (!auth0Sub) {
            return res.status(401).json({ error: "User ID missing from token." });
        }

        try {
            const user = await prisma.user.findUnique({
                where: { auth0Sub: auth0Sub },
                include: {
                    stats: true,       
                    subscription: true 
                }
            });

            if (!user) return res.status(404).json({ error: "User not found." });
            res.status(200).json(user);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Server Error" });
        }
    };

    // 2. Get Dashboard Data (GET /api/dashboard)
    // UPDATED: Removed 'Topic' dependency
    controller.getDashboard = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;

        if (!auth0Sub) {
            return res.status(401).json({ error: "User ID missing from token." });
        }

        try {
            const user = await prisma.user.findUnique({
                where: { auth0Sub: auth0Sub },
                include: {
                    stats: true,
                    subscription: true
                }
            });

            if (!user) return res.status(404).json({ error: "User not found." });

            // Fetch 3 most recent conversations
            // We REMOVED 'include: { topic: ... }' because the table is gone.
            const recentConversations = await prisma.conversation.findMany({
                where: { userId: user.id },
                take: 3, 
                orderBy: { startedAt: 'desc' },
                // Optional: You can include the first message if you want to show a preview
                // include: { messages: { take: 1 } } 
            });

            const dashboardData = {
                user: {
                    username: user.username,
                    avatarUrl: user.avatarUrl,
                    plan: user.subscription?.planName || "Free",
                    // Return the user's current default settings for the UI
                    preferences: {
                        country: user.countryPref,
                        style: user.stylePref,
                        gender: user.genderPref
                    }
                },
                stats: user.stats, 
                recentActivity: recentConversations 
            };

            res.status(200).json(dashboardData);

        } catch (err) {
            console.error("Dashboard Error:", err);
            res.status(500).json({ error: "Failed to load dashboard" });
        }
    };

    // 3. Update Settings (PUT /api/users/me/settings)
    // UPDATED: Handles Country, Style, Gender
    controller.updateSettings = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;
        
        // These match the 3 dropdowns in your design
        const { country, style, gender, nickname } = req.body; 

        try {
            const updatedUser = await prisma.user.update({
                where: { auth0Sub: auth0Sub },
                data: {
                    // Only update fields if they are provided in the request
                    ...(country && { countryPref: country }),
                    ...(style && { stylePref: style }),
                    ...(gender && { genderPref: gender }),
                    ...(nickname && { username: nickname })
                }
            });
            res.status(200).json(updatedUser);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Failed to update settings" });
        }
    };

    return controller;
};