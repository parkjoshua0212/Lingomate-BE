// src/lib/aiTtsClient.js

import axios from "axios";

const AI_BASE_URL = process.env.AI_SERVICE_URL;

export async function ttsViaAI(text, accent = "us", gender = "female") {
  const url = `${AI_BASE_URL}/api/ai/tts`;

  console.log("[AI TTS wrapper] Sending request to AI TTS server:", {
    url,
    textPreview: text ? text.slice(0, 80) : null,
    accent,
    gender,
  });

  try {
    const response = await axios.post(
      url,
      { text, accent, gender },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 15000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    // 🔍 Log the full raw response (trimmed) so we can see the exact shape
    try {
      console.log(
        "[AI TTS wrapper] RAW AI server response:",
        JSON.stringify(response.data, null, 2).slice(0, 2000) // safety trim
      );
    } catch {
      console.log("[AI TTS wrapper] RAW AI server response (non-JSON):", response.data);
    }

    // 🧠 Be flexible about where audio lives
    const root = response.data ?? {};
    const data = root.data ?? root;

    const audio =
      data.audio ||
      data.audio_base64 ||
      data.audioBase64 ||
      data.ttsAudio ||
      data.tts_audio;

    console.log("[AI TTS wrapper] Parsed AI server response summary:", {
      status: response.status,
      hasAudio: !!audio,
      audioLength: audio?.length || 0,
      hasErrorField: !!root.error,
    });

    if (!audio) {
      console.error("[AI TTS wrapper] ERROR: AI server returned no audio field", {
        keysOnRoot: Object.keys(root || {}),
        keysOnData: Object.keys(data || {}),
      });
      throw new Error("Missing audio in AI TTS response");
    }

    // ✅ Return base64-encoded audio
    return audio;
  } catch (err) {
    console.error("[AI TTS wrapper] ERROR calling AI TTS:", {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      stack: err.stack,
    });

    throw err;
  }
}
