import prisma from '../lib/prisma.js';

export default () => {
    const controller = {};

    // Helper: Find user by Auth0 ID and include necessary relations
    const getUser = async (auth0Sub) => {
        return await prisma.user.findUnique({
            where: { auth0Sub },
            include: { subscription: true, stats: true }
        });
    };

    // --- 1. USER PROFILE ---

    // 1.2 Get Profile
    // GET /api/user/profile
    controller.getProfile = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;

        try {
            const user = await getUser(auth0Sub);
            
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found. Please sync via /auth/register-if-needed first." });
            }

            res.json({
                success: true,
                data: {
                    userId: user.id,
                    email: user.email,
                    name: user.username,
                    avatarUrl: user.avatarUrl,
                    subscription: user.subscription?.planName || 'free',
                    // Conversation Preferences
                    country: user.countryPref,
                    style: user.stylePref,
                    gender: user.genderPref,
                    // Statistics
                    streak: user.stats?.studyStreak || 0
                }
            });
        } catch (err) {
            console.error("Get Profile Error:", err);
            res.status(500).json({ success: false, message: "Server Error" });
        }
    };

    // 1.3 Update Profile
    // PUT /api/user/profile
    controller.updateProfile = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;
        // v2.0 Spec allows updating profile info AND settings here
        const { name, avatarUrl, country, style, gender } = req.body;

        try {
            const updatedUser = await prisma.user.update({
                where: { auth0Sub },
                data: {
                    // Only update fields if they are provided in the request body
                    ...(name && { username: name }),
                    ...(avatarUrl && { avatarUrl: avatarUrl }),
                    ...(country && { countryPref: country }),
                    ...(style && { stylePref: style }),
                    ...(gender && { genderPref: gender }),
                }
            });

            res.json({
                success: true,
                data: {
                    userId: updatedUser.id,
                    name: updatedUser.username,
                    avatarUrl: updatedUser.avatarUrl,
                    country: updatedUser.countryPref,
                    style: updatedUser.stylePref,
                    gender: updatedUser.genderPref
                }
            });
        } catch (err) {
            console.error("Update Profile Error:", err);
            res.status(500).json({ success: false, message: "Update failed" });
        }
    };

    // --- 5. CONVERSATION SETTINGS ---

    // 5.1 Get Settings
    // GET /api/conversation/settings
    controller.getSettings = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;

        try {
            const user = await prisma.user.findUnique({ where: { auth0Sub } });
            
            if (!user) return res.status(404).json({ success: false, message: "User not found" });

            res.json({
                success: true,
                data: {
                    country: user.countryPref,
                    style: user.stylePref,
                    gender: user.genderPref
                }
            });
        } catch (err) {
            res.status(500).json({ success: false, message: "Server Error" });
        }
    };

    // 5.2 Update Settings
    // PUT /api/conversation/settings
    // (Reuses the logic from updateProfile, but specific to these 3 fields)
    controller.updateSettings = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;
        const { country, style, gender } = req.body;

        try {
            const updatedUser = await prisma.user.update({
                where: { auth0Sub },
                data: {
                    ...(country && { countryPref: country }),
                    ...(style && { stylePref: style }),
                    ...(gender && { genderPref: gender }),
                }
            });

            res.json({
                success: true,
                data: {
                    country: updatedUser.countryPref,
                    style: updatedUser.stylePref,
                    gender: updatedUser.genderPref
                }
            });
        } catch (err) {
            res.status(500).json({ success: false, message: "Update settings failed" });
        }
    };

    return controller;
};