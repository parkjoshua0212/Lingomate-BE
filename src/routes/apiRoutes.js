import express from 'express';
import authController from '../controllers/authController.js';
import userController from '../controllers/usersController.js';
import conversationController from '../controllers/convController.js';
import aiController from '../controllers/aiController.js';
import subscriptionController from '../controllers/subscriptionController.js';
import statsController from '../controllers/statsController.js';

const router = express.Router();

export default (wss) => {
    // Initialize controllers with WebSocket if needed
    const auth = authController();
    const user = userController();
    const conv = conversationController(wss); // Chat needs WS for real-time
    const ai = aiController();
    const sub = subscriptionController();
    const stats = statsController();

    // --- 1. Auth & Profile ---
    /**
 * @swagger
 * tags:
 *   - name: Auth
 *   - name: User
 *   - name: Conversation
 *   - name: AI
 *   - name: Subscription
 *   - name: Stats
 *   - name: Notifications
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               topic: { type: string }
 *     responses:
 *       200:
 *         description: Conversation started
 */
router.post('/conversation/start', conv.startSession);

/**
 * @swagger
 * /api/conversation/send:
 *   post:
 *     summary: Send a message and get AI reply
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
 *               sessionId: { type: string }
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: Message processed and reply returned
 */
router.post('/conversation/send', conv.sendMessage);

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
 *           type: string
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
 *               sessionId: { type: string }
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
 *     summary: AI chat (stateless)
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: AI response returned
 */
router.post('/ai/chat', ai.chat);

/**
 * @swagger
 * /api/ai/correct:
 *   post:
 *     summary: Grammar correction
 *     tags: [AI]
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

/**
 * @swagger
 * /api/ai/explain:
 *   post:
 *     summary: Explain text or phrase
 *     tags: [AI]
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
 *         description: Explanation returned
 */
router.post('/ai/explain', ai.explain);

/**
 * @swagger
 * /api/phrases:
 *   get:
 *     summary: Get saved phrases
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: List of phrases returned
 */
router.get('/phrases', ai.getPhrases);

//
// ─── SETTINGS ROUTES ──────────────────────────────────────────────────────────
//

/**
 * @swagger
 * /api/conversation/settings:
 *   get:
 *     summary: Get conversation settings
 *     tags: [User]
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
// ─── STATS ROUTE ──────────────────────────────────────────────────────────────
//

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Get user stats (XP, progress, etc.)
 *     tags: [Stats]
 *     responses:
 *       200:
 *         description: Stats returned
 */
router.get('/stats', stats.getStats);

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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Notification settings updated
 */
router.put('/notifications/settings', (req, res) =>
    res.json({ success: true, data: req.body })
);


    return router;
};