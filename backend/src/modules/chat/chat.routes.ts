import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  createConversationHandler,
  listMessagesHandler,
  requestAdminHandler,
  sendMessageHandler,
} from './chat.controller.js';

/** /api/chat -- conversations owned by the authenticated customer. */
export const chatRouter = Router();
chatRouter.use(requireAuth);
chatRouter.post('/conversations', createConversationHandler);
chatRouter.get('/conversations/:id/messages', listMessagesHandler);
chatRouter.post('/conversations/:id/messages', sendMessageHandler);
chatRouter.post('/conversations/:id/request-admin', requestAdminHandler);
