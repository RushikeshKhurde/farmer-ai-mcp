import dotenv from "dotenv";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import mysql from "mysql2/promise";

dotenv.config({ path: resolve(".env"), quiet: true });

const REQUIRED_MYSQL_ENV_VARS = [
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "MYSQL_DATABASE",
] as const;

function getMissingMysqlEnvVars(): string[] {
  return REQUIRED_MYSQL_ENV_VARS.filter((name) => {
    const value = process.env[name]?.trim();
    return !value || value === "your_mysql_password_here";
  });
}

const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

const server = new McpServer({
  name: "sanjivani-farmer-server",
  version: "1.0.0",
});

server.tool(
  "get_farmer_records",
  "Fetch all farmer records from the MySQL database.",
  {},
  async () => {
    const missingVars = getMissingMysqlEnvVars();
    if (missingVars.length > 0) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Missing or placeholder MySQL environment variable(s): ${missingVars.join(", ")}. Please configure them in .env.`,
        }],
      };
    }

    try {
      const [rows] = await db.query(`
        SELECT id, name, village, sugarcane_supply_tonnes,
               amount_pending, amount_paid
        FROM farmers
        ORDER BY id
      `);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(rows),
        }],
      };
    } catch (error) {
      const errCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : undefined;
      const errMsg =
        error instanceof Error
          ? error.message
          : "Database query failed";
      const prefix = errCode
        ? `Database connection/query failed (${errCode})`
        : "Database connection/query failed";

      return {
        isError: true,
        content: [{
          type: "text",
          text: `${prefix}: ${errMsg}. Verify MySQL is running and check MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE in .env.`,
        }],
      };
    }
  }
);

process.stdin.on("close", () => {
  void db.end().catch(() => {});
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(
    "MCP server fatal error:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
