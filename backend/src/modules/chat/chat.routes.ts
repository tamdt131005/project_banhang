import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  closeCustomerConversationHandler,
  createConversationHandler,
  listCustomerConversationsHandler,
  listMessagesHandler,
  requestAdminHandler,
  sendMessageHandler,
} from './chat.controller.js';

/** /api/chat -- conversations owned by the authenticated customer. */
export const chatRouter = Router();
chatRouter.use(requireAuth);
chatRouter.get('/conversations', listCustomerConversationsHandler);
chatRouter.post('/conversations', createConversationHandler);
chatRouter.get('/conversations/:id/messages', listMessagesHandler);
chatRouter.post('/conversations/:id/messages', sendMessageHandler);
chatRouter.post('/conversations/:id/request-admin', requestAdminHandler);
chatRouter.post('/conversations/:id/close', closeCustomerConversationHandler);
