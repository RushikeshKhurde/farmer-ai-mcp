export interface HealthResponse {
  status: string;
  backend: boolean;
  mcpConnected: boolean;
  timestamp: string;
}

export interface ChatResponse {
  answer: string;
  success: boolean;
  error?: string;
}

export interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isError?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  messages: MessageItem[];
}

export class ChatApiService {
  private static BASE_URL = "/api";

  static async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/health`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Health check returned status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Unable to reach backend server."
      );
    }
  }

  static async sendMessage(message: string): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "An error occurred while connecting to the assistant."
      );
    }
  }
}
