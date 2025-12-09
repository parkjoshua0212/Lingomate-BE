// src/controllers/aiController.js
import axios from 'axios';
import { successResponse, errorResponse } from '../utils/response.js';

// (Optional) Google Cloud wrappers – keep if you still use local STT/TTS
import { synthesizeSpeech } from '../lib/googleTTS.js';
import { transcribeAudio } from '../lib/googleSpeech.js';

const AI_BASE_URL = process.env.AI_SERVICE_URL; // e.g. http://lingomate-env...

if (!AI_BASE_URL) {
  console.warn('[AI] AI_SERVICE_URL is not set – AI HTTP calls will fail');
} else {
  console.log('[AI] aiController initialized with AI_SERVICE_URL =', AI_BASE_URL);
}

// Small helper to call AI and unwrap `{ success, data, ... }`
async function callAi(method, path, body, label, res) {
  const url = `${AI_BASE_URL}${path}`;

  // Avoid logging huge fields like full text/audio
  let logBody = body;
  if (body && typeof body === 'object') {
    logBody = { ...body };
    if (typeof body.text === 'string') {
      logBody.text = `${body.text.slice(0, 80)}${body.text.length > 80 ? '...' : ''}`;
    }
    if (body.audio) {
      logBody.audio = `<base64 audio, length=${String(body.audio).length}>`;
    }
  }

  console.log(`[AI ${label}] outgoing request`, {
    method,
    url,
    body: logBody,
  });

  try {
    const resp = await axios({
      method,
      url,
      data: body,
      timeout: 15000,
    });

    console.log(`[AI ${label}] response status:`, resp.status);
    console.log(`[AI ${label}] response data:`, JSON.stringify(resp.data, null, 2));

    // Most endpoints: resp.data.data is the useful payload
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
      .json(errorResponse('AI_ERR', `${label} Failed`, status));
  }
}

