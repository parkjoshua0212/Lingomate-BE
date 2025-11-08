import express from 'express';
import {
  createConversation,
  getConversations,
  deleteConversation,
} from '../controllers/convController.js';

const router = express.Router();

// POST /api/conversations
router.post('/', createConversation);

// GET /api/conversations/:userId
router.get('/:userId', getConversations);

// DELETE /api/conversations/:id
router.delete('/:id', deleteConversation);

export default router;