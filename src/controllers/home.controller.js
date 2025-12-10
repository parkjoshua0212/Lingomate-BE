// src/controllers/homeController.js

import prisma from "../lib/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";

export default () => {
  const controller = {};

  controller.getHomeStatus = async (req, res) => {
    console.log("\n[HOME] getHomeStatus called");

    try {
      const auth0Sub = req.auth?.payload?.sub;

      if (!auth0Sub) {
        console.error("[HOME] Missing auth0Sub in request");
        return res
          .status(401)
          .json(errorResponse("AUTH_ERR", "Unauthorized", 401));
      }

      console.log("[HOME] Looking up user:", auth0Sub);

      const user = await prisma.user.findUnique({
        where: { auth0Sub },
        include: {
          stats: true,
          subscription: true,
        },
      });

      if (!user) {
        console.error("[HOME] User not found:", auth0Sub);
        return res.status(404).json({
          success: false,
          code: "USER_NOT_FOUND",
          message: "User not registered",
        });
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayCount = await prisma.conversation.count({
        where: {
          userId: user.id,
          startedAt: { gte: todayStart },
        },
      });

      console.log("[HOME] Today conversation count:", todayCount);

      return res.json(
        successResponse({
          todayConversationCount: todayCount,
          subscription: user.subscription?.planName ?? "free",
        })
      );
    } catch (err) {
      console.error("[HOME] ERROR in getHomeStatus:", {
        message: err.message,
        stack: err.stack,
      });

      return res
        .status(500)
        .json(errorResponse("HOME_ERR", "Home status failed", 500));
    }
  };

  return controller;
};
