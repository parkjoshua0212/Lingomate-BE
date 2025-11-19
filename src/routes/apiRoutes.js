import express from 'express';
import userController from '../controllers/usersController.js';
import chatController from '../controllers/chatController.js';
import feedbackController from '../controllers/fbController.js';
import paymentController from '../controllers/paymentController.js';

const router = express.Router();

export default (wss) => {
    const users = userController(wss);
    const chats = chatController(wss);
    const feedback = feedbackController(wss);
    const payments = paymentController(wss);

    // --- SWAGGER DOCUMENTATION START ---

    /**
     * @swagger
     * /api/dashboard:
     *   get:
     *     summary: Get User Dashboard Data
     *     description: Fetches profile, stats, and recent conversations for the logged-in user.
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Successfully loaded dashboard.
     *       401:
     *         description: Unauthorized (Token missing).
     */
    router.get('/dashboard', users.getDashboard);

    /**
     * @swagger
     * /api/conversations:
     *   post:
     *     summary: Start a Free-Talking Conversation
     *     description: Creates a new chat session using the user's saved style/voice preferences.
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               userId:
     *                 type: integer
     *                 example: 1
     *     responses:
     *       200:
     *         description: Conversation started successfully.
     */

    router.get('/users/me', users.getMyProfile);

/**
 * @swagger
 * /api/users/me/settings:
 *   put:
 *     summary: Update User Settings
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
 *               country:
 *                 type: string
 *               style:
 *                 type: string
 *               gender:
 *                 type: string
 *               nickname:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 */
router.put('/users/me/settings', users.updateSettings);

/**
 * @swagger
 * /api/conversations:
 *   post:
 *     summary: Start Free-Talking Conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Conversation started
 */
 
/**
 * @swagger
 * /api/conversations/{conversationId}/messages:
 *   get:
 *     summary: Get Chat History
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of messages
 */
router.get('/conversations/:conversationId/messages', chats.getMessages);

/**
 * @swagger
 * /api/conversations/{conversationId}/feedback:
 *   post:
 *     summary: Generate AI Feedback
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Feedback generation started
 */
router.post('/conversations/:conversationId/feedback', feedback.generateFeedback);

/**
 * @swagger
 * /api/payments/verify-google:
 *   post:
 *     summary: Verify Google Play Purchase
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               purchaseToken:
 *                 type: string
 *               productId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Verified and Upgraded
 */
    router.post('/payments/verify-google', payments.verifyGooglePurchase);

    return router;
};
