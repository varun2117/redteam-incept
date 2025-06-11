export interface ChatResponse {
  success: boolean;
  message: string;
  error?: string;
  responseTime?: number;
}

export interface ConnectionConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT';
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  requestFormat?: 'json' | 'form' | 'query';
  responseFormat?: 'json' | 'text';
  messageField?: string;
  responseField?: string;
  authType?: 'bearer' | 'apikey' | 'basic' | 'none';
  apiKey?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class ChatAgentConnector {
  private config: ConnectionConfig;
  
  constructor(config: ConnectionConfig) {
    this.config = {
      method: 'POST',
      timeout: 30000,
      retries: 3,
      requestFormat: 'json',
      responseFormat: 'json',
      messageField: 'message',
      responseField: 'message',
      authType: 'none',
      ...config
    };
  }

  static validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  async sendMessage(message: string, conversation: ConversationMessage[] = []): Promise<ChatResponse> {
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= (this.config.retries || 3); attempt++) {
      try {
        const response = await this.makeRequest(message, conversation);
        const responseTime = Date.now() - startTime;
        
        if (response.success) {
          return { ...response, responseTime };
        }
        
        if (attempt === this.config.retries) {
          return response;
        }
        
        // Wait before retry
        await this.sleep(1000 * attempt);
        
      } catch (error) {
        if (attempt === this.config.retries) {
          return {
            success: false,
            message: '',
            error: error instanceof Error ? error.message : 'Unknown error',
            responseTime: Date.now() - startTime
          };
        }
        
        await this.sleep(1000 * attempt);
      }
    }
    
    return {
      success: false,
      message: '',
      error: 'Max retries exceeded'
    };
  }

  private async makeRequest(message: string, conversation: ConversationMessage[]): Promise<ChatResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'RedTeamAgent/1.0',
      ...this.config.headers
    };

    // Add authentication headers
    if (this.config.authType === 'bearer' && this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    } else if (this.config.authType === 'apikey' && this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    // Prepare request body
    let body: any;
    if (this.config.requestFormat === 'json') {
      const messages = [
        ...conversation,
        { role: 'user' as const, content: message }
      ];
      
      body = JSON.stringify({
        [this.config.messageField || 'message']: message,
        messages,
        conversation
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

      const response = await fetch(this.config.url, {
        method: this.config.method || 'POST',
        headers,
        body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          message: '',
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const responseData = await response.json();
      const responseMessage = this.extractResponseMessage(responseData);

      return {
        success: true,
        message: responseMessage
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          message: '',
          error: 'Request timeout'
        };
      }

      return {
        success: false,
        message: '',
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  private extractResponseMessage(data: any): string {
    const responseField = this.config.responseField || 'message';
    
    // Try direct field access
    if (data[responseField]) {
      return String(data[responseField]);
    }
    
    // Try nested access for common API patterns
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return String(data.choices[0].message.content || data.choices[0].message);
    }
    
    if (data.response) {
      return String(data.response);
    }
    
    if (data.text) {
      return String(data.text);
    }
    
    if (data.content) {
      return String(data.content);
    }
    
    // Fallback to entire response as string
    return typeof data === 'string' ? data : JSON.stringify(data);
  }

  async testConnection(): Promise<ChatResponse> {
    return this.sendMessage('Hello, this is a connection test.');
  }

  static async autoDetectFormat(url: string, apiKey?: string): Promise<ConnectionConfig | null> {
    const testConfigs: Partial<ConnectionConfig>[] = [
      // OpenAI-style API
      {
        requestFormat: 'json',
        responseFormat: 'json',
        messageField: 'messages',
        responseField: 'message',
        authType: 'bearer'
      },
      // Simple message API
      {
        requestFormat: 'json', 
        responseFormat: 'json',
        messageField: 'message',
        responseField: 'message',
        authType: 'none'
      },
      // API key authentication
      {
        requestFormat: 'json',
        responseFormat: 'json', 
        messageField: 'message',
        responseField: 'response',
        authType: 'apikey'
      }
    ];

    for (const config of testConfigs) {
      try {
        const testConfig: ConnectionConfig = {
          url,
          timeout: 10000,
          retries: 1,
          apiKey,
          ...config
        };

        const connector = new ChatAgentConnector(testConfig);
        const result = await connector.testConnection();

        if (result.success) {
          return testConfig;
        }
      } catch (error) {
        // Try next configuration
        continue;
      }
    }

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}