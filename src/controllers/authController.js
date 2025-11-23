import prisma from '../lib/prisma.js';
import { successResponse, errorResponse } from '../utils/response.js';

export default () => {
    const controller = {};

    // 1.1 Me (GET /api/auth/me)
    // Returns the current user's info based on their token
    controller.getMe = async (req, res) => {
        // The ID comes from the Auth0 Token (req.auth.payload.sub)
        const auth0Sub = req.auth?.payload?.sub;

        try {
            // Find user and include subscription plan
            const user = await prisma.user.findUnique({
                where: { auth0Sub },
                include: { subscription: true }
            });
            
            if (!user) return res.status(404).json(errorResponse("AUTH_404", "User not registered in DB", 404));

            // Return standardized v2.1 response
            res.json(successResponse({
                auth0Id: auth0Sub,
                userId: user.id,
                email: user.email,
                name: user.username,
                subscription: user.subscription?.planName || 'free'
            }));
        } catch (err) {
            console.error("Get Me Error:", err);
            res.status(500).json(errorResponse("SERVER_ERR", err.message));
        }
    };

    // [CRITICAL] Sync User (POST /api/auth/register-if-needed)
    // Frontend calls this immediately after Auth0 login to sync DB
    controller.syncUser = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;
        const { username, email, avatarUrl } = req.body;

        if (!auth0Sub) {
            return res.status(400).json(errorResponse("AUTH_001", "Auth0 ID missing from token", 400));
        }

        try {
            // 1. Check if user already exists
            let user = await prisma.user.findUnique({
                where: { auth0Sub },
                include: { stats: true }
            });

            // 2. [Scenario A] User exists -> Return success
            if (user) {
                // Self-healing: If an old user exists but has no stats/subscription rows, create them now.
                // This prevents crashes on the Dashboard.
                if (!user.stats) {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { 
                            stats: { create: { totalSentences: 0, studyStreak: 0 } }, 
                            subscription: { create: { planName: 'free', isActive: true } } 
                        }
                    });
                }
                console.log(`[Auth] User Logged In: ${user.username}`);
                return res.json(successResponse(user, "Login successful"));
            }

            // 3. [Scenario B] New User -> Create in DB
            user = await prisma.user.create({
                data: {
                    auth0Sub,
                    username: username || "User",
                    email: email,
                    avatarUrl: avatarUrl,
                    // Important: Initialize stats and subscription tables immediately!
                    stats: { 
                        create: { totalSentences: 0, studyStreak: 0 } 
                    },
                    subscription: { 
                        create: { planName: 'free', isActive: true } 
                    }
                },
                include: { stats: true, subscription: true }
            });

            console.log(`[Auth] New User Created: ${username}`);
            res.status(201).json(successResponse(user, "User registered successfully"));

        } catch (err) {
            console.error("Sync Error:", err);
            res.status(500).json(errorResponse("DB_ERR", err.message));
        }
    };

    return controller;
};