import dotenv from "dotenv";
import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

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
      `Please set real values in C:\\Users\\Asus\\farmer-ai-mcp\\.env (see .env.example).`
    );
  }

  const port = Number(process.env.MYSQL_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(
      `Invalid MYSQL_PORT value in .env. Expected a valid TCP port number (e.g. 3306 or 3307).`
    );
  }
}

const client = new Client({
  name: "sanjivani-farmer-ai-client",
  version: "1.0.0",
});

function createMcpTransport(): StdioClientTransport {
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

async function main() {
  try {
    validateEnvironment();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const transport = createMcpTransport();
    try {
      await client.connect(transport);
    } catch (connError) {
      const msg =
        connError instanceof Error ? connError.message : String(connError);
      throw new Error(`Failed to start or connect to MCP server: ${msg}`);
    }
    console.log("Connected to MCP server.");

    const { tools } = await client.listTools();
    console.log("Available tools:", tools.map(t => t.name));

    const result = await client.callTool({
      name: "get_farmer_records",
      arguments: {},
    });

    if (!Array.isArray(result.content)) {
      throw new Error("MCP response content is invalid.");
    }

    const records = result.content
      .map((item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        item.type === "text" &&
        "text" in item &&
        typeof item.text === "string"
          ? item.text
          : ""
      )
      .filter(Boolean)
      .join("\n");

    if (result.isError) {
      throw new Error(
        `MCP tool "get_farmer_records" failed: ${records || "Unknown MCP tool error."}`
      );
    }

    let parsedRecords: unknown;
    try {
      parsedRecords = JSON.parse(records);
    } catch {
      throw new Error("MCP tool returned malformed JSON data.");
    }

    if (!Array.isArray(parsedRecords)) {
      throw new Error("MCP tool did not return an array of farmer records.");
    }

    console.log(`Retrieved ${parsedRecords.length} farmer records from MySQL.`);

    const question =
      "Which farmer has the highest pending amount? " +
      "What are the total pending and total paid amounts?";

    let response;
    try {
      response = await openai.responses.create({
        model: "gpt-4.1-mini",
        instructions:
          "Use only the supplied farmer records. Calculate totals carefully. " +
          "Use INR for monetary amounts and do not invent data.",
        input: `Question: ${question}\n\nFarmer records:\n${records}`,
      });
    } catch (apiError) {
      const status =
        typeof apiError === "object" && apiError !== null && "status" in apiError
          ? ` (HTTP ${String((apiError as { status?: unknown }).status)})`
          : "";
      const message =
        apiError instanceof Error ? apiError.message : String(apiError);
      throw new Error(
        `OpenAI API call failed${status}: ${message}. Verify that OPENAI_API_KEY in .env is valid and has access to model "gpt-4.1-mini".`
      );
    }

    console.log("\nQuestion:", question);
    console.log("\nAI Answer:\n", response.output_text);
  } catch (error) {
    console.error(
      "Application error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exitCode = 1;
  } finally {
    try {
      await client.close();
    } catch {
      // Ignore close errors if client was not connected
    }
  }
}

main();
