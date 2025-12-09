// src/lib/googleTTS.js
// Custom AI Server TTS proxy (replaces Google TTS)

import axios from 'axios';

const AI_BASE_URL = process.env.AI_SERVICE_URL; // e.g. http://lingomate-env...

if (!AI_BASE_URL) {
  console.warn('[AI TTS] Warning: AI_SERVICE_URL is not set – TTS requests will fail');
}

/**
 * synthesizeSpeech(text, accent, gender)
 * Calls your AI server's TTS endpoint and returns an audio Buffer
 */
export const synthesizeSpeech = async (text, accent = 'us', gender = 'female') => {
  try {
    const url = `${AI_BASE_URL}/api/ai/tts`;
    console.log('[AI TTS] Sending TTS request to:', url);

    const payload = { text, accent, gender };
    console.log('[AI TTS] Payload:', payload);

    const response = await axios.post(url, payload, {
      timeout: 15000,
      responseType: 'arraybuffer', // receive binary audio
    });

    console.log('[AI TTS] Received audio data length:', response.data?.length);

    // Return raw binary buffer
    return Buffer.from(response.data);
  } catch (error) {
    console.error('[AI TTS] TTS request failed:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw new Error('AI TTS service failed');
  }
};
