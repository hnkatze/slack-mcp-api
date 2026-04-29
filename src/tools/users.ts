import { z } from 'zod';
import type { SlackClients } from '../slack-client.js';

export const listUsersSchema = {
  limit: z.number().min(1).max(1000).default(200),
  cursor: z.string().optional(),
};

export async function listUsers(
  clients: SlackClients,
  args: { limit?: number; cursor?: string },
) {
  const res = await clients.user.users.list({
    limit: args.limit ?? 200,
    ...(args.cursor !== undefined && { cursor: args.cursor }),
  });
  return { members: res.members, next_cursor: res.response_metadata?.next_cursor };
}

export const getUserInfoSchema = {
  user: z.string().describe('User ID (U…)'),
};

export async function getUserInfo(clients: SlackClients, args: { user: string }) {
  const res = await clients.user.users.info({ user: args.user });
  return res.user;
}

export const lookupUserByEmailSchema = {
  email: z.string().email(),
};

export async function lookupUserByEmail(
  clients: SlackClients,
  args: { email: string },
) {
  const res = await clients.user.users.lookupByEmail({ email: args.email });
  return res.user;
}

export const openDMSchema = {
  users: z.string().describe('Comma-separated user IDs'),
};

export async function openDM(clients: SlackClients, args: { users: string }) {
  const res = await clients.bot.conversations.open({ users: args.users });
  return res.channel;
}
