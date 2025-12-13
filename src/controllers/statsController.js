// src/controllers/statsController.js
import prisma from '../lib/prisma.js';
import { successResponse, errorResponse } from '../utils/response.js';

export default () => {
  const controller = {};

  // GET /api/stats
  controller.getStats = async (req, res) => {
    const auth0Sub = req.auth?.payload?.sub;
    if (!auth0Sub) {
      return res.status(401).json(errorResponse("AUTH_401", "Unauthorized", 401));
    }

    try {
      const user = await prisma.user.findUnique({
        where: { auth0Sub },
        include: { stats: true },
      });

      if (!user) {
        return res.status(404).json(errorResponse("USER_404", "User not found", 404));
      }

      // 1) Finished sessions (and fetch fields needed to estimate minutes)
      const finishedConversations = await prisma.conversation.findMany({
        where: {
          userId: user.id,
          finishedAt: { not: null },
        },
        select: {
          startedAt: true,
          finishedAt: true,
          _count: { select: { messages: true } },
          // score will exist after schema update (step 2)
          score: true,
        },
      });

      const totalSessions = finishedConversations.length;

      // 2) Total minutes = sum of each session minutes
      // per session minutes = max(1, ceil(duration/60), ceil(messages/6))
      let totalMinutes = 0;

      for (const c of finishedConversations) {
        const started = new Date(c.startedAt).getTime();
        const finished = c.finishedAt ? new Date(c.finishedAt).getTime() : started;

        const durationSec = Math.max(0, Math.floor((finished - started) / 1000));
        const timeBasedMins = Math.ceil(durationSec / 60);

        const msgCount = c._count?.messages ?? 0;
        const msgBasedMins = Math.ceil(msgCount / 6); // tune ratio if you want

        const sessionMins = Math.max(1, timeBasedMins, msgBasedMins);
        totalMinutes += sessionMins;
      }

      // 3) Scores (after schema update). If no scores recorded yet -> 0.
      let avgScore = 0;
      let bestScore = 0;

      // Only use conversations with score not null
      const scored = finishedConversations.filter(c => typeof c.score === "number");

      if (scored.length > 0) {
        const sum = scored.reduce((acc, c) => acc + (c.score ?? 0), 0);
        avgScore = Math.round(sum / scored.length);
        bestScore = Math.max(...scored.map(c => c.score ?? 0));
      }

      // 4) Streak + “학습한 단어 및 문장”
      const streak = user.stats?.studyStreak ?? 0;
      const newWordsLearned = user.stats?.totalSentences ?? 0;

      // 5) Progress (12 stamps = last 12 days)
      const days = 12;
      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);

      // Find finished convs within range
      const recentFinished = await prisma.conversation.findMany({
        where: {
          userId: user.id,
          finishedAt: { not: null, gte: start },
        },
        select: { finishedAt: true },
      });

      const daySet = new Set(
        recentFinished
          .map(x => x.finishedAt)
          .filter(Boolean)
          .map(d => {
            const dd = new Date(d);
            dd.setHours(0, 0, 0, 0);
            return dd.toISOString().slice(0, 10);
          })
      );

      const progress = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        progress.push(daySet.has(key) ? 1 : 0);
      }

      return res.json(
        successResponse({
          totalSessions,
          totalMinutes,
          avgScore,
          bestScore,
          streak,
          newWordsLearned,
          progress,
        })
      );
    } catch (err) {
      console.error("Get Stats Error:", err);
      return res.status(500).json(errorResponse("SERVER_ERR", err.message));
    }
  };

  return controller;
};
