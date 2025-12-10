// src/routes/apiRoutes.js
import express from 'express';
import { auth as checkJwtMiddleware } from 'express-oauth2-jwt-bearer';
import multer from "multer";

import authController from '../controllers/authController.js';
import userController from '../controllers/usersController.js';
import conversationController from '../controllers/convController.js';
import aiController from '../controllers/aiController.js';
import subscriptionController from '../controllers/subscriptionController.js';
import statsController from '../controllers/statsController.js';
import homeController from '../controllers/home.controller.js';




// ==================== SETUP ====================

const router = express.Router();

// Multer for PCM audio uploads (limit 5MB)
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
});

const checkJwt = checkJwtMiddleware({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: "RS256",
});

// ==================== CONTROLLERS ====================

export default (wss) => {
  const auth = authController();
  const user = userController();
  const conv = conversationController(wss);
  const ai = aiController();
  const sub = subscriptionController();
  const stats = statsController();
  const home = homeController();   // IMPORTANT: use this instance

  console.log("DEBUG: homeController import =", homeController);
  console.log("DEBUG: home instance =", home);

  // ==================== AUTH ROUTES ====================
  router.get('/auth/me', checkJwt, auth.getMe);
  router.post('/auth/register-if-needed', checkJwt, auth.syncUser);

  // ==================== USER ROUTES ====================
  router.get('/user/profile', checkJwt, user.getProfile);
  router.put('/user/profile', checkJwt, user.updateProfile);

  // ==================== SPEAK MODE (PRISMA SESSIONS) ====================
  router.post('/conversation/start', checkJwt, conv.startSession);
  router.post('/conversation/finish', checkJwt, conv.finishSession);

  // ==================== AI MICRO-SERVICE CONVERSATION ROUTES ====================
  router.post('/conversation/reset', checkJwt, conv.reset);
  router.get('/conversation/history', checkJwt, conv.getHistory);

  router.get('/conversation/:sessionId', checkJwt, conv.getSession);
  router.delete('/conversation/delete', checkJwt, conv.deleteSession);

  // ==================== AI ROUTES ====================

  // STT (PCM Audio Upload)
  router.post('/ai/stt', checkJwt, upload.single('audio'), ai.stt);

  // Chat
  router.post('/ai/chat', checkJwt, ai.chat);

  // Feedback
  router.post('/ai/feedback', checkJwt, ai.feedback);

  // TTS (AI-server version)
  router.post('/ai/tts', checkJwt, ai.tts);

  // Example reply
  router.post('/ai/example-reply', checkJwt, ai.exampleReply);

  // Review
  router.post('/ai/review', checkJwt, ai.review);

  // Stats
  router.get('/ai/stats/accuracy', checkJwt, ai.getAccuracy);

  // Conversation History
  router.get('/ai/conversation/history', checkJwt, ai.getConversationHistory);

  // Reset Conversation
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

  // ==================== HOME ROUTE (FIXED) ====================
  router.get('/home/status', checkJwt, home.getHomeStatus);

  return router;
};