export default () => {
  const controller = {};

 // src/controllers/aiController.js  (only the stt part)

controller.stt = async (req, res) => {
  const { audio, sampleRate } = req.body || {};

  console.log('[AI STT] incoming request', {
    hasAudio: !!audio,
    audioType: typeof audio,
    audioLength: audio ? String(audio).length : 0,
  });

  if (!audio || typeof audio !== 'string') {
    console.warn('[AI STT] Missing or invalid audio in request body');
    return res
      .status(400)
      .json(errorResponse('BAD_REQ', 'Audio (base64 string) is required', 400));
  }

  // Strip "data:audio/...;base64," if present
  const base64String = audio.includes(',')
    ? audio.split(',')[1]
    : audio;

  // Simple validation: only base64 chars
  if (!/^[A-Za-z0-9+/=]+$/.test(base64String)) {
    console.warn('[AI STT] audio contains non-base64 characters');
    return res
      .status(400)
      .json(errorResponse('BAD_REQ', 'Invalid base64 audio string', 400));
  }

  console.log('[AI STT] cleaned base64 length:', base64String.length);

  try {
    // Pass base64 + optional sampleRate to AI server wrapper
    const text = await transcribeAudio(base64String, sampleRate);

    console.log('[AI STT] transcription result:', {
      textPreview: text ? text.slice(0, 80) : null,
    });

    return res.json(
      successResponse({
        text,
        confidence: 0.95,
      })
    );
  } catch (err) {
    console.error('[AI STT] Error while transcribing:', {
      message: err.message,
      stack: err.stack,
    });
    return res
      .status(500)
      .json(errorResponse('AI_ERR', 'STT Failed', 500));
  }
};


 

  // 2. Chat → AI /api/ai/chat
  controller.chat = async (req, res) => {
    const {
      text,
      userId,
      difficulty = 'medium',
      register = 'casual',
    } = req.body || {};

    console.log('[AI Chat] incoming request', {
      userId,
      difficulty,
      register,
      textPreview: text ? text.slice(0, 80) : null,
    });

    if (!text) {
      console.warn('[AI Chat] Missing text in request body');
      return res
        .status(400)
        .json(errorResponse('BAD_REQ', 'Text required', 400));
    }

    const payload = { text, userId, difficulty, register };
    return callAi('POST', '/api/ai/chat', payload, 'Chat', res);
  };

  // 3. Feedback → AI /api/ai/feedback
  controller.feedback = async (req, res) => {
    const { text } = req.body || {};
    console.log('[AI Feedback] incoming request', {
      textPreview: text ? text.slice(0, 80) : null,
    });

    if (!text) {
      console.warn('[AI Feedback] Missing text in request body');
      return res
        .status(400)
        .json(errorResponse('BAD_REQ', 'Text required', 400));
    }

    return callAi('POST', '/api/ai/feedback', { text }, 'Feedback', res);
  };

  // 4. TTS – OPTION A: local Google (your current behavior)
  // aiController.js

controller.tts = async (req, res) => {
  const { text, accent = 'us', gender = 'female' } = req.body || {};

  console.log('[AI TTS] incoming request', {
    accent,
    gender,
    textPreview: text ? text.slice(0, 80) : null,
  });

  if (!text) {
    console.warn('[AI TTS] Missing text in request body');
    return res
      .status(400)
      .json(errorResponse('BAD_REQ', 'Text required', 400));
  }

  try {
    console.log('[AI TTS] calling synthesizeSpeech', {
      accent,
      gender,
    });

    // ✅ send "male" / "female" directly
    const audioBuffer = await synthesizeSpeech(text, accent, gender);

    console.log('[AI TTS] synthesizeSpeech success', {
      audioBufferLength: audioBuffer?.length,
    });

    return res.json(
      successResponse({
        audio: audioBuffer.toString('base64'),
        mime: 'audio/wav',
      })
    );
  } catch (err) {
    console.error('[AI TTS] Error while synthesizing speech:', {
      message: err.message,
      stack: err.stack,
    });
    return res
      .status(500)
      .json(errorResponse('AI_ERR', 'TTS Failed', 500));
  }
};


  // 4B. (Alternative) If you want to use AI server TTS instead of Google:
  // controller.tts = async (req, res) =>
  //   callAi('POST', '/api/ai/tts', req.body || {}, 'TTS', res);

  // 5. Example reply → AI /api/ai/example-reply
  controller.exampleReply = async (req, res) => {
    const { ai_text, userId } = req.body || {};
    console.log('[AI ExampleReply] incoming request', {
      userId,
      aiTextPreview: ai_text ? ai_text.slice(0, 80) : null,
    });

    if (!ai_text) {
      console.warn('[AI ExampleReply] Missing ai_text in request body');
      return res.status(400).json(
        errorResponse(
          'BAD_REQ',
          'ai_text (AI sentence) is required',
          400
        )
      );
    }
    const payload = { ai_text, userId };
    return callAi('POST', '/api/ai/example-reply', payload, 'ExampleReply', res);
  };

  // 6. Review → AI /api/ai/review
  controller.review = async (req, res) => {
    console.log('[AI Review] incoming request body keys:', Object.keys(req.body || {}));
    // Body shape depends on AI spec; we just proxy whatever frontend sends
    return callAi('POST', '/api/ai/review', req.body || {}, 'Review', res);
  };

  // 7. Accuracy stats → AI /api/stats/accuracy
  controller.getAccuracy = async (_req, res) => {
    console.log('[AI Accuracy] incoming request');
    return callAi('GET', '/api/stats/accuracy', null, 'Accuracy', res);
  };

  // 8. Conversation history → AI /api/conversation/history
  controller.getConversationHistory = async (req, res) => {
    const userId = req.query.userId;
    const path = userId
      ? `/api/conversation/history?userId=${encodeURIComponent(userId)}`
      : '/api/conversation/history';

    console.log('[AI ConversationHistory] incoming request', {
      userId,
      path,
    });

    return callAi('GET', path, null, 'ConversationHistory', res);
  };

  // 9. Reset conversation → AI /api/conversation/reset
  controller.resetConversation = async (req, res) => {
    console.log('[AI ConversationReset] incoming request body keys:', Object.keys(req.body || {}));
    return callAi(
      'POST',
      '/api/conversation/reset',
      req.body || {},
      'ConversationReset',
      res
    );
  };

  // 10. Health check passthrough → AI /health
  controller.health = async (_req, res) => {
    console.log('[AI Health] incoming request');
    return callAi('GET', '/health', null, 'Health', res);
  };

  // 11. Extra: fixed phrases – purely local, optional
  controller.getPhrases = async (_req, res) => {
    console.log('[AI Phrases] returning static phrases');
    const phrases = [
      { id: 1, en: 'Way to go.', kr: '잘했어' },
      { id: 2, en: 'Time flies.', kr: '시간 빠르다' },
    ];
    return res.json(successResponse(phrases));
  };

  // ⚠️ Dictionary removed – AI server doesn’t implement it.
  // If you keep an /api/ai/dictionary route in your router, delete it
  // or implement your own dictionary logic.

  return controller;
};
