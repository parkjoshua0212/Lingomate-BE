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

  // ==================== AUTH ROUTES ====================
  router.get('/auth/me', checkJwt, auth.getMe);
  router.post('/auth/register-if-needed', checkJwt, auth.syncUser);

  // ==================== USER ROUTES ====================
  router.get('/user/profile', checkJwt, user.getProfile);
  router.put('/user/profile', checkJwt, user.updateProfile);

  // ==================== SPEAK MODE (PRISMA SESSIONS) ====================
  router.post('/conversation/start', checkJwt, conv.startSession);
  router.post('/conversation/finish', checkJwt, conv.finishSession);

  // ==================== AI MICRO-SERVICE CHAT MODE (conv.*) ====================
  router.post('/conversation/reset', checkJwt, conv.reset);
  router.get('/conversation/history', checkJwt, conv.getHistory);

  // Single speak-mode session (numeric ID only)
  router.get('/conversation/:sessionId', checkJwt, conv.getSession);
  router.delete('/conversation/delete', checkJwt, conv.deleteSession);

  // ==================== AI MAIN ROUTES ====================
  router.post('/ai/stt', checkJwt, ai.stt);
  router.post('/ai/chat', checkJwt, ai.chat);
  router.post('/ai/feedback', checkJwt, ai.feedback);
  router.post('/ai/tts', checkJwt, ai.tts);
  router.post('/ai/example-reply', checkJwt, ai.exampleReply);
  router.post('/ai/review', checkJwt, ai.review);
  router.get('/ai/stats/accuracy', checkJwt, ai.getAccuracy);
  router.get('/ai/conversation/history', checkJwt, ai.getConversationHistory);
  router.post('/ai/conversation/reset', checkJwt, ai.resetConversation);

  // ==================== PHRASES ROUTE ====================
  router.get('/phrases', ai.getPhrases);

  // ==================== USER SETTINGS ====================
  router.get('/conversation/settings', checkJwt, user.getSettings);
  router.put('/conversation/settings', checkJwt, user.updateSettings);

  // ==================== STATS ====================
  router.get('/stats', checkJwt, stats.getStats);
  router.get('/dashboard', checkJwt, user.getDashboard);

  // ==================== NOTIFICATIONS ====================
  router.get('/notifications/settings', checkJwt, (req, res) =>
    res.json({ success: true, data: { enabled: true } })
  );
  router.put('/notifications/settings', checkJwt, (req, res) =>
    res.json({ success: true, data: req.body })
  );

  return router;
};
