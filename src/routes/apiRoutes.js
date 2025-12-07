import express from 'express';
import { auth as checkJwtMiddleware } from 'express-oauth2-jwt-bearer';

import authController from '../controllers/authController.js';
import userController from '../controllers/usersController.js';
import conversationController from '../controllers/convController.js';
import aiController from '../controllers/aiController.js';
import subscriptionController from '../controllers/subscriptionController.js';
import statsController from '../controllers/statsController.js';

const router = express.Router();

const checkJwt = checkJwtMiddleware({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: "RS256",
});

// Inject WebSocket
export default (wss) => {
  const auth = authController();
  const user = userController();
  const conv = conversationController(wss);
  const ai = aiController();
  const sub = subscriptionController();
  const stats = statsController();

  // ================================================================
  // AUTH ROUTES
  // ================================================================

  /**
   * @swagger
   * /api/auth/me:
   *   get:
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     summary: Get authenticated user profile
   *     responses:
   *       200:
   *         description: User details returned
   */
  router.get('/auth/me', checkJwt, auth.getMe);

  /**
   * @swagger
   * /api/auth/register-if-needed:
   *   post:
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     summary: Register Auth0 user in DB if not already registered
   *     responses:
   *       200:
   *         description: User synced successfully
   */
  router.post('/auth/register-if-needed', checkJwt, auth.syncUser);

  // ================================================================
  // USER ROUTES
  // ================================================================

  /**
   * @swagger
   * /api/user/profile:
   *   get:
   *     tags: [User]
   *     security:
   *       - bearerAuth: []
   *     summary: Get full user profile
   */
  router.get('/user/profile', checkJwt, user.getProfile);

  /**
   * @swagger
   * /api/user/profile:
   *   put:
   *     tags: [User]
   *     security:
   *       - bearerAuth: []
   *     summary: Update user preferences (style, gender, country)
   */
  router.put('/user/profile', checkJwt, user.updateProfile);

  // ================================================================
  // SPEAK MODE (PRISMA SESSIONS)
  // ================================================================

  /**
   * @swagger
   * /api/conversation/start:
   *   post:
   *     tags: [SpeakMode]
   *     security:
   *       - bearerAuth: []
   *     summary: Start a new Speak Mode conversation session
   */
  router.post('/conversation/start', checkJwt, conv.startSession);

  /**
   * @swagger
   * /api/conversation/finish:
   *   post:
   *     tags: [SpeakMode]
   *     security:
   *       - bearerAuth: []
   *     summary: Finish session & upload full script to database
   */
  router.post('/conversation/finish', checkJwt, conv.finishSession);

  /**
   * @swagger
   * /api/conversation/{sessionId}:
   *   get:
   *     tags: [SpeakMode]
   *     security:
   *       - bearerAuth: []
   *     summary: Retrieve one finished Speak Mode session
   */
  router.get('/conversation/:sessionId', checkJwt, conv.getSession);

  /**
   * @swagger
   * /api/conversation/delete:
   *   delete:
   *     tags: [SpeakMode]
   *     security:
   *       - bearerAuth: []
   *     summary: Delete one or all Speak Mode sessions
   */
  router.delete('/conversation/delete', checkJwt, conv.deleteSession);

  // ================================================================
  // AI MICRO-SERVICE CHAT MODE ROUTES
  // ================================================================

  /**
   * @swagger
   * /api/conversation/reset:
   *   post:
   *     tags: [AI Chat]
   *     security:
   *       - bearerAuth: []
   *     summary: Reset AI conversation state (history, accuracy, topic)
   */
  router.post('/conversation/reset', checkJwt, conv.reset);

  /**
   * @swagger
   * /api/conversation/history:
   *   get:
   *     tags: [AI Chat]
   *     security:
   *       - bearerAuth: []
   *     summary: Get full AI Chat history for the user
   */
  router.get('/conversation/history', checkJwt, conv.getHistory);

  // ================================================================
  // AI MAIN ROUTES  (proxy to AI microservice)
  // ================================================================

  /**
   * @swagger
   * /api/ai/stt:
   *   post:
   *     tags: [AI]
   *     security:
   *       - bearerAuth: []
   *     summary: Convert speech (base64 audio) to text using Google STT
   */
  router.post('/ai/stt', checkJwt, ai.stt);

  /**
   * @swagger
   * /api/ai/chat:
   *   post:
   *     tags: [AI]
   *     security:
   *       - bearerAuth: []
   *     summary: Main AI chat endpoint (grammar + reply + history update)
   */
  router.post('/ai/chat', checkJwt, ai.chat);

  /**
   * @swagger
   * /api/ai/feedback:
   *   post:
   *     tags: [AI]
   *     security:
   *       - bearerAuth: []
   *     summary: Grammar correction + explanation only (no history update)
   */
  router.post('/ai/feedback', checkJwt, ai.feedback);

  /**
   * @swagger
   * /api/ai/tts:
   *   post:
   *     tags: [AI]
   *     security:
   *       - bearerAuth: []
   *     summary: Text to speech (returns base64 WAV audio)
   */
  router.post('/ai/tts', checkJwt, ai.tts);

  /**
   * @swagger
   * /api/ai/example-reply:
   *   post:
   *     tags: [AI]
   *     security:
   *       - bearerAuth: []
   *     summary: Generate an example sentence the student could reply with
   */
  router.post('/ai/example-reply', checkJwt, ai.exampleReply);

  /**
   * @swagger
   * /api/ai/review:
   *   post:
   *     tags: [AI]
   *     security:
   *       - bearerAuth: []
   *     summary: Get overall speaking review / accuracy summary from AI
   */
  router.post('/ai/review', checkJwt, ai.review);

  /**
   * @swagger
   * /api/ai/stats/accuracy:
   *   get:
   *     tags: [AI]
   *     security:
   *       - bearerAuth: []
   *     summary: Get AI accuracy statistics from microservice
   */
  router.get('/ai/stats/accuracy', checkJwt, ai.getAccuracy);

  /**
   * @swagger
   * /api/ai/conversation/history:
   *   get:
   *     tags: [AI Chat]
   *     security:
   *       - bearerAuth: []
   *     summary: Get AI conversation history (from AI microservice)
   */
  router.get('/ai/conversation/history', checkJwt, ai.getConversationHistory);

  /**
   * @swagger
   * /api/ai/conversation/reset:
   *   post:
   *     tags: [AI Chat]
   *     security:
   *       - bearerAuth: []
   *     summary: Reset AI conversation state (history, topic, etc.)
   */
  router.post('/ai/conversation/reset', checkJwt, ai.resetConversation);

  // ================================================================
  // PHRASES ROUTE (local helper, not from AI microservice)
  // ================================================================
  /**
   * @swagger
   * /api/phrases:
   *   get:
   *     tags: [Phrases]
   *     summary: Get memorization phrase list (local, not AI)
   */
  router.get('/phrases', ai.getPhrases);


  // ================================================================
  // PHRASES ROUTE
  // ================================================================
  /**
   * @swagger
   * /api/phrases:
   *   get:
   *     tags: [Phrases]
   *     summary: Get memorization phrase list
   */
  router.get('/phrases', ai.getPhrases);

  // ================================================================
  // USER SETTINGS
  // ================================================================
  /**
   * @swagger
   * /api/conversation/settings:
   *   get:
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     summary: Get user conversation settings
   */
  router.get('/conversation/settings', checkJwt, user.getSettings);

  /**
   * @swagger
   * /api/conversation/settings:
   *   put:
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     summary: Update user conversation settings
   */
  router.put('/conversation/settings', checkJwt, user.updateSettings);

  // ================================================================
  // STATS
  // ================================================================
  /**
   * @swagger
   * /api/stats:
   *   get:
   *     tags: [Stats]
   *     security:
   *       - bearerAuth: []
   *     summary: Get learning stats
   */
  router.get('/stats', checkJwt, stats.getStats);

  /**
   * @swagger
   * /api/dashboard:
   *   get:
   *     tags: [Stats]
   *     security:
   *       - bearerAuth: []
   *     summary: (Legacy) Dashboard summary
   */
  router.get('/dashboard', checkJwt, user.getDashboard);

  // ================================================================
  // NOTIFICATIONS
  // ================================================================
  /**
   * @swagger
   * /api/notifications/settings:
   *   get:
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     summary: Get notification preferences
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
   *     summary: Update notification preferences
   */
  router.put('/notifications/settings', checkJwt, (req, res) =>
    res.json({ success: true, data: req.body })
  );

  return router;
};
