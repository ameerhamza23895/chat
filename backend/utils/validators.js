/**
 * Joi validation schemas
 * Centralized validation schemas for all endpoints
 */

const Joi = require('joi');

const validators = {
  // Auth validators
  register: Joi.object({
    body: Joi.object({
      username: Joi.string().min(3).max(20).trim().required()
        .messages({
          'string.min': 'Username must be at least 3 characters',
          'string.max': 'Username cannot exceed 20 characters',
          'any.required': 'Username is required',
        }),
      email: Joi.string().email().lowercase().trim().required()
        .messages({
          'string.email': 'Please provide a valid email',
          'any.required': 'Email is required',
        }),
      password: Joi.string().min(6).required()
        .messages({
          'string.min': 'Password must be at least 6 characters',
          'any.required': 'Password is required',
        }),
    }),
  }),

  login: Joi.object({
    body: Joi.object({
      email: Joi.string().email().lowercase().trim().required()
        .messages({
          'string.email': 'Please provide a valid email',
          'any.required': 'Email is required',
        }),
      password: Joi.string().required()
        .messages({
          'any.required': 'Password is required',
        }),
    }),
  }),

  // Message validators
  sendMessage: Joi.object({
    body: Joi.object({
      receiverId: Joi.string().required()
        .messages({
          'any.required': 'Receiver ID is required',
        }),
      content: Joi.string().max(5000).allow('')
        .messages({
          'string.max': 'Message content cannot exceed 5000 characters',
        }),
      messageType: Joi.string().valid('text', 'image', 'audio', 'video', 'file', 'call-video-ended', 'call-audio-ended', 'call-missed')
        .default('text'),
      fileUrl: Joi.string().uri().allow(''),
      fileName: Joi.string().max(255).allow(''),
      fileSize: Joi.number().min(0).max(100 * 1024 * 1024), // Max 100MB
      mimeType: Joi.string().allow(''),
    }),
  }),

  getMessages: Joi.object({
    params: Joi.object({
      userId: Joi.string().required(),
    }),
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(50),
      beforeDate: Joi.date().iso(),
    }),
  }),

  markAsRead: Joi.object({
    params: Joi.object({
      messageId: Joi.string().required(),
    }),
  }),

  // User validators
  getUserById: Joi.object({
    params: Joi.object({
      id: Joi.string().required(),
    }),
  }),
};

module.exports = validators;
