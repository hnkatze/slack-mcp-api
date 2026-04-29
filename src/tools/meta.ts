import { z } from 'zod';
import type { SlackClients } from '../slack-client.js';
import { resolveUserByQuery } from '../user-cache.js';

let cachedUserIdentity: { user_id: string; user: string; team_id: string; team: string } | null = null;
let cachedBotIdentity: { user_id: string; user: string; team_id: string; team: string } | null = null;

export async function getMyIdentity(clients: SlackClients) {
  if (!cachedUserIdentity) {
    const res = (await clients.user.auth.test()) as {
      user_id: string;
      user: string;
      team_id: string;
      team: string;
      url: string;
    };
    cachedUserIdentity = {
      user_id: res.user_id,
      user: res.user,
      team_id: res.team_id,
      team: res.team,
    };
  }
  return cachedUserIdentity;
}

async function getBotIdentity(clients: SlackClients) {
  if (!cachedBotIdentity) {
    if (clients.bot === clients.user) {
      cachedBotIdentity = await getMyIdentity(clients);
    } else {
      const res = (await clients.bot.auth.test()) as {
        user_id: string;
        user: string;
        team_id: string;
        team: string;
      };
      cachedBotIdentity = {
        user_id: res.user_id,
        user: res.user,
        team_id: res.team_id,
        team: res.team,
      };
    }
  }
  return cachedBotIdentity;
}

export const whoamiSchema = {};

export async function whoami(clients: SlackClients, _args: Record<string, never>) {
  const me = await getMyIdentity(clients);
  const bot = await getBotIdentity(clients);
  return {
    user_token_identity: me,
    bot_token_identity: bot,
    note:
      clients.bot === clients.user
        ? 'Only one token configured — same identity for both.'
        : 'Bot and user identities differ. "is_mine" in message tools refers to user_token_identity.',
  };
}

export const getDmWithSchema = {
  user: z
    .string()
    .describe('User ID (U…), email, display name, or real name. Resolves automatically.'),
};

export async function getDmWith(
  clients: SlackClients,
  args: { user: string },
) {
  const target = await resolveUserByQuery(clients.user, args.user);
  const me = await getMyIdentity(clients);

  let cursor: string | undefined;
  do {
    const res = await clients.user.conversations.list({
      types: 'im',
      limit: 1000,
      ...(cursor !== undefined && { cursor }),
    });
    for (const c of res.channels ?? []) {
      if (c.user === target.id) {
        return { channel_id: c.id, user: target, my_user_id: me.user_id };
      }
    }
    cursor = res.response_metadata?.next_cursor || undefined;
  } while (cursor);

  const opened = await clients.user.conversations.open({ users: target.id });
  return {
    channel_id: opened.channel?.id,
    user: target,
    my_user_id: me.user_id,
    note: 'No prior DM existed — just opened a new one.',
  };
}

export const resolveUserSchema = {
  query: z.string().describe('User ID, email, display name, or real name'),
};

export async function resolveUser(clients: SlackClients, args: { query: string }) {
  return resolveUserByQuery(clients.user, args.query);
}
