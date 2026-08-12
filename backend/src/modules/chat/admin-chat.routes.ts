import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth.js';
import {
  adminAcceptConversationHandler,
  adminCloseConversationHandler,
  adminConversationDetailHandler,
  adminListConversationsHandler,
  adminSendMessageHandler,
} from './admin-chat.controller.js';

/** /api/admin/chat -- support queue and assigned-admin commands. */
export const adminChatRouter = Router();
adminChatRouter.use(requireAuth, requireAdmin);
adminChatRouter.get('/conversations', adminListConversationsHandler);
adminChatRouter.get('/conversations/:id', adminConversationDetailHandler);
adminChatRouter.post('/conversations/:id/accept', adminAcceptConversationHandler);
adminChatRouter.post('/conversations/:id/messages', adminSendMessageHandler);
adminChatRouter.post('/conversations/:id/close', adminCloseConversationHandler);
