// src/lib/aiTtsClient.js
import axios from "axios";

const AI_BASE_URL = process.env.AI_SERVICE_URL;

export async function ttsViaAI(text, accent = "us", gender = "female") {
  const url = `${AI_BASE_URL}/api/ai/tts`;

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

    // Accept the audio field under any of the names the AI service has used
    const root = response.data ?? {};
    const data = root.data ?? root;

    const audio =
      data.audio ||
      data.audio_base64 ||
      data.audioBase64 ||
      data.ttsAudio ||
      data.tts_audio;

    if (!audio) {
      console.error("[AI TTS wrapper] ERROR: AI server returned no audio field", {
        keysOnRoot: Object.keys(root || {}),
        keysOnData: Object.keys(data || {}),
      });
      throw new Error("Missing audio in AI TTS response");
    }

    // Base64-encoded audio
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
