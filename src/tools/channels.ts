import { z } from 'zod';
import type { SlackClients } from '../slack-client.js';

export const listChannelsSchema = {
  types: z
    .string()
    .default('public_channel,private_channel')
    .describe('Comma-separated: public_channel, private_channel, mpim, im'),
  limit: z.number().min(1).max(1000).default(200),
  cursor: z.string().optional(),
  exclude_archived: z.boolean().default(true),
};

export async function listChannels(
  clients: SlackClients,
  args: { types?: string; limit?: number; cursor?: string; exclude_archived?: boolean },
) {
  const res = await clients.user.conversations.list({
    types: args.types ?? 'public_channel,private_channel',
    limit: args.limit ?? 200,
    exclude_archived: args.exclude_archived ?? true,
    ...(args.cursor !== undefined && { cursor: args.cursor }),
  });
  return {
    channels: res.channels,
    next_cursor: res.response_metadata?.next_cursor,
  };
}

export const getChannelInfoSchema = {
  channel: z.string(),
  include_num_members: z.boolean().default(true),
};

export async function getChannelInfo(
  clients: SlackClients,
  args: { channel: string; include_num_members?: boolean },
) {
  const res = await clients.user.conversations.info({
    channel: args.channel,
    include_num_members: args.include_num_members ?? true,
  });
  return res.channel;
}

export const createChannelSchema = {
  name: z.string().describe('Channel name (lowercase, no spaces)'),
  is_private: z.boolean().default(false),
};

export async function createChannel(
  clients: SlackClients,
  args: { name: string; is_private?: boolean },
) {
  const res = await clients.user.conversations.create({
    name: args.name,
    is_private: args.is_private ?? false,
  });
  return res.channel;
}

export const inviteToChannelSchema = {
  channel: z.string(),
  users: z.string().describe('Comma-separated user IDs'),
};

export async function inviteToChannel(
  clients: SlackClients,
  args: { channel: string; users: string },
) {
  const res = await clients.user.conversations.invite(args);
  return { ok: res.ok, channel: res.channel };
}

export const archiveChannelSchema = {
  channel: z.string(),
};

export async function archiveChannel(
  clients: SlackClients,
  args: { channel: string },
) {
  const res = await clients.user.conversations.archive(args);
  return { ok: res.ok };
}

export const setTopicSchema = {
  channel: z.string(),
  topic: z.string(),
};

export async function setTopic(
  clients: SlackClients,
  args: { channel: string; topic: string },
) {
  const res = (await clients.bot.conversations.setTopic(args)) as {
    ok: boolean;
    topic?: string;
  };
  return { ok: res.ok, topic: res.topic };
}

export const setPurposeSchema = {
  channel: z.string(),
  purpose: z.string(),
};

export async function setPurpose(
  clients: SlackClients,
  args: { channel: string; purpose: string },
) {
  const res = (await clients.bot.conversations.setPurpose(args)) as {
    ok: boolean;
    purpose?: string;
  };
  return { ok: res.ok, purpose: res.purpose };
}

export const getChannelMembersSchema = {
  channel: z.string(),
  limit: z.number().min(1).max(1000).default(200),
  cursor: z.string().optional(),
};

export async function getChannelMembers(
  clients: SlackClients,
  args: { channel: string; limit?: number; cursor?: string },
) {
  const res = await clients.user.conversations.members({
    channel: args.channel,
    limit: args.limit ?? 200,
    ...(args.cursor !== undefined && { cursor: args.cursor }),
  });
  return { members: res.members, next_cursor: res.response_metadata?.next_cursor };
}
