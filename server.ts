import dotenv from "dotenv";
import { resolve } from "node:path";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";

dotenv.config({ path: resolve(".env"), quiet: true });

const REQUIRED_ENV_VARS = [
  "OPENAI_API_KEY",
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "MYSQL_DATABASE",
] as const;

const PLACEHOLDER_VALUES = new Set([
  "your_openai_api_key_here",
  "your_mysql_password_here",
]);

function validateEnvironment(): void {
  const missingOrPlaceholder = REQUIRED_ENV_VARS.filter((name) => {
    const value = process.env[name]?.trim();
    return !value || PLACEHOLDER_VALUES.has(value);
  });

  if (missingOrPlaceholder.length > 0) {
    throw new Error(
      `Missing or unconfigured environment variable(s): ${missingOrPlaceholder.join(", ")}. ` +
      `Please configure real values in .env.`
    );
  }

  const port = Number(process.env.MYSQL_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(
      `Invalid MYSQL_PORT value in .env. Expected a valid TCP port number (e.g. 3306 or 3307).`
    );
  }
}

// Validate environment on startup
validateEnvironment();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class McpManager {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private connectingPromise: Promise<Client> | null = null;

  private createTransport(): StdioClientTransport {
    return new StdioClientTransport({
      command: process.execPath,
      args: [
        resolve("node_modules/tsx/dist/cli.mjs"),
        resolve("mcp-server.ts"),
      ],
      env: {
        ...getDefaultEnvironment(),
        ...(process.env.MYSQL_HOST ? { MYSQL_HOST: process.env.MYSQL_HOST } : {}),
        ...(process.env.MYSQL_PORT ? { MYSQL_PORT: process.env.MYSQL_PORT } : {}),
        ...(process.env.MYSQL_USER ? { MYSQL_USER: process.env.MYSQL_USER } : {}),
        ...(process.env.MYSQL_PASSWORD ? { MYSQL_PASSWORD: process.env.MYSQL_PASSWORD } : {}),
        ...(process.env.MYSQL_DATABASE ? { MYSQL_DATABASE: process.env.MYSQL_DATABASE } : {}),
      },
    });
  }

  async getClient(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = (async () => {
      try {
        const client = new Client({
          name: "farmer-ai-web-backend",
          version: "1.0.0",
        });

        const transport = this.createTransport();
        await client.connect(transport);

        this.client = client;
        this.transport = transport;
        console.log("Connected to MCP server (mcp-server.ts).");
        return client;
      } catch (err) {
        this.client = null;
        this.transport = null;
        throw err;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // Ignore close error on exit
      }
      this.client = null;
      this.transport = null;
    }
  }

  isConnected(): boolean {
    return this.client !== null;
  }
}

const mcpManager = new McpManager();

// Pre-connect MCP server on startup
mcpManager.getClient().catch((err) => {
  console.error("Warning: Initial MCP server connection failed:", err instanceof Error ? err.message : String(err));
});

const app = express();
const PORT = Number(process.env.PORT || 3001);

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "50kb" }));

// In-memory rate limiter: maximum 60 requests per minute per IP
const requestCounts = new Map<string, { count: number; resetTime: number }>();
function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60 * 1000;
  const limit = 60;

  const current = requestCounts.get(ip);
  if (!current || now > current.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    next();
    return;
  }

  if (current.count >= limit) {
    res.status(429).json({
      success: false,
      error: "Too many requests. Please wait a moment before sending another message.",
    });
    return;
  }

  current.count++;
  next();
}

app.use("/api/", rateLimiter);

// GET /api/health
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    backend: true,
    mcpConnected: mcpManager.isConnected(),
    timestamp: new Date().toISOString(),
  });
});

interface ChatRequestBody {
  message?: unknown;
}

