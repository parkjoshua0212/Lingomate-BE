import axios from "axios";
import prisma from "../lib/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";

const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export default (wss) => {
  const controller = {};

  // ============================================================
  // 1) RESET: clear all conversation history for the logged-in user
  // ============================================================
  controller.reset = async (req, res) => {
    const auth0Sub = req.auth?.payload?.sub;

    try {
      const user = await prisma.user.findUnique({ where: { auth0Sub } });

      if (!user) {
        return res.status(404).json(errorResponse("USER_404", "User not found", 404));
      }

      const result = await prisma.conversation.deleteMany({
        where: { userId: user.id },
      });

      return res.json(
        successResponse({
          userId: user.id,
          deletedConversations: result.count,
        })
      );
    } catch (err) {
      console.error("RESET ERROR:", err);
      return res.status(500).json(errorResponse("SERVER_ERR", "Conversation reset failed"));
    }
  };

  // ============================================================
  // 2) Get FULL chat/speak history for the logged-in user
  // ============================================================
  controller.getHistory = async (req, res) => {
    const auth0Sub = req.auth?.payload?.sub;

    try {
      const user = await prisma.user.findUnique({ where: { auth0Sub } });

      if (!user) {
        return res.status(404).json(errorResponse("USER_404", "User not found", 404));
      }

      const conversations = await prisma.conversation.findMany({
        where: { userId: user.id },
        include: {
          messages: { orderBy: { id: "asc" } },
        },
        orderBy: { startedAt: "desc" },
      });

      const history = conversations.map((conv) => ({
        sessionId: conv.id,
        startTime: conv.startedAt,
        finishedAt: conv.finishedAt,
        script: conv.messages.map((m) => ({
          from: m.sender.toLowerCase(),
          text: m.content,
        })),
      }));

      return res.json(successResponse({ userId: user.id, history }));
    } catch (err) {
      console.error("HISTORY ERROR:", err);
      return res.status(500).json(errorResponse("SERVER_ERR", "Failed to load history"));
    }
  };

  // ============================================================
  // 3) Start Conversation Session (Speak Mode)
  // ============================================================
  controller.startSession = async (req, res) => {
    const auth0Sub = req.auth?.payload?.sub;

    try {
      const user = await prisma.user.findUnique({ where: { auth0Sub } });

      if (!user) {
        return res.status(404).json(errorResponse("USER_404", "User not found", 404));
      }

      const conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          countryUsed: user.countryPref,
          styleUsed: user.stylePref,
          genderUsed: user.genderPref,
        },
      });

      return res.json(
        successResponse({
          sessionId: conversation.id,
          startTime: conversation.startedAt,
        })
      );
    } catch (err) {
      console.error("START SESSION ERROR:", err);
      return res.status(500).json(errorResponse("SERVER_ERR", err.message));
    }
  };

  // ============================================================
  // 4) Finish Session + Save Messages + Update UserStat (minutes/streak/sentences/score)
  // ============================================================
  controller.finishSession = async (req, res) => {
    const auth0Sub = req.auth?.payload?.sub;

    try {
      const { sessionId, script, score } = req.body;

      // --- 1) auth & user ---
      const user = await prisma.user.findUnique({
        where: { auth0Sub },
        include: { stats: true }, // ✅ needed for streak
      });

      if (!user) {
        return res.status(404).json(errorResponse("USER_404", "User not found", 404));
      }

      // --- 2) validate sessionId ---
      if (!sessionId) {
        return res.status(400).json(errorResponse("BAD_REQ", "Missing sessionId", 400));
      }

      const id = Number(sessionId);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json(errorResponse("BAD_REQ", "Invalid sessionId", 400));
      }

      // --- 3) Check conversation belongs to this user ---
      const conversation = await prisma.conversation.findFirst({
        where: { id, userId: user.id },
      });

      if (!conversation) {
        return res.status(404).json(errorResponse("NOT_FOUND", "Conversation not found", 404));
      }

      // ✅ Guard: prevent double-finish (prevents double stats increments)
      if (conversation.finishedAt) {
        return res.status(400).json(errorResponse("BAD_REQ", "Session already finished", 400));
      }

      // --- 4) script normalization ---
      const history = Array.isArray(script) ? script : [];
      const finishedAt = new Date();

      // --- 5) Prepare Message createMany data ---
      const messagesData = history
        .filter((m) => m && typeof m.text === "string" && typeof m.from === "string")
        .map((msg) => ({
          conversationId: id,
          sender: msg.from.toUpperCase(), // "USER" | "AI"
          content: msg.text,
        }));

      // Count sentences (proxy) = number of USER messages in this session
      const sessionUserSentences = messagesData.filter((m) => m.sender === "USER").length;

      // --- 6) Compute session minutes ---
      const started = new Date(conversation.startedAt).getTime();
      const finished = finishedAt.getTime();
      const durationSec = Math.max(0, Math.floor((finished - started) / 1000));
      const timeBasedMins = Math.ceil(durationSec / 60);

      const msgCount = messagesData.length;
      const msgBasedMins = Math.ceil(msgCount / 6); // tune if needed

      const sessionMins = Math.max(1, timeBasedMins, msgBasedMins);

      // --- 7) Update streak ---
      const prevLast = user.stats?.lastStudyDate ? new Date(user.stats.lastStudyDate) : null;

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfToday.getDate() - 1);

      let nextStreak = 1;

      if (prevLast) {
        const prev = new Date(prevLast);
        prev.setHours(0, 0, 0, 0);

        if (prev.getTime() === startOfToday.getTime()) {
          nextStreak = user.stats?.studyStreak ?? 1;
        } else if (prev.getTime() === startOfYesterday.getTime()) {
          nextStreak = (user.stats?.studyStreak ?? 0) + 1;
        } else {
          nextStreak = 1;
        }
      }

      // ============================================================
      // ✅ SIMPLE BACKEND SCORE (fast implementation)
      // - If FE provides `score` number: use that
      // - else compute based on user messages + characters
      // ============================================================
      const userMsgs = messagesData.filter((m) => m.sender === "USER");
      const userMsgCount = userMsgs.length;
      const userChars = userMsgs.reduce((sum, m) => sum + (m.content?.length ?? 0), 0);

      let computedScore = 40 + userMsgCount * 12 + Math.floor(userChars / 40);
      computedScore = Math.max(0, Math.min(100, computedScore));

      const finalScore =
        typeof score === "number" && Number.isFinite(score)
          ? Math.max(0, Math.min(100, Math.round(score)))
          : Math.round(computedScore);

      // --- 8) Transaction: update conversation + messages + userStat ---
      await prisma.$transaction(async (tx) => {
        // Update conversation
        await tx.conversation.update({
          where: { id },
          data: {
            fullScript: JSON.stringify(history),
            finishedAt,
            score: finalScore, // ✅ always saved now
          },
        });

        // Save messages (avoid duplicates)
        if (messagesData.length > 0) {
          await tx.message.deleteMany({ where: { conversationId: id } });
          await tx.message.createMany({ data: messagesData });
        }

        // Upsert user stats
        await tx.userStat.upsert({
          where: { userId: user.id },
          update: {
            totalTimeMins: { increment: sessionMins },
            totalSentences: { increment: sessionUserSentences },
            studyStreak: nextStreak,
            lastStudyDate: finishedAt,
          },
          create: {
            userId: user.id,
            totalTimeMins: sessionMins,
            totalSentences: sessionUserSentences,
            studyStreak: nextStreak,
            lastStudyDate: finishedAt,
          },
        });
      });

      return res.json(
        successResponse(
          {
            sessionId: id,
            savedMessages: messagesData.length,
            sessionMinutesAdded: sessionMins,
            sentencesAdded: sessionUserSentences,
            scoreSaved: finalScore,
          },
          "Conversation saved successfully"
        )
      );
    } catch (err) {
      console.error("FINISH SESSION ERROR:", err);
      return res.status(500).json(errorResponse("SERVER_ERR", err.message || "Failed to save conversation"));
    }
  };

  // ============================================================
  // 5) Get a Speak-Mode Session
  // ============================================================
  controller.getSession = async (req, res) => {
    const { sessionId } = req.params;

    try {
      const conv = await prisma.conversation.findUnique({
        where: { id: parseInt(sessionId, 10) },
        include: {
          messages: { orderBy: { id: "asc" } },
        },
      });

      if (!conv) {
        return res.status(404).json(errorResponse("NOT_FOUND", "Conversation not found", 404));
      }

      return res.json(
        successResponse({
          sessionId: conv.id,
          script: conv.messages.map((m) => ({
            from: m.sender.toLowerCase(),
            text: m.content,
          })),
          fullScript: conv.fullScript ? JSON.parse(conv.fullScript) : null,
        })
      );
    } catch (err) {
      console.error("GET SESSION ERROR:", err);
      return res.status(500).json(errorResponse("SERVER_ERR", err.message));
    }
  };

  // ============================================================
  // 6) Delete Speak-Mode Session(s)
  // ============================================================
  controller.deleteSession = async (req, res) => {
    const { sessionId, all } = req.body;
    const auth0Sub = req.auth?.payload?.sub;

    try {
      const user = await prisma.user.findUnique({ where: { auth0Sub } });

      if (!user) {
        return res.status(404).json(errorResponse("USER_404", "User not found", 404));
      }

      if (all) {
        const result = await prisma.conversation.deleteMany({
          where: { userId: user.id },
        });

        return res.json(successResponse({ deletedConversations: result.count }, "All conversations deleted"));
      }

      if (sessionId === undefined || sessionId === null) {
        return res.status(400).json(errorResponse("BAD_REQ", "Provide sessionId or all:true", 400));
      }

      const id = Number(sessionId);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json(errorResponse("BAD_REQ", "Invalid sessionId", 400));
      }

      const result = await prisma.conversation.deleteMany({
        where: { id, userId: user.id },
      });

      if (result.count === 0) {
        return res.status(404).json(errorResponse("NOT_FOUND", "Conversation not found", 404));
      }

      return res.json(successResponse({ deletedConversations: result.count }, "Conversation deleted"));
    } catch (err) {
      console.error("DELETE SESSION ERROR:", err);
      return res.status(500).json(errorResponse("SERVER_ERR", "Delete failed"));
    }
  };

  return controller;
};
