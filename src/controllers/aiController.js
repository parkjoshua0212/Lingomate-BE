// src/controllers/aiController.js
import axios from "axios";
import { successResponse, errorResponse } from "../utils/response.js";
import { sttViaAI } from "../lib/aiSttClient.js";
import { ttsViaAI } from "../lib/aiTtsClient.js";

const AI_BASE_URL = process.env.AI_SERVICE_URL;

if (!AI_BASE_URL) {
  console.warn("[AI] AI_SERVICE_URL is missing!");
} else {
  console.log("[AI] aiController initialized with:", AI_BASE_URL);
}

// Shared helper for forwarding requests to AI server
async function callAi(method, path, body, label, res) {
  const url = `${AI_BASE_URL}${path}`;

  console.log(`[AI ${label}] outgoing request`, {
    method,
    url,
    bodyPreview:
      typeof body === "string"
        ? body.slice(0, 100)
        : body && typeof body === "object"
        ? Object.keys(body)
        : body,
  });

  try {
    const resp = await axios({
      method,
      url,
      data: body,
      timeout: 15000,
    });

    console.log(`[AI ${label}] response`, {
      status: resp.status,
      dataSample:
        typeof resp.data === "string"
          ? resp.data.slice(0, 200)
          : resp.data && typeof resp.data === "object"
          ? { ...resp.data, data: undefined }
          : resp.data,
    });

    const payload = resp.data?.data ?? resp.data;
    return res.json(successResponse(payload));
  } catch (err) {
    const status = err?.response?.status || 500;

    console.error(`[AI ${label}] ERROR`, {
      message: err.message,
      code: err.code,
      status,
      url,
      responseData: err?.response?.data,
    });

    return res
      .status(status)
      .json(errorResponse("AI_ERR", `${label} Failed`, status));
  }
}

export default () => {
  const controller = {};

  // ============================
  // 1) STT — PCM upload
  // ============================
  controller.stt = async (req, res) => {
  console.log("\n================= [AI STT] Incoming Request =================");

  try {
    console.log("[AI STT] Request metadata:", {
      hasFile: !!req.file,
      fileFieldName: req.file?.fieldname,
      bodyKeys: Object.keys(req.body || {}),
      contentType: req.headers["content-type"],
    });

    if (!req.file) {
      console.error("[AI STT] ERROR: No PCM file uploaded");
      return res
        .status(400)
        .json(errorResponse("BAD_REQ", "PCM audio file required", 400));
    }

    const pcmBuffer = req.file.buffer;

    console.log("[AI STT] PCM file info:", {
      sizeBytes: pcmBuffer.length,
      isEmpty: pcmBuffer.length === 0,
      firstBytes: pcmBuffer.slice(0, 32).toString("hex"),
    });

    if (pcmBuffer.length === 0) {
      console.error("[AI STT] ERROR: PCM buffer is empty");
      return res
        .status(400)
        .json(errorResponse("BAD_REQ", "PCM file empty", 400));
    }

    const sampleRate = req.body.sampleRate
      ? Number(req.body.sampleRate)
      : 16000;

    console.log("[AI STT] Sample rate:", sampleRate);
    console.log("[AI STT] forwarding to AI server", {
      bytes: pcmBuffer.length,
      sampleRate,
    });

    let transcript;
    let altSegments;

    try {
      const result = await sttViaAI(pcmBuffer, sampleRate);
      transcript = result.transcript;
      altSegments = result.altSegments;

      console.log("[AI STT] AI STT result:", {
        transcriptPreview: transcript ? transcript.slice(0, 80) : null,
        altSegmentsCount: altSegments?.length || 0,
      });
    } catch (sttErr) {
      console.error("[AI STT] ERROR inside sttViaAI()", {
        message: sttErr.message,
        stack: sttErr.stack,
        response: sttErr.response?.data,
      });

      return res
        .status(500)
        .json(errorResponse("AI_ERR", "AI STT server failed", 500));
    }

    return res.json(
      successResponse({
        text: transcript,
        alternatives: altSegments,
      })
    );
  } catch (err) {
    console.error("[AI STT] Uncaught error:", {
      message: err.message,
      stack: err.stack,
    });

    return res
      .status(500)
      .json(errorResponse("AI_ERR", "Unexpected STT failure", 500));
  }
};

  // ============================
  // 2) TTS — via AI server
  // ============================
  controller.tts = async (req, res) => {
    const { text, accent = "us", gender = "female" } = req.body || {};

    console.log("[AI TTS] incoming request:", {
      textPreview: text ? text.slice(0, 80) : null,
      accent,
      gender,
    });

    if (!text) {
      console.warn("[AI TTS] Missing text in request body");
      return res
        .status(400)
        .json(errorResponse("BAD_REQ", "Text required", 400));
    }

    try {
      const audioBase64 = await ttsViaAI(text, accent, gender);

      console.log("[AI TTS] TTS success, audio length:", audioBase64?.length);

      return res.json(
        successResponse({
          audio: audioBase64,
          mime: "audio/wav",
        })
      );
    } catch (err) {
      console.error("[AI TTS] Error during TTS:", {
        message: err.message,
        stack: err.stack,
        response: err.response?.data,
      });

      return res
        .status(500)
        .json(errorResponse("AI_ERR", "TTS failed", 500));
    }
  };

  // ============================
  // 3) Other AI endpoints via callAi
  // ============================

  controller.chat = (req, res) =>
    callAi("POST", "/api/ai/chat", req.body || {}, "Chat", res);

  controller.feedback = (req, res) =>
    callAi("POST", "/api/ai/feedback", req.body || {}, "Feedback", res);

  controller.exampleReply = (req, res) =>
    callAi("POST", "/api/ai/example-reply", req.body || {}, "ExampleReply", res);

  controller.review = (req, res) =>
    callAi("POST", "/api/ai/review", req.body || {}, "Review", res);

  controller.getAccuracy = (_req, res) =>
    callAi("GET", "/api/stats/accuracy", null, "Accuracy", res);

  controller.getConversationHistory = (req, res) => {
    const userId = req.query.userId;
    const path = userId
      ? `/api/conversation/history?userId=${encodeURIComponent(userId)}`
      : "/api/conversation/history";

    return callAi("GET", path, null, "ConversationHistory", res);
  };

  controller.resetConversation = (req, res) =>
    callAi(
      "POST",
      "/api/conversation/reset",
      req.body || {},
      "ConversationReset",
      res
    );

  controller.health = (_req, res) =>
    callAi("GET", "/health", null, "Health", res);

  // ============================
  // 4) Phrases — local static (this was missing!)
  // ============================
  controller.getPhrases = (_req, res) => {
    console.log("[AI Phrases] returning static phrases");
    const phrases = [
      { id: 1, en: "Way to go.", kr: "잘했어" },
      { id: 2, en: "Time flies.", kr: "시간 빠르다" },
    ];
    return res.json(successResponse(phrases));
  };

  return controller;
};