// POST /api/chat
app.post("/api/chat", async (req: Request<{}, {}, ChatRequestBody>, res: Response): Promise<void> => {
  const { message } = req.body;

  if (typeof message !== "string" || !message.trim()) {
    res.status(400).json({
      success: false,
      error: "Message must be a non-empty string.",
    });
    return;
  }

  const trimmedMessage = message.trim();
  const MAX_MESSAGE_LENGTH = 1000;
  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({
      success: false,
      error: `Message is too long. Maximum allowed length is ${MAX_MESSAGE_LENGTH} characters.`,
    });
    return;
  }

  try {
    const client = await mcpManager.getClient();

    // 1. Discover the available MCP tools from the MCP server
    const { tools: mcpTools } = await client.listTools();

    // 2. Map MCP tools to OpenAI function tools
    const openAiTools = mcpTools.map((tool) => ({
      type: "function" as const,
      name: tool.name,
      description: tool.description || "MCP tool",
      parameters: (tool.inputSchema as Record<string, unknown>) || {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      strict: null,
    }));

    const instructions =
      "You are Farmer AI, an expert sugarcane farmer payment and supply analytics assistant. " +
      "You have access to a real MySQL database of farmer records via the Model Context Protocol (MCP) tool 'get_farmer_records'. " +
      "Guidelines:\n" +
      "1. ALWAYS call 'get_farmer_records' when the user asks about farmers, payments, sugarcane supply, villages, totals, or summaries.\n" +
      "2. Calculate all sums, averages, and comparisons carefully using actual data from the database. NEVER invent names or figures.\n" +
      "3. Format monetary values in Indian Rupees with the currency symbol (₹) or INR (e.g. ₹15,000).\n" +
      "4. Format sugarcane weights clearly in tonnes.\n" +
      "5. Use clean formatting with bullet points, bold text, or markdown tables when displaying multiple records or comparisons.\n" +
      "6. If the user asks a general greeting or questions unrelated to farmer records, answer politely and briefly explain what you can do.";

    // 3. Initiate the response with tool calling
    let currentResponse: OpenAI.Responses.Response = await openai.responses.create({
      model: "gpt-4.1-mini",
      instructions,
      input: trimmedMessage,
      tools: openAiTools,
    });

    const MAX_TOOL_ROUNDS = 5;
    let rounds = 0;

    // 4. Handle tool-call continuation loop (bounded)
    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;

      // Check if OpenAI requested any function tool calls
      const toolCalls = currentResponse.output.filter(
        (item): item is { type: "function_call"; call_id: string; name: string; arguments: string } =>
          item.type === "function_call"
      );

      if (toolCalls.length === 0) {
        // No further tool calls requested; model has produced final answer
        break;
      }

      const toolOutputs: Array<{
        type: "function_call_output";
        call_id: string;
        output: string;
      }> = [];

      for (const call of toolCalls) {
        if (call.name !== "get_farmer_records") {
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({ error: `Tool ${call.name} is not supported.` }),
          });
          continue;
        }

        let parsedArgs: Record<string, unknown> = {};
        try {
          if (call.arguments) {
            parsedArgs = JSON.parse(call.arguments);
          }
        } catch {
          // Default to empty args
        }

        // Execute tool call via MCP client
        const mcpResult = await client.callTool({
          name: "get_farmer_records",
          arguments: parsedArgs,
        });

        if (mcpResult.isError) {
          const errText = Array.isArray(mcpResult.content)
            ? mcpResult.content
                .map((c: unknown) =>
                  typeof c === "object" && c !== null && "text" in c ? String((c as { text: unknown }).text) : ""
                )
                .join("\n")
            : "MCP tool returned an error.";
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify({ error: errText }),
          });
        } else {
          const textContent = Array.isArray(mcpResult.content)
            ? mcpResult.content
                .map((c: unknown) =>
                  typeof c === "object" && c !== null && "text" in c ? String((c as { text: unknown }).text) : ""
                )
                .join("\n")
            : "[]";
          toolOutputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: textContent,
          });
        }
      }

      // 5. Send tool outputs back to OpenAI continuation flow
      currentResponse = await openai.responses.create({
        model: "gpt-4.1-mini",
        previous_response_id: currentResponse.id,
        input: toolOutputs,
      });
    }

    const finalAnswer = currentResponse.output_text || "I was unable to generate an answer.";

    res.json({
      answer: finalAnswer,
      success: true,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "An unexpected server error occurred.";
    console.error("Chat error:", errorMsg);

    res.status(500).json({
      success: false,
      error: errorMsg.includes("API key")
        ? "AI service authentication error. Please verify server configuration."
        : errorMsg,
    });
  }
});

const serverInstance = app.listen(PORT, () => {
  console.log(`Farmer AI backend running on http://localhost:${PORT}`);
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  serverInstance.close(() => {
    console.log("HTTP server closed.");
  });
  await mcpManager.close();
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
