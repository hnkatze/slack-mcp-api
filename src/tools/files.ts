import { z } from 'zod';
import type { SlackClients } from '../slack-client.js';

export const uploadFileSchema = {
  channel_id: z.string().describe('Channel to share the file in'),
  content: z.string().describe('File content as text'),
  filename: z.string(),
  title: z.string().optional(),
  initial_comment: z.string().optional(),
  thread_ts: z.string().optional(),
};

export async function uploadFile(
  clients: SlackClients,
  args: {
    channel_id: string;
    content: string;
    filename: string;
    title?: string;
    initial_comment?: string;
    thread_ts?: string;
  },
) {
  const payload = {
    channel_id: args.channel_id,
    content: args.content,
    filename: args.filename,
    ...(args.title !== undefined && { title: args.title }),
    ...(args.initial_comment !== undefined && { initial_comment: args.initial_comment }),
    ...(args.thread_ts !== undefined && { thread_ts: args.thread_ts }),
  };
  const res = (await clients.bot.files.uploadV2(payload as never)) as {
    ok: boolean;
    files?: unknown;
  };
  return { ok: res.ok, files: res.files };
}

export const getFileInfoSchema = {
  file: z.string().describe('File ID (F…)'),
};

export async function getFileInfo(clients: SlackClients, args: { file: string }) {
  const res = await clients.user.files.info({ file: args.file });
  return { file: res.file, content: res.content };
}

export const deleteFileSchema = {
  file: z.string(),
};

export async function deleteFile(clients: SlackClients, args: { file: string }) {
  const res = await clients.user.files.delete({ file: args.file });
  return { ok: res.ok };
}
