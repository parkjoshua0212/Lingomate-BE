import prisma from '../lib/prisma.js';
import { successResponse, errorResponse } from '../utils/response.js';

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
                return res.status(404).json(errorResponse("USER_404", "User not found", 404));
            }

            // Return standardized v2.1 response
            res.json(successResponse({
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
            }));
        } catch (err) {
            console.error("Get Profile Error:", err);
            res.status(500).json(errorResponse("SERVER_ERR", err.message));
        }
    };

    // 1.3 Update Profile
    // PUT /api/user/profile
    controller.updateProfile = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;
        // v2.1 Spec allows updating profile info AND settings here
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

            res.json(successResponse({
                userId: updatedUser.id,
                name: updatedUser.username,
                avatarUrl: updatedUser.avatarUrl,
                country: updatedUser.countryPref,
                style: updatedUser.stylePref,
                gender: updatedUser.genderPref
            }));
        } catch (err) {
            console.error("Update Profile Error:", err);
            res.status(500).json(errorResponse("UPDATE_ERR", "Update failed"));
        }
    };

    // --- 5. CONVERSATION SETTINGS ---

    // 5.1 Get Settings
    // GET /api/conversation/settings
    controller.getSettings = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;

        try {
            const user = await prisma.user.findUnique({ where: { auth0Sub } });
            
            if (!user) return res.status(404).json(errorResponse("USER_404", "User not found", 404));

            res.json(successResponse({
                country: user.countryPref,
                style: user.stylePref,
                gender: user.genderPref
            }));
        } catch (err) {
            res.status(500).json(errorResponse("SERVER_ERR", err.message));
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

            res.json(successResponse({
                country: updatedUser.countryPref,
                style: updatedUser.stylePref,
                gender: updatedUser.genderPref
            }));
        } catch (err) {
            res.status(500).json(errorResponse("UPDATE_ERR", "Update settings failed"));
        }
    };

    // --- Legacy/Optional: Dashboard ---
    // Kept for compatibility if frontend still calls /dashboard
    controller.getDashboard = async (req, res) => {
        // This can just redirect to getProfile or combine profile + stats
        // For v2.1 strict adherence, the frontend should call /api/user/profile and /api/stats separately.
        // But keeping this won't hurt.
        return controller.getProfile(req, res);
    };

    return controller;
};