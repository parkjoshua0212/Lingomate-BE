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
        try {
      
          const { sessionId, script } = req.body;
      
          // --- 1) sessionId 유효성 체크 ---
          if (!sessionId) {
            return res
              .status(400)
              .json(errorResponse("BAD_REQ", "Missing sessionId", 400));
          }
      
          const id = Number(sessionId);
          if (!Number.isInteger(id) || id <= 0) {
            return res
              .status(400)
              .json(errorResponse("BAD_REQ", "Invalid sessionId", 400));
          }
      
          // --- 2) Conversation 존재 여부 확인 ---
          const conversation = await prisma.conversation.findUnique({
            where: { id },
          });
      
          if (!conversation) {
            return res
              .status(404)
              .json(errorResponse("NOT_FOUND", "Conversation not found", 404));
          }
      
          // --- 3) FE에서 받은 script가 없으면 빈 배열 처리 ---
          const history = Array.isArray(script) ? script : [];
      
          console.log("📘 저장할 history:", history);
      
          // --- 4) Conversation 테이블 업데이트 ---
          await prisma.conversation.update({
            where: { id },
            data: {
              fullScript: JSON.stringify(history), // 원본 저장
              finishedAt: new Date(),
            },
          });
      
          // --- 5) Message 테이블에 user/ai 메시지 저장 ---
          const messagesData = history.map((msg) => ({
            conversationId: id,
            sender: msg.from.toUpperCase(), // "USER" | "AI"
            content: msg.text,
          }));
      
          if (messagesData.length > 0) {
            await prisma.message.createMany({ data: messagesData });
          }
      
          // --- 6) 응답 ---
          return res.json(
            successResponse(
              {
                sessionId: id,
                savedMessages: messagesData.length,
              },
              "Conversation saved successfully"
            )
          );
        } catch (err) {
          console.error("FINISH SESSION ERROR:", err);
          return res
            .status(500)
            .json(errorResponse("SERVER_ERR", "Failed to save conversation"));
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
            return res
              .status(404)
              .json(
                errorResponse("NOT_FOUND", "Conversation not found", 404)
              );
          }
      
          return res.json(
            successResponse({
              sessionId: conv.id,
      
              // 1) message 테이블 기반 script (user/ai 순차 메시지)
              script: conv.messages.map((m) => ({
                from: m.sender.toLowerCase(), // "user" | "ai"
                text: m.content,
              })),
      
              // 2) fullScript: AI 서버에서 온 turn 기반 원본 (있으면 파싱)
              fullScript: conv.fullScript
                ? JSON.parse(conv.fullScript)
                : null,
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