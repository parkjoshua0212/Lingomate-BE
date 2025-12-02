import express from 'express';
import { auth as checkJwtMiddleware } from 'express-oauth2-jwt-bearer';

import authController from '../controllers/authController.js';
import userController from '../controllers/usersController.js';
import conversationController from '../controllers/convController.js';
import aiController from '../controllers/aiController.js';
import subscriptionController from '../controllers/subscriptionController.js';
import statsController from '../controllers/statsController.js';

const router = express.Router();

// Use env so dev/prod can change without code edits
const auth0Audience = process.env.AUTH0_AUDIENCE || 'https://api.lingomate.com';
const auth0Domain = process.env.AUTH0_DOMAIN || 'dev-rc5gsyjk5pfptk72.us.auth0.com';

const checkJwt = checkJwtMiddleware({
  audience: process.env.AUTH0_AUDIENCE, 
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: "RS256",
});

// Export factory so we can inject wss from server.js
export default (wss) => {
  const auth = authController();
  const user = userController();
  const conv = conversationController(wss);
  const ai = aiController();
  const sub = subscriptionController();
  const stats = statsController();

  // === AUTH ROUTES ===

  /**
   * @swagger
   * /api/auth/me:
   *   get:
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     summary: Get current authenticated user info
   */
  router.get('/auth/me', checkJwt, auth.getMe);

  /**
   * @swagger
   * /api/auth/register-if-needed:
   *   post:
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     summary: Sync Auth0 user into internal DB if not exists
   */
  router.post('/auth/register-if-needed', checkJwt, auth.syncUser);

  // === USER PROFILE ROUTES ===

  /**
   * @swagger
   * /api/user/profile:
   *   get:
   *     tags: [User]
   *     security:
   *       - bearerAuth: []
   *     summary: Get user profile + subscription + streak
   */
  router.get('/user/profile', checkJwt, user.getProfile);

  /**
   * @swagger
   * /api/user/profile:
   *   put:
   *     tags: [User]
   *     security:
   *       - bearerAuth: []
   *     summary: Update user profile
   */
  router.put('/user/profile', checkJwt, user.updateProfile);

  // === CONVERSATION ROUTES ===

  /**
   * @swagger
   * /api/conversation/start:
   *   post:
   *     tags: [Conversation]
   *     security:
   *       - bearerAuth: []
   *     summary: Start a new conversation session
   */
  router.post('/conversation/start', checkJwt, conv.startSession);

  /**
   * @swagger
   * /api/conversation/finish:
   *   post:
   *     tags: [Conversation]
   *     security:
   *       - bearerAuth: []
   *     summary: Finish a conversation and upload full script
   */
  router.post('/conversation/finish', checkJwt, conv.finishSession);

  /**
   * @swagger
   * /api/conversation/history:
   *   get:
   *     tags: [Conversation]
   *     security:
   *       - bearerAuth: []
   *     summary: Get paginated list of finished conversations
   */
  router.get('/conversation/history', checkJwt, conv.getHistory);

  /**
   * @swagger
   * /api/conversation/{sessionId}:
   *   get:
   *     tags: [Conversation]
   *     security:
   *       - bearerAuth: []
   *     summary: Get a specific conversation by ID
   */
  router.get('/conversation/:sessionId', checkJwt, conv.getSession);

  /**
   * @swagger
   * /api/conversation/delete:
   *   delete:
   *     tags: [Conversation]
   *     security:
   *       - bearerAuth: []
   *     summary: Delete a conversation or all conversations
   */
  router.delete('/conversation/delete', checkJwt, conv.deleteSession);

  /**
 * @swagger
 * /api/conversation/reset:
 *   post:
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     summary: Reset user's AI conversation state (history, topic, accuracy)
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "u_123"
 *                 description: Optional. Defaults to "anonymous".
 *     responses:
 *       200:
 *         description: Conversation reset successful
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 userId: "u_123"
 */
router.post('/conversation/reset', checkJwt, conv.reset);


/**
 * @swagger
 * /api/conversation/history:
 *   get:
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     summary: Get full AI conversation history for a specific user
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: false
 *         description: If omitted, defaults to "anonymous".
 *         example: "u_123"
 *     responses:
 *       200:
 *         description: Returns full CHAT_HISTORY stored in AI microservice
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 userId: "u_123"
 *                 history:
 *                   - user: "I very like play soccer."
 *                     corrected_en: "I really like playing soccer."
 *                     feedback: "like 뒤에는 동명사 ~ing 형태를 쓰는 것이 자연스럽습니다..."
 *                     reply_en: "Nice! How often do you play soccer?"
 */
router.get('/conversation/history', checkJwt, conv.getHistory);


  // === SUBSCRIPTION ROUTES ===

  /**
   * @swagger
   * /api/subscription/options:
   *   get:
   *     tags: [Subscription]
   *     summary: Get available subscription options
   */
  router.get('/subscription/options', sub.getOptions);

  /**
   * @swagger
   * /api/subscription/subscribe:
   *   post:
   *     tags: [Subscription]
   *     security:
   *       - bearerAuth: []
   *     summary: Start or change subscription
   */
  router.post('/subscription/subscribe', checkJwt, sub.subscribe);

  /**
   * @swagger
   * /api/subscription/cancel:
   *   post:
   *     tags: [Subscription]
   *     security:
   *       - bearerAuth: []
   *     summary: Cancel subscription
   */
  router.post('/subscription/cancel', checkJwt, sub.cancel);

  // === AI ROUTES ===

  /**
 * @swagger
 * /api/ai/stt:
 *   post:
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     summary: Speech to text (audio → text)
 */
router.post('/ai/stt', checkJwt, ai.stt);

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     summary: Main AI conversation endpoint (English correction + feedback + reply)
 */
router.post('/ai/chat', checkJwt, ai.chat);

/**
 * @swagger
 * /api/ai/feedback:
 *   post:
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     summary: Sentence-level correction & explanation (without affecting stats)
 */
router.post('/ai/feedback', checkJwt, ai.feedback);

/**
 * @swagger
 * /api/ai/tts:
 *   post:
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     summary: Convert text to speech (WAV base64)
 */
router.post('/ai/tts', checkJwt, ai.tts);

/**
 * @swagger
 * /api/ai/example-reply:
 *   post:
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     summary: Generate a learner’s example reply based on AI message + user history
 */
router.post('/ai/example-reply', checkJwt, ai.exampleReply);

/**
 * @swagger
 * /api/ai/dictionary:
 *   post:
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     summary: Explain an English word/phrase with Korean meaning + usage examples
 */
router.post('/ai/dictionary', checkJwt, ai.dictionary);

  // === PHRASES ROUTE ===

/**
 * @swagger
 * /api/phrases:
 *   get:
 *     tags: [Phrases]
 *     summary: Get default memorization phrases
 */
router.get('/phrases', ai.getPhrases);
  // === CONVERSATION SETTINGS ROUTES ===

  /**
   * @swagger
   * /api/conversation/settings:
   *   get:
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     summary: Get conversation settings
   */
  router.get('/conversation/settings', checkJwt, user.getSettings);

  /**
   * @swagger
   * /api/conversation/settings:
   *   put:
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     summary: Update conversation settings
   */
  router.put('/conversation/settings', checkJwt, user.updateSettings);

  // === STATS ROUTES ===

  /**
   * @swagger
   * /api/stats:
   *   get:
   *     tags: [Stats]
   *     security:
   *       - bearerAuth: []
   *     summary: Get learning statistics
   */
  router.get('/stats', checkJwt, stats.getStats);

  /**
   * @swagger
   * /api/dashboard:
   *   get:
   *     tags: [Stats]
   *     security:
   *       - bearerAuth: []
   *     summary: Legacy dashboard endpoint (same as profile)
   */
  router.get('/dashboard', checkJwt, user.getDashboard);

  // === NOTIFICATION ROUTES ===

  /**
   * @swagger
   * /api/notifications/settings:
   *   get:
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     summary: Get notification settings
   */
  router.get('/notifications/settings', checkJwt, (req, res) =>
    res.json({ success: true, data: { enabled: true } })
  );

  /**
   * @swagger
   * /api/notifications/settings:
   *   put:
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     summary: Update notification settings
   */
  router.put('/notifications/settings', checkJwt, (req, res) =>
    res.json({ success: true, data: req.body })
  );

  return router;
};
