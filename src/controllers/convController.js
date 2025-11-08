import prisma from '../lib/prisma.js';

// Create new conversation
export const createConversation = async (req, res) => {
  try {
    const { userId, userMessage, aiMessage } = req.body;

    const newConversation = await prisma.conversation.create({
      data: {
        userId,
        userMessage,
        aiMessage,
      },
    });

    res.json(newConversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
};

// Get all conversations for a user
export const getConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    const conversations = await prisma.conversation.findMany({
      where: { userId: Number(userId) },
      orderBy: { createdAt: 'desc' },
    });
    res.json(conversations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

// Delete a conversation
export const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.conversation.delete({ where: { id: Number(id) } });
    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
};