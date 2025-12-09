import axios from "axios";
import prisma from "../lib/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";

const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export default (wss) => {
    const controller = {};

    // ============================================================
    // 1) AI MICRO-SERVICE: RESET CHAT HISTORY
    // ============================================================
    // 1) RESET: clear all conversation history for the logged-in user (Prisma)
controller.reset = async (req, res) => {
    const auth0Sub = req.auth?.payload?.sub;

    try {
        // Find the user by Auth0 sub
        const user = await prisma.user.findUnique({
            where: { auth0Sub },
        });

        if (!user) {
            return res
                .status(404)
                .json(errorResponse("USER_404", "User not found", 404));
        }

        // Delete all conversations for this user
        // (Messages should be deleted via cascades, same as deleteSession)
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
        return res
            .status(500)
            .json(
                errorResponse(
                    "SERVER_ERR",
                    "Conversation reset failed"
                )
            );
    }
};


    // ============================================================
    // 2) AI MICRO-SERVICE: GET FULL CHAT HISTORY
    // ============================================================
    // 2) Get FULL chat/speak history for the logged-in user (from Prisma)
controller.getHistory = async (req, res) => {
    const auth0Sub = req.auth?.payload?.sub;

    try {
        // 1) Find the user by Auth0 sub
        const user = await prisma.user.findUnique({
            where: { auth0Sub },
        });

        if (!user) {
            return res
                .status(404)
                .json(errorResponse("USER_404", "User not found", 404));
        }

        // 2) Fetch this user's conversations + messages
        const conversations = await prisma.conversation.findMany({
            where: { userId: user.id },
            include: {
                messages: {
                    orderBy: { id: "asc" },
                },
            },
            orderBy: { startedAt: "desc" },
            // optional: limit how many sessions you return
            // take: 20,
        });

        // 3) Shape it into a simple history object
        const history = conversations.map((conv) => ({
            sessionId: conv.id,
            startTime: conv.startedAt,
            finishedAt: conv.finishedAt,
            script: conv.messages.map((m) => ({
                from: m.sender.toLowerCase(), // "ai" | "user"
                text: m.content,
            })),
        }));

        return res.json(
            successResponse({
                userId: user.id,
                history,
            })
        );
    } catch (err) {
        console.error("HISTORY ERROR:", err);
        return res
            .status(500)
            .json(errorResponse("SERVER_ERR", "Failed to load history"));
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

    // Basic validation
    if (!sessionId || !Array.isArray(script)) {
        return res.status(400).json(
            errorResponse(
                "BAD_REQ",
                "Missing sessionId or script array",
                400
            )
        );
    }

    const id = Number(sessionId);
    if (!Number.isInteger(id) || id <= 0) {
        return res
            .status(400)
            .json(errorResponse("BAD_REQ", "Invalid sessionId", 400));
    }

    try {
        // (Optional but recommended) Check the session exists
        const conversation = await prisma.conversation.findUnique({
            where: { id },
        });

        if (!conversation) {
            return res
                .status(404)
                .json(
                    errorResponse(
                        "NOT_FOUND",
                        "Conversation session not found",
                        404
                    )
                );
        }

        // If you want, also check ownership here (recommended):
        // const auth0Sub = req.auth?.payload?.sub;
        // const user = await prisma.user.findUnique({ where: { auth0Sub } });
        // if (!user || user.id !== conversation.userId) { ... 403 ... }

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
        // 1) Find logged-in user
        const user = await prisma.user.findUnique({
            where: { auth0Sub },
        });

        if (!user) {
            return res
                .status(404)
                .json(errorResponse("USER_404", "User not found", 404));
        }

        // 2) Delete ALL conversations for this user
        if (all) {
            const result = await prisma.conversation.deleteMany({
                where: { userId: user.id },
            });

            return res.json(
                successResponse(
                    { deletedConversations: result.count },
                    "All conversations deleted"
                )
            );
        }

        // 3) Delete ONE conversation by sessionId
        if (sessionId === undefined || sessionId === null) {
            return res
                .status(400)
                .json(
                    errorResponse(
                        "BAD_REQ",
                        "Provide sessionId or all:true",
                        400
                    )
                );
        }

        const id = Number(sessionId);
        if (!Number.isInteger(id) || id <= 0) {
            return res
                .status(400)
                .json(errorResponse("BAD_REQ", "Invalid sessionId", 400));
        }

        // Only delete conversations that belong to this user
        const result = await prisma.conversation.deleteMany({
            where: {
                id,
                userId: user.id,
            },
        });

        if (result.count === 0) {
            // No rows matched: either wrong id or not this user's session
            return res
                .status(404)
                .json(
                    errorResponse(
                        "NOT_FOUND",
                        "Conversation not found",
                        404
                    )
                );
        }

        return res.json(
            successResponse(
                { deletedConversations: result.count },
                "Conversation deleted"
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
