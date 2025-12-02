import axios from "axios";
import prisma from "../lib/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";

const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export default (wss) => {
    const controller = {};

    // ============================================================
    // 1) AI MICRO-SERVICE: RESET CHAT HISTORY
    // ============================================================
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

    // ============================================================
    // 2) AI MICRO-SERVICE: GET FULL CHAT HISTORY
    // ============================================================
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

    // ============================================================
    // BELOW: PRISMA SPEAK-MODE SESSION LOGIC (VOICE MODE)
    // ============================================================

    // ============================================================
    // 3) Start Conversation Session (Speak Mode)
    // ============================================================
    controller.startSession = async (req, res) => {
        const auth0Sub = req.auth?.payload?.sub;

        try {
            const user = await prisma.user.findUnique({
                where: { auth0Sub },
            });

            if (!user) {
                return res
                    .status(404)
                    .json(errorResponse("USER_404", "User not found", 404));
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
            return res
                .status(500)
                .json(errorResponse("SERVER_ERR", err.message));
        }
    };

    // ============================================================
    // 4) Finish Session + Save Messages
    // ============================================================
    controller.finishSession = async (req, res) => {
        const { sessionId, script } = req.body;

        if (!sessionId || !Array.isArray(script)) {
            return res.status(400).json(
                errorResponse(
                    "BAD_REQ",
                    "Missing sessionId or script array",
                    400
                )
            );
        }

        try {
            const id = parseInt(sessionId);

            // Mark session as finished
            await prisma.conversation.update({
                where: { id },
                data: { finishedAt: new Date() },
            });

            // Save messages individually
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
            console.error("FINISH SESSION ERROR:", err);
            return res
                .status(500)
                .json(
                    errorResponse("SERVER_ERR", "Failed to save conversation")
                );
        }
    };

    // ============================================================
    // 5) Get a Speak-Mode Session
    // ============================================================
    controller.getSession = async (req, res) => {
        const { sessionId } = req.params;

        try {
            const conv = await prisma.conversation.findUnique({
                where: { id: parseInt(sessionId) },
                include: {
                    messages: { orderBy: { id: "asc" } },
                },
            });

            if (!conv) {
                return res
                    .status(404)
                    .json(
                        errorResponse("NOT_FOUND", "Conversation not found", 404)
                    );
            }

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
            console.error("GET SESSION ERROR:", err);
            return res
                .status(500)
                .json(errorResponse("SERVER_ERR", err.message));
        }
    };

    // ============================================================
    // 6) Delete Speak-Mode Session(s)
    // ============================================================
    controller.deleteSession = async (req, res) => {
        const { sessionId, all } = req.body;
        const auth0Sub = req.auth?.payload?.sub;

        try {
            const user = await prisma.user.findUnique({
                where: { auth0Sub },
            });

            if (!user) {
                return res
                    .status(404)
                    .json(errorResponse("USER_404", "User not found", 404));
            }

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

                return res.json(successResponse(null, "Conversation deleted"));
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
            console.error("DELETE SESSION ERROR:", err);
            return res
                .status(500)
                .json(errorResponse("SERVER_ERR", "Delete failed"));
        }
    };

    return controller;
};
