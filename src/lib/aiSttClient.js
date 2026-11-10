// src/lib/aiSttClient.js
import axios from 'axios';

const AI_BASE_URL = process.env.AI_SERVICE_URL;

export async function sttViaAI(pcmBuffer, sampleRate = 16000) {
  try {
    const response = await axios.post(
      `${AI_BASE_URL}/api/stt/recognize`,
      pcmBuffer,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-sample-rate': sampleRate,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    return {
      transcript: response.data?.data?.transcript || '',
      altSegments: response.data?.data?.altSegments || [],
    };

  } catch (err) {
    console.error('[AI STT wrapper] ERROR calling AI STT:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });

    throw err;
  }
}
