import { z } from 'zod';
import type { SlackClients } from '../slack-client.js';
import { resolveMentions, resolveUserById } from '../user-cache.js';
import { getMyIdentity } from './meta.js';

interface SlackMessage {
  ts?: string;
  user?: string;
  bot_id?: string;
  username?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  files?: Array<{ id?: string; name?: string; mimetype?: string }>;
  reactions?: Array<{ name?: string; count?: number; users?: string[] }>;
  subtype?: string;
}

async function compactMessage(
  clients: SlackClients,
  msg: SlackMessage,
  myUserId: string,
) {
  const text = await resolveMentions(clients.user, msg.text ?? '');
  const userId = msg.user ?? msg.bot_id ?? '';
  const author = userId ? await resolveUserById(clients.user, userId) : null;
  const files = (msg.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimetype: f.mimetype,
  }));
  const reactions = (msg.reactions ?? []).map((r) => ({
    name: r.name,
    count: r.count,
  }));

  return {
    ts: msg.ts,
    user_id: userId || undefined,
    user: author?.name ?? msg.username ?? userId ?? 'unknown',
    is_mine: userId === myUserId || undefined,
    text,
    ...(files.length > 0 && { files }),
    ...(reactions.length > 0 && { reactions }),
    ...(msg.thread_ts !== undefined && msg.thread_ts !== msg.ts && { thread_ts: msg.thread_ts }),
    ...(msg.reply_count !== undefined && msg.reply_count > 0 && { reply_count: msg.reply_count }),
    ...(msg.subtype !== undefined && { subtype: msg.subtype }),
  };
}

export const sendMessageSchema = {
  channel: z.string().describe('Channel ID (C…) or user ID (U…) for DM'),
  text: z.string().describe('Message text (supports Slack mrkdwn)'),
  thread_ts: z.string().optional().describe('Reply to thread by parent ts'),
  blocks: z.array(z.record(z.unknown())).optional().describe('Block Kit blocks'),
};

export async function sendMessage(
  clients: SlackClients,
  args: { channel: string; text: string; thread_ts?: string; blocks?: Array<Record<string, unknown>> },
) {
  const res = await clients.bot.chat.postMessage({
    channel: args.channel,
    text: args.text,
    ...(args.thread_ts !== undefined && { thread_ts: args.thread_ts }),
    ...(args.blocks !== undefined && { blocks: args.blocks as never }),
  });
  return { ok: res.ok, ts: res.ts, channel: res.channel };
}

export const updateMessageSchema = {
  channel: z.string(),
  ts: z.string().describe('Timestamp of the message to update'),
  text: z.string(),
  blocks: z.array(z.record(z.unknown())).optional(),
};

export async function updateMessage(
  clients: SlackClients,
  args: { channel: string; ts: string; text: string; blocks?: Array<Record<string, unknown>> },
) {
  const res = await clients.bot.chat.update({
    channel: args.channel,
    ts: args.ts,
    text: args.text,
    ...(args.blocks !== undefined && { blocks: args.blocks as never }),
  });
  return { ok: res.ok, ts: res.ts };
}

export const deleteMessageSchema = {
  channel: z.string(),
  ts: z.string(),
};

export async function deleteMessage(
  clients: SlackClients,
  args: { channel: string; ts: string },
) {
  const res = await clients.bot.chat.delete({ channel: args.channel, ts: args.ts });
  return { ok: res.ok };
}

export const getHistorySchema = {
  channel: z.string(),
  limit: z.number().min(1).max(1000).default(50),
  oldest: z.string().optional().describe('Start of time range (ts)'),
  latest: z.string().optional().describe('End of time range (ts)'),
  cursor: z.string().optional(),
  compact: z
    .boolean()
    .default(true)
    .describe('Strip thumbnails/blocks/metadata, resolve mentions and user IDs to names. Highly recommended.'),
};

export async function getHistory(
  clients: SlackClients,
  args: {
    channel: string;
    limit?: number;
    oldest?: string;
    latest?: string;
    cursor?: string;
    compact?: boolean;
  },
) {
  const res = await clients.user.conversations.history({
    channel: args.channel,
    limit: args.limit ?? 50,
    ...(args.oldest !== undefined && { oldest: args.oldest }),
    ...(args.latest !== undefined && { latest: args.latest }),
    ...(args.cursor !== undefined && { cursor: args.cursor }),
  });

  const messages = res.messages ?? [];
  if (args.compact === false) {
    return {
      messages,
      has_more: res.has_more,
      next_cursor: res.response_metadata?.next_cursor,
    };
  }

  const me = await getMyIdentity(clients);
  const compact = await Promise.all(
    messages.map((m) => compactMessage(clients, m as SlackMessage, me.user_id)),
  );
  return {
    messages: compact,
    has_more: res.has_more,
    next_cursor: res.response_metadata?.next_cursor,
    my_user_id: me.user_id,
  };
}

export const getThreadSchema = {
  channel: z.string(),
  thread_ts: z.string(),
  limit: z.number().min(1).max(1000).default(100),
  compact: z.boolean().default(true),
};

export async function getThread(
  clients: SlackClients,
  args: { channel: string; thread_ts: string; limit?: number; compact?: boolean },
) {
  const res = await clients.user.conversations.replies({
    channel: args.channel,
    ts: args.thread_ts,
    limit: args.limit ?? 100,
  });

  const messages = res.messages ?? [];
  if (args.compact === false) {
    return { messages, has_more: res.has_more };
  }

  const me = await getMyIdentity(clients);
  const compact = await Promise.all(
    messages.map((m) => compactMessage(clients, m as SlackMessage, me.user_id)),
  );
  return { messages: compact, has_more: res.has_more, my_user_id: me.user_id };
}

export const addReactionSchema = {
  channel: z.string(),
  timestamp: z.string(),
  name: z.string().describe('Emoji name without colons (e.g. "thumbsup")'),
};

export async function addReaction(
  clients: SlackClients,
  args: { channel: string; timestamp: string; name: string },
) {
  const res = await clients.bot.reactions.add(args);
  return { ok: res.ok };
}

export const searchMessagesSchema = {
  query: z.string().describe('Slack search query (supports operators like in:, from:, has:)'),
  count: z.number().min(1).max(100).default(20),
  sort: z.enum(['score', 'timestamp']).default('score'),
  compact: z.boolean().default(true),
};

export async function searchMessages(
  clients: SlackClients,
  args: { query: string; count?: number; sort?: 'score' | 'timestamp'; compact?: boolean },
) {
  const res = await clients.user.search.messages({
    query: args.query,
    count: args.count ?? 20,
    sort: args.sort ?? 'score',
  });

  const matches = res.messages?.matches ?? [];
  if (args.compact === false) {
    return { matches, total: res.messages?.total };
  }

  const me = await getMyIdentity(clients);
  const compact = await Promise.all(
    matches.map(async (m) => {
      const base = await compactMessage(clients, m as SlackMessage, me.user_id);
      const channel = (m as { channel?: { id?: string; name?: string } }).channel;
      const permalink = (m as { permalink?: string }).permalink;
      return {
        ...base,
        ...(channel?.id !== undefined && { channel_id: channel.id }),
        ...(channel?.name !== undefined && { channel_name: channel.name }),
        ...(permalink !== undefined && { permalink }),
      };
    }),
  );
  return { matches: compact, total: res.messages?.total, my_user_id: me.user_id };
}
