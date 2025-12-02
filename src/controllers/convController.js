import axios from "axios";
import prisma from "../lib/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";

const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export default (wss) => {
    const controller = {};

    /**
     * 1. 대화 리셋
     * POST /api/conversation/reset
     * Body: { userId?: string }
     *
     * 역할:
     *  - 해당 userId의 CHAT_HISTORY, CURRENT_TOPIC, ACCURACY 초기화
     *  - 새로운 대화 세션 시작
     */
    controller.reset = async (req, res) => {
        const { userId } = req.body;

        try {
            const { data } = await axios.post(`${AI_URL}/reset`, {
                userId: userId || "anonymous",
            });

            return res.json(successResponse({ userId: data.userId }));
        } catch (err) {
            console.error("RESET ERROR:", err?.response?.data || err);
            return res
                .status(500)
                .json(errorResponse("AI_ERR", "Conversation reset failed"));
        }
    };

    /**
     * 9. 전체 대화 히스토리 조회
     * GET /api/conversation/history?userId=u_123
     *
     * NOTE: This now retrieves CHAT_HISTORY from the AI microservice,
     * NOT Prisma conversation sessions.
     */
    controller.getHistory = async (req, res) => {
        const userId = req.query.userId || "anonymous";

        try {
            const { data } = await axios.get(
                `${AI_URL}/conversation/history`,
                { params: { userId } }
            );

            return res.json(
                successResponse({
                    userId: data.userId,
                    history: data.history,
                })
            );
        } catch (err) {
            console.error("HISTORY ERROR:", err?.response?.data || err);
            return res
                .status(500)
                .json(errorResponse("AI_ERR", "Failed to load history"));
        }
    };

    // -----------------------------------------
    // Below: KEEP your existing Prisma-based conversation logic
    // for sessions used in Speak Mode (voice conversation).
    // -----------------------------------------

    // 2.1 Start Session — POST /api/conversation/start
    controller.startSession = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;

        try {
            const user = await prisma.user.findUnique({ where: { auth0Sub } });
            if (!user)
                return res
                    .status(404)
                    .json(errorResponse("USER_404", "User not found", 404));

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
            console.error(err);
            return res
                .status(500)
                .json(errorResponse("SERVER_ERR", err.message));
        }
    };

    // 2.2 Finish Session + Upload Script
    controller.finishSession = async (req, res) => {
        const { sessionId, script } = req.body;

        if (!sessionId || !Array.isArray(script)) {
            return res
                .status(400)
                .json(
                    errorResponse(
                        "BAD_REQ",
                        "Missing sessionId or script array",
                        400
                    )
                );
        }

        try {
            const id = parseInt(sessionId);

            await prisma.conversation.update({
                where: { id },
                data: { finishedAt: new Date() },
            });

            const messagesData = script.map((msg) => ({
                conversationId: id,
                sender: msg.from.toLowerCase() === "ai" ? "AI" : "USER",
                content: msg.text,
            }));

            if (messagesData.length > 0) {
                await prisma.message.createMany({
                    data: messagesData,
                });
            }

            return res.json(
                successResponse({
                    sessionId: id,
                    savedMessages: messagesData.length,
                })
            );
        } catch (err) {
            console.error(err);
            return res
                .status(500)
                .json(
                    errorResponse("SERVER_ERR", "Failed to save conversation")
                );
        }
    };

    // 2.4 Get Specific Speak-Session
    controller.getSession = async (req, res) => {
        const { sessionId } = req.params;
        try {
            const conv = await prisma.conversation.findUnique({
                where: { id: parseInt(sessionId) },
                include: {
                    messages: { orderBy: { id: "asc" } },
                },
            });

            if (!conv)
                return res
                    .status(404)
                    .json(
                        errorResponse("NOT_FOUND", "Conversation not found", 404)
                    );

            return res.json(
                successResponse({
                    sessionId: conv.id,
                    script: conv.messages.map((m) => ({
                        from: m.sender.toLowerCase(),
                        text: m.content,
                    })),
                })
            );
        } catch (err) {
            console.error(err);
            return res
                .status(500)
                .json(errorResponse("SERVER_ERR", err.message));
        }
    };

    // 2.5 Delete Speak-Session
    controller.deleteSession = async (req, res) => {
        const { sessionId, all } = req.body;
        const auth0Sub = req.auth?.payload?.sub;

        try {
            const user = await prisma.user.findUnique({ where: { auth0Sub } });

            if (all) {
                await prisma.conversation.deleteMany({
                    where: { userId: user.id },
                });
                return res.json(
                    successResponse(null, "All conversations deleted")
                );
            }

            if (sessionId) {
                await prisma.conversation.delete({
                    where: { id: parseInt(sessionId) },
                });
                return res.json(
                    successResponse(null, "Conversation deleted")
                );
            }

            return res
                .status(400)
                .json(
                    errorResponse(
                        "BAD_REQ",
                        "Provide sessionId or all:true",
                        400
                    )
                );
        } catch (err) {
            console.error(err);
            return res
                .status(500)
                .json(errorResponse("SERVER_ERR", "Delete failed"));
        }
    };

    return controller;
};
