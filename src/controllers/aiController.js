// src/controllers/aiController.js
import axios from "axios";
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

// ----------- NEW: ffmpeg convert helper (any audio -> raw PCM s16le, 16k, mono) -----------
function runFfmpegConvertToPcm16kMono(inPath, outPath) {
  return new Promise((resolve, reject) => {
    // Output spec required by your AI team’s python test:
    // - 16000Hz
    // - mono
    // - 16-bit PCM
    // - RAW (no wav header): -f s16le
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
    // cleanup
    try {
      if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
    } catch {}
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch {}
  }
}

export default () => {
  const controller = {};

  // ============================
  // 1) STT — Upload ANY audio, backend converts to 16k mono PCM s16le raw
  // ============================
  controller.stt = async (req, res) => {
    console.log("\n================= [AI STT] Incoming Request =================");

    try {
      console.log("[AI STT] Request metadata:", {
        hasFile: !!req.file,
        fileFieldName: req.file?.fieldname,
        originalname: req.file?.originalname,
        mimetype: req.file?.mimetype,
        bodyKeys: Object.keys(req.body || {}),
        contentType: req.headers["content-type"],
      });

      // Allow either multipart file (req.file) or base64 payload (req.body.audioBase64)
      if (!req.file && req.body?.audioBase64) {
        const audioBase64 = req.body?.audioBase64;
        const fileName = req.body?.fileName || "audio.wav";

        if (!audioBase64) {
          console.error("[AI STT] ERROR: No audio file uploaded");
          return res
            .status(400)
            .json(
              errorResponse("BAD_REQ", "Audio file required (field name: audio)", 400)
            );
        }

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
          console.log("[AI STT] Received base64 audio", {
            bytes: buffer.length,
            fileName,
          });
        } catch (e) {
          console.error("[AI STT] ERROR decoding base64 audio", e);
          return res
            .status(400)
            .json(errorResponse("BAD_REQ", "Invalid base64 audio", 400));
        }
      }

      if (!req.file) {
        console.error("[AI STT] ERROR: No audio file uploaded (file or audioBase64 required)");
        return res
          .status(400)
          .json(errorResponse("BAD_REQ", "Audio file required (field name: audio)", 400));
      }

      // ✅ Decide whether to convert:
      const originalName = (req.file.originalname || "").toLowerCase();
      const isAlreadyRawPcm = originalName.endsWith(".pcm");

      let pcmBuffer;

      if (isAlreadyRawPcm) {
        // treat as already-correct raw pcm
        pcmBuffer = req.file.buffer;
        console.log("[AI STT] Input is .pcm, skipping conversion", {
          bytes: pcmBuffer.length,
          firstBytes: pcmBuffer.slice(0, 16).toString("hex"),
        });
      } else {
        console.log("[AI STT] Converting uploaded audio -> 16k mono PCM s16le raw via ffmpeg...");
        pcmBuffer = await convertUploadToPcm16kMono(req.file);

        console.log("[AI STT] Conversion done", {
          originalBytes: req.file.buffer.length,
          pcmBytes: pcmBuffer.length,
          firstBytes: pcmBuffer.slice(0, 16).toString("hex"),
        });
      }

      if (!pcmBuffer || pcmBuffer.length === 0) {
        console.error("[AI STT] ERROR: Converted PCM buffer is empty");
        return res
          .status(400)
          .json(errorResponse("BAD_REQ", "Converted PCM is empty", 400));
      }

      // ✅ Force the sampleRate to what your AI team expects
      const sampleRate = 16000;

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
    callAi("POST", "/api/conversation/reset", req.body || {}, "ConversationReset", res);

  controller.health = (_req, res) =>
    callAi("GET", "/health", null, "Health", res);

  // ============================
  // 4) Phrases — local static
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
