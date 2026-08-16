import type { RequestHandler } from 'express';
import {
  chatMessageSchema,
  conversationParamSchema,
  customerConversationListQuerySchema,
  messageListQuerySchema,
} from './chat.schema.js';
import * as chatService from './chat.service.js';

export const createConversationHandler: RequestHandler = async (req, res) => {
  const conversation = await chatService.createConversation(req.user!.id);
  res.status(201).json({ conversation });
};

export const listCustomerConversationsHandler: RequestHandler = async (req, res) => {
  const query = customerConversationListQuerySchema.parse(req.query);
  const result = await chatService.listCustomerConversations(req.user!.id, query);
  res.json(result);
};

export const listMessagesHandler: RequestHandler = async (req, res) => {
  const { id } = conversationParamSchema.parse(req.params);
  const query = messageListQuerySchema.parse(req.query);
  const result = await chatService.listCustomerMessages(req.user!.id, id, query);
  res.json(result);
};

export const sendMessageHandler: RequestHandler = async (req, res) => {
  const { id } = conversationParamSchema.parse(req.params);
  const input = chatMessageSchema.parse(req.body);
  const result = await chatService.sendCustomerMessage(req.user!.id, id, input);
  res.status(201).json(result);
};

export const requestAdminHandler: RequestHandler = async (req, res) => {
  const { id } = conversationParamSchema.parse(req.params);
  const result = await chatService.requestAdmin(req.user!.id, id);
  res.json(result);
};

export const closeCustomerConversationHandler: RequestHandler = async (req, res) => {
  const { id } = conversationParamSchema.parse(req.params);
  const result = await chatService.closeCustomerConversation(req.user!.id, id);
  res.json(result);
};
