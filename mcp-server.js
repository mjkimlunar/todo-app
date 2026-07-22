import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { listTodos } from './db.js';
import { computeSummary } from './stats.js';

const server = new McpServer({ name: 'todo-mcp', version: '0.1.0' });

server.tool(
  'list_todos',
  '할 일 목록을 조회한다. 검색어/태그/오늘마감/완료여부로 필터링 가능.',
  {
    search: z.string().optional().describe('제목에 포함된 검색어'),
    tag: z.string().optional().describe('이 태그를 가진 항목만'),
    today: z.boolean().optional().describe('오늘 마감인 항목만'),
    completed: z.boolean().optional().describe('완료 여부로 필터'),
  },
  async ({ search, tag, today, completed }) => {
    const todos = await listTodos({ search, tag, today, completed });
    return { content: [{ type: 'text', text: JSON.stringify(todos, null, 2) }] };
  },
);

server.tool(
  'todo_summary',
  '전체/완료/마감 지남 개수와 우선순위·태그별 집계를 반환한다.',
  {},
  async () => {
    const todos = await listTodos({});
    const summary = computeSummary(todos);
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
