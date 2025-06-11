"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatAgentConnector = void 0;
const axios_1 = __importDefault(require("axios"));
const url_1 = require("url");
class ChatAgentConnector {
    constructor(config) {
        this.conversationHistory = [];
        this.config = {
            method: 'POST',
            timeout: 30000,
            retries: 3,
            requestFormat: 'json',
            responseFormat: 'json',
            messageField: 'message',
            responseField: 'response',
            ...config
        };
    }
    /**
     * Test connection to the chat agent
     */
    async testConnection() {
        const startTime = Date.now();
        try {
            const testMessage = "Hello! This is a connection test.";
            const response = await this.sendMessage(testMessage);
            const responseTime = Date.now() - startTime;
            return {
                success: response.success,
                error: response.error,
                responseTime
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime: Date.now() - startTime
            };
        }
    }
    /**
     * Send a message to the chat agent
     */
    async sendMessage(message, context) {
        let lastError = null;
        for (let attempt = 1; attempt <= (this.config.retries || 3); attempt++) {
            try {
                const response = await this.makeRequest(message, context);
                // Add to conversation history
                this.conversationHistory.push({ role: 'user', content: message, timestamp: new Date() }, { role: 'assistant', content: response.message, timestamp: new Date() });
                return response;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
                if (attempt < (this.config.retries || 3)) {
                    // Wait before retry (exponential backoff)
                    await this.delay(Math.pow(2, attempt) * 1000);
                }
            }
        }
        this.lastError = lastError?.message;
        return {
            success: false,
            error: lastError?.message || 'Failed to send message after retries',
            message: ''
        };
    }
    /**
     * Make the actual HTTP request to the chat agent
     */
    async makeRequest(message, context) {
        const requestData = this.buildRequestData(message, context);
        const headers = this.buildHeaders();
        const axiosConfig = {
            method: this.config.method,
            url: this.config.url,
            headers,
            timeout: this.config.timeout,
            ...(this.config.method !== 'GET' && { data: requestData })
        };
        const response = await (0, axios_1.default)(axiosConfig);
        return this.parseResponse(response);
    }
    /**
     * Build request data based on configuration
     */
    buildRequestData(message, context) {
        const baseData = {};
        // Set message field
        if (this.config.messageField) {
            baseData[this.config.messageField] = message;
        }
        // Add conversation history in Test Agents format
        if (this.conversationHistory.length > 0) {
            baseData.conversation = this.conversationHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
        }
        // Add context
        if (context) {
            baseData.context = context;
        }
        // Extract model from URL if it contains model parameter, otherwise use default
        try {
            const url = new url_1.URL(this.config.url);
            const modelFromUrl = url.searchParams.get('model');
            baseData.model = modelFromUrl || 'openai/gpt-4o-mini';
        }
        catch {
            baseData.model = 'openai/gpt-4o-mini';
        }
        // Handle different request formats
        switch (this.config.requestFormat) {
            case 'form':
                const formData = new URLSearchParams();
                Object.keys(baseData).forEach(key => {
                    formData.append(key, typeof baseData[key] === 'string' ? baseData[key] : JSON.stringify(baseData[key]));
                });
                return formData;
            case 'text':
                return message;
            case 'json':
            default:
                return baseData;
        }
    }
    /**
     * Build request headers
     */
    buildHeaders() {
        const headers = {
            'User-Agent': 'RedTeam-Agent/1.0',
            ...(this.config.headers || {})
        };
        // Set content type based on request format
        switch (this.config.requestFormat) {
            case 'form':
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
                break;
            case 'text':
                headers['Content-Type'] = 'text/plain';
                break;
            case 'json':
            default:
                headers['Content-Type'] = 'application/json';
                break;
        }
        // Add authentication headers
        if (this.config.auth) {
            switch (this.config.auth.type) {
                case 'bearer':
                    if (this.config.auth.token) {
                        headers['Authorization'] = `Bearer ${this.config.auth.token}`;
                    }
                    break;
                case 'api-key':
                    if (this.config.auth.apiKey && this.config.auth.headerName) {
                        headers[this.config.auth.headerName] = this.config.auth.apiKey;
                    }
                    break;
                case 'basic':
                    if (this.config.auth.username && this.config.auth.password) {
                        const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
                        headers['Authorization'] = `Basic ${credentials}`;
                    }
                    break;
            }
        }
        return headers;
    }
    /**
     * Parse response from the chat agent
     */
    parseResponse(response) {
        let message = '';
        let metadata = {};
        try {
            if (this.config.responseFormat === 'text') {
                message = response.data;
            }
            else {
                // JSON response
                const data = response.data;
                metadata = data;
                if (this.config.responseField && data[this.config.responseField]) {
                    message = data[this.config.responseField];
                }
                else if (data.message) {
                    message = data.message;
                }
                else if (data.response) {
                    message = data.response;
                }
                else if (data.reply) {
                    message = data.reply;
                }
                else if (data.text) {
                    message = data.text;
                }
                else if (typeof data === 'string') {
                    message = data;
                }
                else {
                    // Try to extract text from common fields
                    message = data.choices?.[0]?.message?.content ||
                        data.outputs?.[0]?.text ||
                        data.result ||
                        JSON.stringify(data);
                }
            }
            return {
                success: true,
                message: message.toString(),
                metadata
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to parse response: ${error}`,
                message: ''
            };
        }
    }
    /**
     * Get conversation history
     */
    getConversationHistory() {
        return [...this.conversationHistory];
    }
    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }
    /**
     * Get last error
     */
    getLastError() {
        return this.lastError;
    }
    /**
     * Validate URL format
     */
    static validateUrl(url) {
        try {
            new url_1.URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Create connector from agent info
     */
    static fromAgentInfo(agentInfo) {
        return new ChatAgentConnector(agentInfo.config);
    }
    /**
     * Delay utility for retries
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Auto-detect chat agent format by testing common endpoints and formats
     */
    static async autoDetectFormat(baseUrl, apiKey) {
        const commonConfigs = [
            // OpenAI-style API
            {
                url: `${baseUrl}/chat/completions`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: apiKey ? { type: 'bearer', token: apiKey } : undefined,
                messageField: 'messages',
                responseField: 'choices[0].message.content'
            },
            // Generic chat API
            {
                url: baseUrl,
                method: 'POST',
                messageField: 'message',
                responseField: 'response'
            },
            // Simple text endpoint
            {
                url: baseUrl,
                method: 'POST',
                requestFormat: 'text',
                responseFormat: 'text'
            }
        ];
        for (const config of commonConfigs) {
            try {
                const connector = new ChatAgentConnector(config);
                const result = await connector.testConnection();
                if (result.success) {
                    return config;
                }
            }
            catch (error) {
                // Continue to next config
                continue;
            }
        }
        return null;
    }
}
exports.ChatAgentConnector = ChatAgentConnector;
//# sourceMappingURL=ChatAgentConnector.js.map