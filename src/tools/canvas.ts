import { z } from 'zod';
import type { SlackClients } from '../slack-client.js';

export const createCanvasSchema = {
  title: z.string().describe('Title of the canvas'),
  markdown: z.string().describe('Canvas content in markdown format'),
  channel_id: z
    .string()
    .optional()
    .describe('If set, creates a channel canvas instead of a standalone canvas'),
};

export async function createCanvas(
  clients: SlackClients,
  args: { title: string; markdown: string; channel_id?: string },
) {
  if (args.channel_id) {
    const res = (await clients.user.apiCall('conversations.canvases.create', {
      channel_id: args.channel_id,
      document_content: { type: 'markdown', markdown: args.markdown },
    })) as { ok: boolean; canvas_id?: string };
    return { ok: res.ok, canvas_id: res.canvas_id };
  }

  const res = (await clients.user.apiCall('canvases.create', {
    title: args.title,
    document_content: { type: 'markdown', markdown: args.markdown },
  })) as { ok: boolean; canvas_id?: string };
  return { ok: res.ok, canvas_id: res.canvas_id };
}

export const editCanvasSchema = {
  canvas_id: z.string().describe('Canvas ID (F…)'),
  operation: z
    .enum(['insert_at_end', 'insert_at_start', 'insert_after', 'insert_before', 'replace', 'delete'])
    .describe('Edit operation type'),
  markdown: z.string().optional().describe('Markdown content (required for insert/replace)'),
  section_id: z
    .string()
    .optional()
    .describe('Target section ID for insert_after/insert_before/replace/delete'),
};

export async function editCanvas(
  clients: SlackClients,
  args: {
    canvas_id: string;
    operation: 'insert_at_end' | 'insert_at_start' | 'insert_after' | 'insert_before' | 'replace' | 'delete';
    markdown?: string;
    section_id?: string;
  },
) {
  const change: Record<string, unknown> = { operation: args.operation };
  if (args.markdown !== undefined) {
    change['document_content'] = { type: 'markdown', markdown: args.markdown };
  }
  if (args.section_id !== undefined) {
    change['section_id'] = args.section_id;
  }

  const res = (await clients.user.apiCall('canvases.edit', {
    canvas_id: args.canvas_id,
    changes: [change],
  })) as { ok: boolean };
  return { ok: res.ok };
}

export const getCanvasSchema = {
  canvas_id: z.string().describe('Canvas ID (F…)'),
};

export async function getCanvas(
  clients: SlackClients,
  args: { canvas_id: string },
) {
  const res = (await clients.user.apiCall('canvases.sections.lookup', {
    canvas_id: args.canvas_id,
    criteria: { contains_text: '' },
  })) as { ok: boolean; sections?: unknown[] };

  const fileInfo = await clients.user.files.info({ file: args.canvas_id });

  return {
    canvas_id: args.canvas_id,
    title: fileInfo.file?.title,
    url: fileInfo.file?.permalink,
    sections: res.sections,
    file: fileInfo.file,
  };
}

export const deleteCanvasSchema = {
  canvas_id: z.string(),
};

export async function deleteCanvas(
  clients: SlackClients,
  args: { canvas_id: string },
) {
  const res = (await clients.user.apiCall('canvases.delete', {
    canvas_id: args.canvas_id,
  })) as { ok: boolean };
  return { ok: res.ok };
}

export const setCanvasAccessSchema = {
  canvas_id: z.string(),
  access_level: z.enum(['read', 'write', 'none']),
  channel_ids: z.array(z.string()).optional(),
  user_ids: z.array(z.string()).optional(),
};

export async function setCanvasAccess(
  clients: SlackClients,
  args: {
    canvas_id: string;
    access_level: 'read' | 'write' | 'none';
    channel_ids?: string[];
    user_ids?: string[];
  },
) {
  const payload: Record<string, unknown> = {
    canvas_id: args.canvas_id,
    access_level: args.access_level,
  };
  if (args.channel_ids) payload['channel_ids'] = args.channel_ids;
  if (args.user_ids) payload['user_ids'] = args.user_ids;

  const res = (await clients.user.apiCall('canvases.access.set', payload)) as { ok: boolean };
  return { ok: res.ok };
}

export const lookupCanvasSectionsSchema = {
  canvas_id: z.string(),
  contains_text: z.string().describe('Text to search for within sections'),
};

export async function lookupCanvasSections(
  clients: SlackClients,
  args: { canvas_id: string; contains_text: string },
) {
  const res = (await clients.user.apiCall('canvases.sections.lookup', {
    canvas_id: args.canvas_id,
    criteria: { contains_text: args.contains_text },
  })) as { ok: boolean; sections?: unknown[] };
  return { sections: res.sections };
}
