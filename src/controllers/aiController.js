import axios from 'axios';
import { successResponse, errorResponse } from '../utils/response.js';

// Google Cloud wrappers
import { synthesizeSpeech } from '../lib/googleTTS.js';
import { transcribeAudio } from '../lib/googleSpeech.js';

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export default () => {
    const controller = {};

    /**
     * 1. STT (Speech to Text)
     * POST /api/ai/stt
     * Body: { audio: "<base64-encoded-audio>" }
     */
    controller.stt = async (req, res) => {
        const { audio } = req.body;
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
                    // TODO: if your Google wrapper returns confidence, pass it here
                    confidence: 0.95
                })
            );
        } catch (err) {
            console.error('STT Error:', err);
            return res
                .status(500)
                .json(errorResponse('AI_ERR', 'STT Failed'));
        }
    };

    /**
     * 3. AI 텍스트 응답 (메인 대화)
     * POST /api/ai/chat
     *
     * Request (ChatRequest):
     * {
     *   text: string,                // required
     *   userId?: string,             // optional
     *   difficulty?: "easy"|"medium"|"hard" (default "medium")
     *   register?: "casual"|"formal" (default "casual")
     * }
     *
     * Response:
     * {
     *   success: true,
     *   data: { text: "<AI reply sentence in English>" }
     * }
     *
     * NOTE: All history / topic / accuracy updates are handled inside AI service.
     */
    controller.chat = async (req, res) => {
        const {
            text,
            userId,
            difficulty = 'medium',
            register = 'casual'
        } = req.body || {};

        if (!text) {
            return res
                .status(400)
                .json(errorResponse('BAD_REQ', 'Text required', 400));
        }

        try {
            const payload = { text, userId, difficulty, register };
            const { data } = await axios.post(`${AI_URL}/chat`, payload);

            // AI service may return { text } or { reply_en }
            const replyText = data.text || data.reply_en;

            return res.json(
                successResponse({
                    text: replyText
                })
            );
        } catch (err) {
            console.error('Chat Error:', err?.response?.data || err);
            return res
                .status(500)
                .json(errorResponse('AI_ERR', 'AI Service Failed'));
        }
    };

    /**
     * 4. 문장 교정 + 이유 보기
     * POST /api/ai/feedback
     *
     * Request (FeedbackRequest):
     * {
     *   text: string   // required
     * }
     *
     * Response when correction needed:
     * {
     *   success: true,
     *   data: {
     *     natural: false,
     *     corrected_en: "...",
     *     reason_ko: "..."
     *   }
     * }
     *
     * Response when already natural:
     * {
     *   success: true,
     *   data: {
     *     natural: true,
     *     message: "자연스러운 문장이에요!"
     *   }
     * }
     *
     * (Does NOT affect accuracy statistics.)
     */
    controller.feedback = async (req, res) => {
        const { text } = req.body || {};
        if (!text) {
            return res
                .status(400)
                .json(errorResponse('BAD_REQ', 'Text required', 400));
        }

        try {
            const { data } = await axios.post(`${AI_URL}/feedback`, { text });

            // data is expected to be the inner object with natural / corrected_en / reason_ko / message
            return res.json(successResponse(data));
        } catch (err) {
            console.error('Feedback Error:', err?.response?.data || err);
            return res
                .status(500)
                .json(errorResponse('AI_ERR', 'Feedback Failed'));
        }
    };

    /**
     * 5. TTS (텍스트 → 음성)
     * POST /api/ai/tts
     *
     * Request (TTSRequest):
     * {
     *   text: string,                       // required
     *   accent?: "us"|"uk"|"au",            // optional, default "us"
     *   gender?: "male"|"female"            // optional, default "female"
     * }
     *
     * Response:
     * {
     *   success: true,
     *   data: {
     *     audio: "<base64-encoded-wav>",
     *     mime: "audio/wav"
     *   }
     * }
     */
    controller.tts = async (req, res) => {
        const {
            text,
            accent = 'us',
            gender = 'female'
        } = req.body || {};

        if (!text) {
            return res
                .status(400)
                .json(errorResponse('BAD_REQ', 'Text required', 400));
        }

        try {
            // Convert gender to short code if your TTS lib needs it
            const genderShort = gender === 'male' ? 'm' : 'f';

            // NOTE: adjust synthesizeSpeech signature in googleTTS.js if needed
            const audioBuffer = await synthesizeSpeech(text, accent, genderShort);

            return res.json(
                successResponse({
                    audio: audioBuffer.toString('base64'),
                    mime: 'audio/wav'
                })
            );
        } catch (err) {
            console.error('TTS Error:', err);
            return res
                .status(500)
                .json(errorResponse('AI_ERR', 'TTS Failed'));
        }
    };

    /**
     * 6. 사용자 예시 응답 생성
     * POST /api/ai/example-reply
     *
     * Request (ExampleReplyRequest):
     * {
     *   ai_text: string,     // required (AI just said this)
     *   userId: string       // required (for history lookup)
     * }
     *
     * Response:
     * {
     *   success: true,
     *   data: {
     *     reply_example: "I usually play soccer twice a week."
     *   }
     * }
     */
    controller.exampleReply = async (req, res) => {
        const { ai_text, userId } = req.body || {};

        if (!ai_text) {
            return res
                .status(400)
                .json(
                    errorResponse(
                        'BAD_REQ',
                        'ai_text (AI sentence) is required',
                        400
                    )
                );
        }

        try {
            const payload = { ai_text, userId };
            const { data } = await axios.post(
                `${AI_URL}/example-reply`,
                payload
            );

            // data.reply_example is expected from AI service
            return res.json(
                successResponse({
                    reply_example: data.reply_example
                })
            );
        } catch (err) {
            console.error('ExampleReply Error:', err?.response?.data || err);
            return res
                .status(500)
                .json(errorResponse('AI_ERR', 'Example Reply Failed'));
        }
    };

    /**
     * 7. 단어/숙어 사전 설명
     * POST /api/ai/dictionary
     *
     * Request (DictionaryEntryRequest):
     * {
     *   term: string   // required
     * }
     *
     * Response:
     * {
     *   success: true,
     *   data: {
     *     term: "break the ice",
     *     meaning_ko: "...",
     *     examples: ["...", "..."]
     *   }
     * }
     */
    controller.dictionary = async (req, res) => {
        const { term } = req.body || {};
        if (!term) {
            return res
                .status(400)
                .json(errorResponse('BAD_REQ', 'term is required', 400));
        }

        try {
            const { data } = await axios.post(`${AI_URL}/dictionary`, { term });

            return res.json(
                successResponse({
                    term: data.term,
                    meaning_ko: data.meaning_ko,
                    examples: data.examples
                })
            );
        } catch (err) {
            console.error('Dictionary Error:', err?.response?.data || err);
            return res
                .status(500)
                .json(errorResponse('AI_ERR', 'Dictionary Failed'));
        }
    };

    /**
     * Extra: fixed phrases (unchanged)
     * GET /api/ai/phrases  (assuming route)
     */
    controller.getPhrases = async (_req, res) => {
        const phrases = [
            { id: 1, en: 'Way to go.', kr: '잘했어' },
            { id: 2, en: 'Time flies.', kr: '시간 빠르다' }
        ];
        return res.json(successResponse(phrases));
    };

    return controller;
};
