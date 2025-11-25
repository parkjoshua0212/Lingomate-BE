import express from 'express';
import authController from '../controllers/authController.js';
import userController from '../controllers/usersController.js';
import conversationController from '../controllers/convController.js';
import aiController from '../controllers/aiController.js';
import subscriptionController from '../controllers/subscriptionController.js';
import statsController from '../controllers/statsController.js';

const router = express.Router();

export default (wss) => {
    // Initialize controllers with WebSocket server instance
    const auth = authController();
    const user = userController();
    const conv = conversationController(wss); // Chat needs WebSocket for real-time updates
    const ai = aiController();
    const sub = subscriptionController();
    const stats = statsController();

// --- SWAGGER DOCUMENTATION TAGS ---
/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: User authentication and synchronization
 *   - name: User
 *     description: Profile management and settings
 *   - name: Conversation
 *     description: Chat sessions, history, and messaging
 *   - name: AI
 *     description: AI interaction, grammar correction, and TTS
 *   - name: Subscription
 *     description: Payment verification and plan management
 *   - name: Stats
 *     description: User learning statistics
 *   - name: Notifications
 *     description: Push notification settings
 */

//
// ─── AUTH ROUTES ───────────────────────────────────────────────────────────────
//

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user info
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User info retrieved
 */
router.get('/auth/me', auth.getMe);

/**
 * @swagger
 * /api/auth/register-if-needed:
 *   post:
 *     summary: Sync Auth0 User to Database (Login)
 *     description: Checks if the user exists in DB based on Auth0 Token. If not, creates them.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               email: { type: string }
 *               avatarUrl: { type: string }
 *     responses:
 *       200:
 *         description: User synced successfully
 */
router.post('/auth/register-if-needed', auth.syncUser);

//
// ─── USER PROFILE ROUTES ───────────────────────────────────────────────────────
//

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile returned
 */
router.get('/user/profile', user.getProfile);

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               country: { type: string }
 *               nickname: { type: string }
 *               gender: { type: string }
 *               style: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/user/profile', user.updateProfile);

//
// ─── CONVERSATION ROUTES ───────────────────────────────────────────────────────
//

/**
 * @swagger
 * /api/conversation/start:
 *   post:
 *     summary: Start a new conversation session
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversation started
 */
router.post('/conversation/start', conv.startSession);

/**
 * @swagger
 * /api/conversation/finish:
 *   post:
 *     summary: Finish session and save script
 *     description: Uploads the full chat transcript at the end of a session.
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId: { type: integer }
 *               script:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     from: { type: string, example: "user" }
 *                     text: { type: string }
 *     responses:
 *       200:
 *         description: Session finished and saved
 */
router.post('/conversation/finish', conv.finishSession);

/**
 * @swagger
 * /api/conversation/history:
 *   get:
 *     summary: Get all conversation sessions
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: History retrieved
 */
router.get('/conversation/history', conv.getHistory);

/**
 * @swagger
 * /api/conversation/{sessionId}:
 *   get:
 *     summary: Get messages from a specific session
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Session messages returned
 */
router.get('/conversation/:sessionId', conv.getSession);

/**
 * @swagger
 * /api/conversation/delete:
 *   delete:
 *     summary: Delete a conversation session
 *     tags: [Conversation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId: { type: integer }
 *     responses:
 *       200:
 *         description: Conversation deleted
 */
router.delete('/conversation/delete', conv.deleteSession);

//
// ─── SUBSCRIPTION ROUTES ───────────────────────────────────────────────────────
//

/**
 * @swagger
 * /api/subscription/options:
 *   get:
 *     summary: Get available subscription options
 *     tags: [Subscription]
 *     responses:
 *       200:
 *         description: Subscription options returned
 */
router.get('/subscription/options', sub.getOptions);

/**
 * @swagger
 * /api/subscription/subscribe:
 *   post:
 *     summary: Subscribe (Google Play purchase verification)
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               purchaseToken: { type: string }
 *               productId: { type: string }
 *     responses:
 *       200:
 *         description: Subscription activated
 */
router.post('/subscription/subscribe', sub.subscribe);

/**
 * @swagger
 * /api/subscription/cancel:
 *   post:
 *     summary: Cancel subscription
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription cancelled
 */
router.post('/subscription/cancel', sub.cancel);

//
// ─── AI ROUTES ─────────────────────────────────────────────────────────────────
//

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: AI chat (stateless text response)
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text: { type: string }
 *     responses:
 *       200:
 *         description: AI response returned
 */
router.post('/ai/chat', ai.chat);

/**
 * @swagger
 * /api/ai/tts:
 *   post:
 *     summary: Text to Speech
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text: { type: string }
 *               voice: { type: string }
 *     responses:
 *       200:
 *         description: Audio file returned (base64)
 */

router.post('/ai/stt', ai.stt); // [NEW]

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: AI chat (stateless)
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI response returned
 */

router.post('/ai/tts', ai.tts);

/**
 * @swagger
 * /api/ai/feedback:
 *   post:
 *     summary: Get AI Feedback (Meaning + Examples)
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text: { type: string }
 *     responses:
 *       200:
 *         description: Feedback returned
 */
router.post('/ai/feedback', ai.feedback);

/**
 * @swagger
 * /api/ai/correct:
 *   post:
 *     summary: Grammar correction
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text: { type: string }
 *     responses:
 *       200:
 *         description: Corrected sentence returned
 */
router.post('/ai/correct', ai.correct);

//
// ─── SETTINGS ROUTES ──────────────────────────────────────────────────────────
//

/**
 * @swagger
 * /api/conversation/settings:
 *   get:
 *     summary: Get conversation settings
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings returned
 */
router.get('/conversation/settings', user.getSettings);

/**
 * @swagger
 * /api/conversation/settings:
 *   put:
 *     summary: Update conversation settings
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               style: { type: string }
 *               gender: { type: string }
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.put('/conversation/settings', user.updateSettings);

//
// ─── STATS & DASHBOARD ROUTES ─────────────────────────────────────────────────
//

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Get user stats (XP, progress, etc.)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats returned
 */
router.get('/stats', stats.getStats);

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Get Dashboard Data (Profile + Stats + Recent)
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data returned
 */
router.get('/dashboard', user.getDashboard);

//
// ─── NOTIFICATION ROUTES ───────────────────────────────────────────────────────
//

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     summary: Get notification settings
 *     tags: [Notifications]
 *     responses:
 *       200:
 *         description: Notification settings returned
 */
router.get('/notifications/settings', (req, res) =>
    res.json({ success: true, data: { enabled: true } })
);

/**
 * @swagger
 * /api/notifications/settings:
 *   put:
 *     summary: Update notification settings
 *     tags: [Notifications]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.put('/notifications/settings', (req, res) =>
    res.json({ success: true, data: req.body })
);

    router.put('/notifications/settings', (req, res) => res.json({ success: true, data: req.body }));

    return router;
};