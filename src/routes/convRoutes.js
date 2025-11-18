// convroutes.js (Updated for ESM)

import express from 'express'; // Use ESM import here too
import convController from '../controllers/convController.js'; // Ensure controller also uses ESM or require()

const router = express.Router();

// 💡 FIX: Replace 'module.exports' with 'export default'
export default (wss) => {
    // Pass the wss instance to the controller initializer
    const controller = convController(wss); 

    // 1. Create a new conversation
    router.post('/', controller.newConversation);

    // ... (rest of the routes)
    router.get('/:userId', controller.getConversations);
    router.delete('/:conversationId', controller.deleteConversation);

    return router;
};