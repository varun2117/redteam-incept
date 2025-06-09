"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAssessmentRateLimit = exports.sanitizeInput = exports.validateApiKey = exports.validateTestConnection = exports.validateChatMessage = exports.validateAssessmentRequest = void 0;
const joi_1 = __importDefault(require("joi"));
const ChatAgentConnector_1 = require("../connectors/ChatAgentConnector");
// Validation schemas
const assessmentRequestSchema = joi_1.default.object({
    targetName: joi_1.default.string().required().min(1).max(200).trim(),
    targetDescription: joi_1.default.string().optional().max(1000).trim(),
    chatAgentUrl: joi_1.default.string().required().uri().custom((value, helpers) => {
        if (!ChatAgentConnector_1.ChatAgentConnector.validateUrl(value)) {
            return helpers.error('Invalid URL format');
        }
        return value;
    }),
    chatAgentConfig: joi_1.default.object({
        method: joi_1.default.string().valid('GET', 'POST', 'PUT').optional(),
        headers: joi_1.default.object().optional(),
        auth: joi_1.default.object({
            type: joi_1.default.string().valid('bearer', 'api-key', 'basic').required(),
            token: joi_1.default.string().optional(),
            apiKey: joi_1.default.string().optional(),
            headerName: joi_1.default.string().optional(),
            username: joi_1.default.string().optional(),
            password: joi_1.default.string().optional()
        }).optional(),
        timeout: joi_1.default.number().integer().min(1000).max(120000).optional(),
        retries: joi_1.default.number().integer().min(0).max(10).optional(),
        requestFormat: joi_1.default.string().valid('json', 'form', 'text').optional(),
        responseFormat: joi_1.default.string().valid('json', 'text').optional(),
        messageField: joi_1.default.string().optional(),
        responseField: joi_1.default.string().optional()
    }).optional(),
    openrouterApiKey: joi_1.default.string().required().pattern(/^sk-or-/).messages({
        'string.pattern.base': 'OpenRouter API key must start with "sk-or-"'
    }),
    selectedModel: joi_1.default.string().required().min(1),
    userId: joi_1.default.string().optional()
});
const chatMessageSchema = joi_1.default.object({
    url: joi_1.default.string().required().uri(),
    message: joi_1.default.string().required().min(1).max(10000),
    config: joi_1.default.object().optional()
});
const testConnectionSchema = joi_1.default.object({
    chatAgentUrl: joi_1.default.string().required().uri(),
    chatAgentConfig: joi_1.default.object().optional()
});
// Validation middleware factory
const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors
            });
        }
        // Replace req.body with validated and sanitized data
        req.body = value;
        next();
    };
};
// Specific validation middleware functions
exports.validateAssessmentRequest = validate(assessmentRequestSchema);
exports.validateChatMessage = validate(chatMessageSchema);
exports.validateTestConnection = validate(testConnectionSchema);
// Custom validation functions
const validateApiKey = (req, res, next) => {
    const { openrouterApiKey } = req.body;
    if (!openrouterApiKey) {
        return res.status(400).json({
            success: false,
            message: 'OpenRouter API key is required'
        });
    }
    if (!openrouterApiKey.startsWith('sk-or-')) {
        return res.status(400).json({
            success: false,
            message: 'Invalid OpenRouter API key format. Must start with "sk-or-"'
        });
    }
    if (openrouterApiKey.length < 20) {
        return res.status(400).json({
            success: false,
            message: 'OpenRouter API key appears to be too short'
        });
    }
    next();
};
exports.validateApiKey = validateApiKey;
const sanitizeInput = (req, res, next) => {
    // Basic input sanitization
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj.trim().slice(0, 10000); // Limit string length
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitize);
        }
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    sanitized[key] = sanitize(obj[key]);
                }
            }
            return sanitized;
        }
        return obj;
    };
    req.body = sanitize(req.body);
    req.query = sanitize(req.query);
    next();
};
exports.sanitizeInput = sanitizeInput;
// Rate limiting validation
const validateAssessmentRateLimit = (req, res, next) => {
    // Check if user is making too many concurrent assessments
    // This would typically check against a database or Redis
    // For now, we'll just pass through
    next();
};
exports.validateAssessmentRateLimit = validateAssessmentRateLimit;
//# sourceMappingURL=validation.js.map