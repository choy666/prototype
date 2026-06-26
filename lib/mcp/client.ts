import { performance } from 'node:perf_hooks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ToolResultContent } from '@modelcontextprotocol/sdk/types.js';
import mcpConfig from '@/mcp/config.json';

interface CallMcpToolParams {
  server: keyof typeof mcpConfig.mcpServers;
  tool: string;
  args?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface McpCallResult {
  rawContent: string;
  truncated: boolean;
  durationMs: number;
}

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_OUTPUT_LENGTH = 12000;

export async function callMcpTool({
  server,
  tool,
  args,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: CallMcpToolParams): Promise<McpCallResult> {
  const serverConfig = mcpConfig.mcpServers[server];
  if (!serverConfig) {
    throw new Error(`Servidor MCP no configurado: ${server}`);
  }

  const client = new Client(
    { name: 'prototype-admin-dashboard', version: '1.0.0' },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args,
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
    stderr: 'inherit',
  });

  const startTime = performance.now();
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      reject(new Error(`Tiempo de espera excedido (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  try {
    await transport.start();
    await client.connect(transport);

    const response = await Promise.race([
      client.callTool({ name: tool, arguments: args ?? {} }),
      timeoutPromise,
    ]);

    const contentBlocks = Array.isArray(response.content)
      ? response.content
      : ([] as ToolResultContent[]);
    const textParts: string[] = [];
    for (const block of contentBlocks) {
      if (
        block &&
        block.type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string'
      ) {
        textParts.push((block as { text: string }).text);
      }
    }

    const raw = textParts.join('\n\n');
    const truncated = raw.length > MAX_OUTPUT_LENGTH;
    const safeOutput = truncated
      ? `${raw.slice(0, MAX_OUTPUT_LENGTH)}\n\n[Contenido truncado…]`
      : raw;

    return {
      rawContent: safeOutput,
      truncated,
      durationMs: Math.round(performance.now() - startTime),
    };
  } finally {
    await transport.close().catch(() => undefined);
  }
}
