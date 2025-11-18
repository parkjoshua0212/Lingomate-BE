import express from 'express';
import userController from '../controllers/userController.js';
import chatController from '../controllers/chatController.js';
import feedbackController from '../controllers/feedbackController.js';
import paymentController from '../controllers/paymentController.js';

const router = express.Router();

export default (wss) => {
    // Initialize controllers
    const users = userController(wss);
    const chats = chatController(wss);
    const feedback = feedbackController(wss);
    const payments = paymentController(wss);

    // --- 1. User & Dashboard ---
    // "My Page" Profile Data
    router.get('/users/me', users.getMyProfile);
    
    // Update Settings (Voice, Tone, Nickname)
    router.put('/users/me/settings', users.updateSettings);
    
    // [NEW] Dashboard Data (Profile + Stats + Recent Activity)
    router.get('/dashboard', users.getDashboard);

    // --- 2. Chat History ---
    // Load messages for the chat screen
    router.get('/conversations/:conversationId/messages', chats.getMessages);

    // --- 3. AI Feedback ---
    // Trigger the AI Python service to correct grammar
    router.post('/conversations/:conversationId/feedback', feedback.generateFeedback);

    // --- 4. Payments (Google Play) ---
    // Verify the receipt token sent from the mobile app
    router.post('/payments/verify-google', payments.verifyGooglePurchase);

    return router;
};