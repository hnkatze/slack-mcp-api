# slack-mcp-api

MCP server for Slack with **full API coverage and LLM-aware ergonomics**. Canvases, messages, channels, search, files — and the context features that turn raw API output into something an LLM can actually reason over.

## Why this exists

Most Slack MCPs are thin API wrappers. That isn't enough for an LLM. It needs:

1. **To know who "I" am** — without that it can't tell *my* messages from anyone else's
2. **Names, not opaque IDs** — `<@U03NMFNURJM>` is useless; `@Gustavo Martinez` is workable
3. **Compact payloads** — Slack returns 12 thumbnail variants per image, blocks, edited metadata… 80% noise
4. **One-call answers to common questions** — *"the DM with X"* shouldn't require listing 70 IMs

This server solves all four.

## Tools

### Identity & lookup
- `slack_whoami` — current user + bot identity (call first in a session)
- `slack_resolve_user` — by ID, email, display name, or real name
- `slack_get_dm_with` — DM channel between you and another user

### Messages
- `slack_send_message` — post to channel / DM / thread
- `slack_update_message`
- `slack_delete_message`
- `slack_get_history` — channel history (compact by default)
- `slack_get_thread` — thread replies (compact by default)
- `slack_search_messages` — workspace-wide search (compact by default)
- `slack_add_reaction`

### Channels
- `slack_list_channels`
- `slack_get_channel_info`
- `slack_create_channel`
- `slack_invite_to_channel`
- `slack_archive_channel`
- `slack_set_topic` / `slack_set_purpose`
- `slack_get_channel_members`

### Canvas
- `slack_create_canvas` — standalone or channel canvas
- `slack_edit_canvas` — insert / replace / delete sections
- `slack_get_canvas`
- `slack_delete_canvas`
- `slack_set_canvas_access`
- `slack_lookup_canvas_sections`

### Users
- `slack_list_users`
- `slack_get_user_info`
- `slack_lookup_user_by_email`
- `slack_open_dm`

### Files
- `slack_upload_file`
- `slack_get_file_info`
- `slack_delete_file`

## Compact mode

Default ON for `slack_get_history`, `slack_get_thread`, and `slack_search_messages`. Each message becomes:

- `text` — `<@Uxxx>` mentions resolved inline to `@Name`
- `user` — display name (not just the ID)
- `is_mine` — `true` when the message belongs to the user-token identity
- `files` — reduced to `{ id, name, mimetype }` (no thumbnails)
- `reactions` — reduced to `{ name, count }`
- redundant fields stripped

Pass `compact: false` to get the raw Slack response.

## Install

### From GitHub (recommended)

```bash
# global install — exposes the `slack-mcp` command
npm install -g github:hnkatze/slack-mcp-api

# or run on demand without installing
npx -y github:hnkatze/slack-mcp-api
```

The `prepare` script compiles TypeScript on install — no prebuilt artifacts are committed.

### From source

```bash
git clone https://github.com/hnkatze/slack-mcp-api.git
cd slack-mcp-api
npm install
npm run build
npm link    # exposes `slack-mcp` globally
```

## Setup

### 1. Create a Slack app

Go to <https://api.slack.com/apps> → **Create New App** → From scratch.

### 2. Add scopes

**Bot Token Scopes** (`OAuth & Permissions`):

```
channels:history    channels:read       channels:manage
groups:history      groups:read         groups:write
im:history          im:read             im:write
mpim:history        mpim:read           mpim:write
chat:write          chat:write.public
reactions:write     files:read          files:write
users:read          users:read.email
canvases:read       canvases:write
```

**User Token Scopes** (needed for `search:read` and full canvas access):

```
search:read         channels:history    groups:history
im:history          mpim:history
canvases:read       canvases:write
```

### 3. Install to workspace

OAuth & Permissions → **Install to Workspace** → copy the bot token (`xoxb-…`) and user token (`xoxp-…`).

### 4. Configure your MCP client

Globally installed:

```json
{
  "mcpServers": {
    "slack": {
      "command": "slack-mcp",
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-…",
        "SLACK_USER_TOKEN": "xoxp-…"
      }
    }
  }
}
```

With `npx` (no install):

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "github:hnkatze/slack-mcp-api"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-…",
        "SLACK_USER_TOKEN": "xoxp-…"
      }
    }
  }
}
```

Pointing to a local build:

```json
{
  "mcpServers": {
    "slack": {
      "command": "node",
      "args": ["/absolute/path/to/slack-mcp-api/dist/index.js"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-…",
        "SLACK_USER_TOKEN": "xoxp-…"
      }
    }
  }
}
```

## Recommended flow for clients

1. Call `slack_whoami` once at session start. Cache the `user_id`.
2. To work with a person: `slack_get_dm_with(user: "Gustavo Martinez")` → `channel_id`.
3. Read the DM: `slack_get_history(channel: <channel_id>)` → compact payload, names resolved, `is_mine` flagged.
4. To act on a specific message, use the `ts` from the compact response.

## Notes

- `SLACK_BOT_TOKEN` is required. `SLACK_USER_TOKEN` is optional but unlocks search, name-based user lookups, and full canvas read access.
- Bot tokens cannot search messages — Slack platform limitation.
- Canvas API requires the workspace to be on a paid plan with canvases enabled.
- The user directory is cached in memory the first time a name lookup runs. Restart the server to refresh.

## License

MIT
