// src/controllers/aiController.js
import axios from "axios";
import prisma from "../lib/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { sttViaAI } from "../lib/aiSttClient.js";
import { ttsViaAI } from "../lib/aiTtsClient.js";

import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

const AI_BASE_URL = process.env.AI_SERVICE_URL;

if (!AI_BASE_URL) {
  console.warn("[AI] AI_SERVICE_URL is missing!");
}

// Shared helper for forwarding requests to the AI server
async function callAi(method, path, body, label, res) {
  const url = `${AI_BASE_URL}${path}`;

  try {
    const resp = await axios({
      method,
      url,
      data: body,
      timeout: 15000,
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

// Forward a POST body to the AI server with userId forced to the authenticated
// user's database ID; any userId sent by the client is discarded.
async function callAiAsUser(req, res, path, label) {
  const auth0Sub = req.auth?.payload?.sub;
  let user;

  try {
    user = await prisma.user.findUnique({ where: { auth0Sub } });
  } catch (err) {
    console.error(`[AI ${label}] user lookup error:`, err);
    return res.status(500).json(errorResponse("SERVER_ERR", `${label} Failed`));
  }

  if (!user) {
    return res.status(404).json(errorResponse("USER_404", "User not found", 404));
  }

  const { userId: _ignored, ...body } = req.body || {};
  return callAi("POST", path, { ...body, userId: user.id }, label, res);
}

// Convert any audio file to raw PCM (s16le, 16 kHz, mono) with ffmpeg,
// which is the input format the AI service's STT endpoint expects.
function runFfmpegConvertToPcm16kMono(inPath, outPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      inPath,
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "s16le",
      outPath,
    ];

    const p = spawn("ffmpeg", args);

    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));

    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg failed (code=${code}): ${stderr}`));
    });
  });
}

async function convertUploadToPcm16kMono(file) {
  // file: multer object { buffer, originalname, mimetype, ... }
  const tmpDir = os.tmpdir();

  // Use extension from original filename if present, else fallback
  const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";

  const inPath = path.join(
    tmpDir,
    `stt_in_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`
  );
  const outPath = path.join(
    tmpDir,
    `stt_out_${Date.now()}_${Math.random().toString(16).slice(2)}.pcm`
  );

  try {
    fs.writeFileSync(inPath, file.buffer);
    await runFfmpegConvertToPcm16kMono(inPath, outPath);
    const pcm = fs.readFileSync(outPath);
    return pcm;
  } finally {
    try {
      if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
    } catch {
      // best-effort temp file cleanup
    }
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch {
      // best-effort temp file cleanup
    }
  }
}

export default () => {
  const controller = {};

  // ============================
  // 1) STT: accept any audio, convert to 16 kHz mono PCM, forward to AI server
  // ============================
  controller.stt = async (req, res) => {
    try {
      // Allow either multipart file (req.file) or base64 payload (req.body.audioBase64)
      if (!req.file && req.body?.audioBase64) {
        const audioBase64 = req.body.audioBase64;
        const fileName = req.body?.fileName || "audio.wav";

        try {
          const buffer = Buffer.from(
            audioBase64.replace(/^data:.*;base64,/, ""),
            "base64"
          );
          req.file = {
            buffer,
            originalname: fileName,
            mimetype: "application/octet-stream",
          };
        } catch (e) {
          console.error("[AI STT] ERROR decoding base64 audio", e);
          return res
            .status(400)
            .json(errorResponse("BAD_REQ", "Invalid base64 audio", 400));
        }
      }

      if (!req.file) {
        return res
          .status(400)
          .json(errorResponse("BAD_REQ", "Audio file required (field name: audio)", 400));
      }

      // .pcm uploads are assumed to already be in the right format
      const originalName = (req.file.originalname || "").toLowerCase();
      const isAlreadyRawPcm = originalName.endsWith(".pcm");

      const pcmBuffer = isAlreadyRawPcm
        ? req.file.buffer
        : await convertUploadToPcm16kMono(req.file);

      if (!pcmBuffer || pcmBuffer.length === 0) {
        return res
          .status(400)
          .json(errorResponse("BAD_REQ", "Converted PCM is empty", 400));
      }

      // Sample rate expected by the AI service
      const sampleRate = 16000;

      let transcript;
      let altSegments;

      try {
        const result = await sttViaAI(pcmBuffer, sampleRate);
        transcript = result.transcript;
        altSegments = result.altSegments;
      } catch (sttErr) {
        console.error("[AI STT] ERROR inside sttViaAI()", {
          message: sttErr.message,
          stack: sttErr.stack,
          response: sttErr.response?.data,
        });

        // Helpful error when ffmpeg not installed
        if (String(sttErr?.message || "").includes("spawn ffmpeg")) {
          return res.status(500).json(
            errorResponse(
              "FFMPEG_MISSING",
              "ffmpeg is not installed or not in PATH on this server.",
              500
            )
          );
        }

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

      // Helpful error when ffmpeg missing
      if (String(err?.message || "").includes("spawn ffmpeg")) {
        return res.status(500).json(
          errorResponse(
            "FFMPEG_MISSING",
            "ffmpeg is not installed or not in PATH on this server.",
            500
          )
        );
      }

      return res
        .status(500)
        .json(errorResponse("AI_ERR", "Unexpected STT failure", 500));
    }
  };

  // ============================
  // 2) TTS via AI server
  // ============================
  controller.tts = async (req, res) => {
    const { text, accent = "us", gender = "female" } = req.body || {};

    if (!text) {
      return res
        .status(400)
        .json(errorResponse("BAD_REQ", "Text required", 400));
    }

    try {
      const audioBase64 = await ttsViaAI(text, accent, gender);

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
  // 3) Other AI endpoints, proxied via callAi
  // ============================
  controller.chat = (req, res) =>
    callAiAsUser(req, res, "/api/ai/chat", "Chat");

  controller.feedback = (req, res) =>
    callAi("POST", "/api/ai/feedback", req.body || {}, "Feedback", res);

  controller.exampleReply = (req, res) =>
    callAi("POST", "/api/ai/example-reply", req.body || {}, "ExampleReply", res);

  controller.review = (req, res) =>
    callAi("POST", "/api/ai/review", req.body || {}, "Review", res);

  controller.getAccuracy = (_req, res) =>
    callAi("GET", "/api/stats/accuracy", null, "Accuracy", res);

  // Always uses the caller's own user ID from the Auth0 token; any userId in the request is ignored
  controller.getConversationHistory = async (req, res) => {
    const auth0Sub = req.auth?.payload?.sub;

    try {
      const user = await prisma.user.findUnique({ where: { auth0Sub } });

      if (!user) {
        return res.status(404).json(errorResponse("USER_404", "User not found", 404));
      }

      const path = `/api/conversation/history?userId=${encodeURIComponent(user.id)}`;
      return callAi("GET", path, null, "ConversationHistory", res);
    } catch (err) {
      console.error("[AI ConversationHistory] user lookup error:", err);
      return res.status(500).json(errorResponse("SERVER_ERR", "Failed to load history"));
    }
  };

  controller.resetConversation = (req, res) =>
    callAiAsUser(req, res, "/api/conversation/reset", "ConversationReset");

  // ============================
  // 4) Phrases (static list)
  // ============================
  controller.getPhrases = (_req, res) => {
    const phrases = [
      { id: 1, en: "Way to go.", kr: "잘했어" },
      { id: 2, en: "Time flies.", kr: "시간 빠르다" },
    ];
    return res.json(successResponse(phrases));
  };

  return controller;
};
