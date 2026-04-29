import type { WebClient } from '@slack/web-api';

export interface ResolvedUser {
  id: string;
  name: string;
  real_name?: string;
  email?: string;
  is_bot?: boolean;
  deleted?: boolean;
}

const userCache = new Map<string, ResolvedUser>();
let directoryLoaded = false;

const USER_ID_RE = /^[UWB][A-Z0-9]{4,}$/;
const MENTION_RE = /<@([UWB][A-Z0-9]+)(?:\|([^>]+))?>/g;

function buildEntry(u: NonNullable<Awaited<ReturnType<WebClient['users']['info']>>['user']>): ResolvedUser {
  const profile = u.profile ?? {};
  const name =
    profile.display_name?.trim() ||
    u.real_name ||
    profile.real_name?.trim() ||
    u.name ||
    u.id ||
    'unknown';
  return {
    id: u.id ?? '',
    name,
    ...(u.real_name !== undefined && { real_name: u.real_name }),
    ...(profile.email !== undefined && { email: profile.email }),
    ...(u.is_bot !== undefined && { is_bot: u.is_bot }),
    ...(u.deleted !== undefined && { deleted: u.deleted }),
  };
}

export async function resolveUserById(
  client: WebClient,
  userId: string,
): Promise<ResolvedUser> {
  const cached = userCache.get(userId);
  if (cached) return cached;
  try {
    const res = await client.users.info({ user: userId });
    if (!res.user) throw new Error(`User ${userId} not found`);
    const entry = buildEntry(res.user);
    userCache.set(entry.id, entry);
    return entry;
  } catch {
    const fallback: ResolvedUser = { id: userId, name: userId };
    userCache.set(userId, fallback);
    return fallback;
  }
}

async function loadDirectory(client: WebClient): Promise<void> {
  if (directoryLoaded) return;
  let cursor: string | undefined;
  do {
    const res = await client.users.list({
      limit: 1000,
      ...(cursor !== undefined && { cursor }),
    });
    for (const m of res.members ?? []) {
      if (!m.id) continue;
      userCache.set(m.id, buildEntry(m));
    }
    cursor = res.response_metadata?.next_cursor || undefined;
  } while (cursor);
  directoryLoaded = true;
}

export async function resolveUserByQuery(
  client: WebClient,
  query: string,
): Promise<ResolvedUser> {
  const trimmed = query.trim();

  if (USER_ID_RE.test(trimmed)) {
    return resolveUserById(client, trimmed);
  }

  if (trimmed.includes('@') && trimmed.includes('.')) {
    try {
      const res = await client.users.lookupByEmail({ email: trimmed });
      if (res.user) {
        const entry = buildEntry(res.user);
        userCache.set(entry.id, entry);
        return entry;
      }
    } catch {
      // fall through to name search
    }
  }

  await loadDirectory(client);
  const lower = trimmed.toLowerCase();

  for (const u of userCache.values()) {
    if (u.deleted) continue;
    if (u.name.toLowerCase() === lower) return u;
  }
  for (const u of userCache.values()) {
    if (u.deleted) continue;
    if (u.real_name?.toLowerCase() === lower) return u;
  }
  for (const u of userCache.values()) {
    if (u.deleted) continue;
    const haystack = `${u.name} ${u.real_name ?? ''} ${u.email ?? ''}`.toLowerCase();
    if (haystack.includes(lower)) return u;
  }

  throw new Error(`No user found matching "${query}"`);
}

export async function resolveMentions(
  client: WebClient,
  text: string,
): Promise<string> {
  if (!text) return text;
  const matches = [...text.matchAll(MENTION_RE)];
  if (matches.length === 0) return text;

  const ids = [...new Set(matches.map((m) => m[1]).filter((id): id is string => Boolean(id)))];
  await Promise.all(ids.map((id) => resolveUserById(client, id)));

  return text.replace(MENTION_RE, (_, id: string, fallback?: string) => {
    const entry = userCache.get(id);
    return `@${entry?.name ?? fallback ?? id}`;
  });
}

export function clearUserCache(): void {
  userCache.clear();
  directoryLoaded = false;
}
