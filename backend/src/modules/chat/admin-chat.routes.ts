import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middleware/auth.js';
import {
  adminAcceptConversationHandler,
  adminAddConversationNoteHandler,
  adminClassifyConversationHandler,
  adminCloseConversationHandler,
  adminConversationDetailHandler,
  adminListConversationsHandler,
  adminListSupportAgentsHandler,
  adminSendMessageHandler,
  adminTransferConversationHandler,
} from './admin-chat.controller.js';

/** /api/admin/chat -- support queue and assigned-admin commands. */
export const adminChatRouter = Router();
adminChatRouter.use(requireAuth, requirePermission('SUPPORT'));
adminChatRouter.get('/agents', adminListSupportAgentsHandler);
adminChatRouter.get('/conversations', adminListConversationsHandler);
adminChatRouter.get('/conversations/:id', adminConversationDetailHandler);
adminChatRouter.post('/conversations/:id/accept', adminAcceptConversationHandler);
adminChatRouter.post('/conversations/:id/messages', adminSendMessageHandler);
adminChatRouter.post('/conversations/:id/close', adminCloseConversationHandler);
adminChatRouter.post('/conversations/:id/category', adminClassifyConversationHandler);
adminChatRouter.post('/conversations/:id/notes', adminAddConversationNoteHandler);
adminChatRouter.post('/conversations/:id/transfer', adminTransferConversationHandler);
