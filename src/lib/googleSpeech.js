// src/lib/googleSpeech.js
import axios from 'axios';

const AI_BASE_URL = process.env.AI_SERVICE_URL;

if (!AI_BASE_URL) {
  console.warn('[AI STT wrapper] AI_SERVICE_URL is not set – STT calls will fail');
}

// base64Audio: pure base64 string (no header), sampleRate: optional number
export const transcribeAudio = async (base64Audio, sampleRateFromClient) => {
  if (!AI_BASE_URL) {
    throw new Error('AI_SERVICE_URL is not configured');
  }

  const sampleRate = Number.isInteger(sampleRateFromClient)
    ? sampleRateFromClient
    : 16000; // default; adjust if your AI team says otherwise

  const url = `${AI_BASE_URL}/api/stt/recognize`;

  console.log('[AI STT wrapper] sending audio to AI server', {
    url,
    base64Length: base64Audio.length,
    sampleRate,
  });

  try {
    const resp = await axios.post(
      url,
      {
        audio: base64Audio,
        sampleRate,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );

    console.log('[AI STT wrapper] AI server STT response:', {
      status: resp.status,
      data: resp.data,
    });

    const root = resp.data ?? {};
    const data = root.data ?? root;

    const transcript =
      data.transcript ??
      data.text ??
      data.result ??
      '';

    return transcript || '';
  } catch (err) {
    console.error('[AI STT wrapper] Error calling AI server STT:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });
    throw err;
  }
};

export default transcribeAudio;
