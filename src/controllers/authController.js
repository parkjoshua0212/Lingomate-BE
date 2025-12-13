// src/controllers/authController.js
import prisma from "../lib/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";

export default () => {
  const controller = {};

  // Small helper: normalize optional strings
  const clean = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

  // ============================================================
  // GET /api/auth/me
  // ✅ Auto-create user if missing (so new Auth0 accounts won't 404)
  // ============================================================
  controller.getMe = async (req, res) => {
    const auth0Sub = req.auth?.payload?.sub;

    try {
      if (!auth0Sub) {
        return res
          .status(401)
          .json(errorResponse("AUTH_401", "Missing auth subject", 401));
      }

      // ✅ Upsert guarantees the user exists after this call
      const user = await prisma.user.upsert({
        where: { auth0Sub },
        update: {}, // don't overwrite anything on existing users
        create: {
          auth0Sub,
          username: "User",
          email: null,
          avatarUrl: null,
          stats: {
            create: {
              totalSentences: 0,
              totalTimeMins: 0,
              studyStreak: 0,
              lastStudyDate: null,
            },
          },
          subscription: {
            create: { planName: "free", isActive: true },
          },
        },
        include: { subscription: true },
      });

      return res.json(
        successResponse({
          auth0Id: auth0Sub,
          userId: user.id,
          email: user.email,
          name: user.username,
          subscription: user.subscription?.planName || "free",
        })
      );
    } catch (err) {
      console.error("GET /auth/me error:", err);
      return res.status(500).json(errorResponse("DB_ERR", err.message));
    }
  };

  // ============================================================
  // POST /api/auth/register-if-needed
  // ✅ Create if missing + update fields if provided
  // ============================================================
  controller.syncUser = async (req, res) => {
    const auth0Sub = req.auth?.payload?.sub;

    // ✅ prevent "Cannot destructure req.body" issues
    const body = req.body ?? {};
    const username = clean(body.username);
    const email = clean(body.email);
    const avatarUrl = clean(body.avatarUrl);

    try {
      if (!auth0Sub) {
        return res
          .status(401)
          .json(errorResponse("AUTH_401", "Missing auth subject", 401));
      }

      // ✅ Upsert ensures user exists; update only fields provided
      const user = await prisma.user.upsert({
        where: { auth0Sub },
        update: {
          ...(username ? { username } : {}),
          ...(email ? { email } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
        },
        create: {
          auth0Sub,
          username: username || "User",
          email: email || null,
          avatarUrl: avatarUrl || null,
          stats: {
            create: {
              totalSentences: 0,
              totalTimeMins: 0,
              studyStreak: 0,
              lastStudyDate: null,
            },
          },
          subscription: {
            create: { planName: "free", isActive: true },
          },
        },
        include: { stats: true, subscription: true },
      });

      // If it was newly created, Prisma doesn’t directly tell you here.
      // So return 200 always; FE doesn’t really need 201 vs 200.
      return res.json(successResponse(user, "User synced"));
    } catch (err) {
      console.error("POST /auth/register-if-needed error:", err);
      return res.status(500).json(errorResponse("DB_ERR", err.message));
    }
  };

  return controller;
};
