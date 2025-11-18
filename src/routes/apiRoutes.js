import express from 'express';
import userController from '../controllers/usersController.js';
import chatController from '../controllers/chatController.js';
import feedbackController from '../controllers/fbController.js';
import paymentController from '../controllers/paymentController.js';

const router = express.Router();

export default (wss) => {
    // Initialize all controllers with WSS
    const users = userController(wss);
    const chats = chatController(wss);
    const feedback = feedbackController(wss);
    const payments = paymentController(wss);

    // --- 1. User & Stats ---
    router.get('/users/me', users.getMyProfile);
    router.put('/users/me/settings', users.updateSettings);

    // --- 2. Chat History ---
    // Note: Conversation creation is still in your original convRoutes
    router.get('/conversations/:conversationId/messages', chats.getMessages);

    // --- 3. AI Feedback ---
    router.post('/conversations/:conversationId/feedback', feedback.generateFeedback);

    // --- 4. Payments ---
    router.post('/payments/checkout', payments.createCheckoutSession);
    router.post('/payments/webhook', payments.handleWebhook);

    return router;
};