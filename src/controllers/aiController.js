// src/controllers/aiController.js
import axios from 'axios';
import { successResponse, errorResponse } from '../utils/response.js';

// (Optional) Google Cloud wrappers – keep if you still use local STT/TTS
import { synthesizeSpeech } from '../lib/googleTTS.js';
import { transcribeAudio } from '../lib/googleSpeech.js';

const AI_BASE_URL = process.env.AI_SERVICE_URL; // e.g. http://lingomate-env...
if (!AI_BASE_URL) {
  console.warn('[AI] AI_SERVICE_URL is not set – AI HTTP calls will fail');
}

// Small helper to call AI and unwrap `{ success, data, ... }`
async function callAi(method, path, body, label, res) {
  try {
    const resp = await axios({
      method,
      url: `${AI_BASE_URL}${path}`,
      data: body,
      timeout: 15000,
    });

    console.log(`[AI ${label}] response:`, JSON.stringify(resp.data, null, 2));

    // Most endpoints: resp.data.data is the useful payload
    const payload = resp.data?.data ?? resp.data;
    return res.json(successResponse(payload));
  } catch (err) {
    const status = err?.response?.status || 500;
    console.error(
      `[AI ${label} Error]`,
      err?.response?.data || err.message || err
    );
    return res
      .status(status)
      .json(errorResponse('AI_ERR', `${label} Failed`, status));
  }
}

export default () => {
  const controller = {};

  // 1. (OPTIONAL) Local STT with Google – not part of AI Swagger
  controller.stt = async (req, res) => {
    const { audio } = req.body || {};
    if (!audio) {
      return res
        .status(400)
        .json(errorResponse('BAD_REQ', 'Audio data required', 400));
    }

    try {
      const audioBuffer = Buffer.from(audio, 'base64');
      const text = await transcribeAudio(audioBuffer);

      return res.json(
        successResponse({
          text,
          confidence: 0.95,
        })
      );
    } catch (err) {
      console.error('STT Error:', err);
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

    if (!text) {
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
    if (!text) {
      return res
        .status(400)
        .json(errorResponse('BAD_REQ', 'Text required', 400));
    }

    return callAi('POST', '/api/ai/feedback', { text }, 'Feedback', res);
  };

  // 4. TTS – OPTION A: local Google (your current behavior)
  controller.tts = async (req, res) => {
    const { text, accent = 'us', gender = 'female' } = req.body || {};
    if (!text) {
      return res
        .status(400)
        .json(errorResponse('BAD_REQ', 'Text required', 400));
    }

    try {
      const genderShort = gender === 'male' ? 'm' : 'f';
      const audioBuffer = await synthesizeSpeech(text, accent, genderShort);

      return res.json(
        successResponse({
          audio: audioBuffer.toString('base64'),
          mime: 'audio/wav',
        })
      );
    } catch (err) {
      console.error('TTS Error:', err);
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
    if (!ai_text) {
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
    // Body shape depends on AI spec; we just proxy whatever frontend sends
    return callAi('POST', '/api/ai/review', req.body || {}, 'Review', res);
  };

  // 7. Accuracy stats → AI /api/stats/accuracy
  controller.getAccuracy = async (_req, res) => {
    return callAi('GET', '/api/stats/accuracy', null, 'Accuracy', res);
  };

  // 8. Conversation history → AI /api/conversation/history
  controller.getConversationHistory = async (req, res) => {
    // If AI expects userId as query param, forward it:
    const userId = req.query.userId;
    const path = userId
      ? `/api/conversation/history?userId=${encodeURIComponent(userId)}`
      : '/api/conversation/history';

    return callAi('GET', path, null, 'ConversationHistory', res);
  };

  // 9. Reset conversation → AI /api/conversation/reset
  controller.resetConversation = async (req, res) => {
    // Body (if any) depends on AI spec; often userId
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
    return callAi('GET', '/health', null, 'Health', res);
  };

  // 11. Extra: fixed phrases – purely local, optional
  controller.getPhrases = async (_req, res) => {
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
// check if prisma needs to be used in getConversationHistory