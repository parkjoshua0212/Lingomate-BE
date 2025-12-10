import axios from 'axios';

const AI_BASE_URL = process.env.AI_SERVICE_URL;

export async function sttViaAI(pcmBuffer, sampleRate = 16000) {
  console.log('[AI STT wrapper] Sending to AI server...', {
    url: `${AI_BASE_URL}/api/stt/recognize`,
    bytes: pcmBuffer.length,
    sampleRate,
  });

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

    console.log('[AI STT wrapper] AI server response:', response.data);

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
