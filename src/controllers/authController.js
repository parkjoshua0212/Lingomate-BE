import prisma from '../lib/prisma.js';
import { successResponse, errorResponse } from '../utils/response.js';

export default () => {
    const controller = {};

    // ============================================================
    // GET /api/auth/me
    // Strict lookup version (NO auto-create)
    // ============================================================
    controller.getMe = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;

        try {
            const user = await prisma.user.findUnique({
                where: { auth0Sub },   // strict lookup
                include: { subscription: true }  // keep your version's include
            });

            if (!user) {
                return res.status(404).json(
                    errorResponse("AUTH_404", "User not registered in DB", 404)
                );
            }

            return res.json(successResponse({
                auth0Id: auth0Sub,
                userId: user.id,
                email: user.email,
                name: user.username,
                subscription: user.subscription?.planName || "free",
            }));

        } catch (err) {
            return res.status(500).json(errorResponse("DB_ERR", err.message));
        }
    };

    // ============================================================
    // POST /api/auth/register-if-needed
    // Auto-create version (from your original code)
    // ============================================================
    controller.syncUser = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;
        const { username, email, avatarUrl } = req.body;

        try {
            // 1. Check if user already exists
            let user = await prisma.user.findUnique({
                where: { auth0Sub },
                include: { stats: true, subscription: true }
            });

            if (user) {
                return res.json(successResponse(user, "Login successful"));
            }

            // 2. Create new user (your Prisma create logic)
            user = await prisma.user.create({
                data: {
                    auth0Sub,
                    username: username || "User",
                    email,
                    avatarUrl,
                    stats: { create: { totalSentences: 0, studyStreak: 0 } },
                    subscription: { create: { planName: "free", isActive: true } }
                },
                include: { stats: true, subscription: true }
            });

            return res
                .status(201)
                .json(successResponse(user, "User registered successfully"));

        } catch (err) {
            return res.status(500).json(errorResponse("DB_ERR", err.message));
        }
    };

    return controller;
};
