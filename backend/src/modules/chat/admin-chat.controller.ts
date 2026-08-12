import type { RequestHandler } from 'express';
import {
  adminConversationListQuerySchema,
  chatMessageSchema,
  conversationParamSchema,
  messageListQuerySchema,
} from './chat.schema.js';
import * as chatService from './chat.service.js';

export const adminListConversationsHandler: RequestHandler = async (req, res) => {
  const query = adminConversationListQuerySchema.parse(req.query);
  res.json(await chatService.listAdminConversations(query));
};

export const adminConversationDetailHandler: RequestHandler = async (req, res) => {
  const { id } = conversationParamSchema.parse(req.params);
  const query = messageListQuerySchema.parse(req.query);
  res.json(await chatService.getAdminConversation(id, query));
};

export const adminAcceptConversationHandler: RequestHandler = async (req, res) => {
  const { id } = conversationParamSchema.parse(req.params);
  res.json(await chatService.acceptConversation(req.user!.id, id));
};

export const adminSendMessageHandler: RequestHandler = async (req, res) => {
  const { id } = conversationParamSchema.parse(req.params);
  const input = chatMessageSchema.parse(req.body);
  res.status(201).json(await chatService.sendAdminMessage(req.user!.id, id, input));
};

export const adminCloseConversationHandler: RequestHandler = async (req, res) => {
  const { id } = conversationParamSchema.parse(req.params);
  res.json(await chatService.closeConversation(req.user!.id, id));
};
