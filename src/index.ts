#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSlackClients } from './slack-client.js';
import * as messages from './tools/messages.js';
import * as channels from './tools/channels.js';
import * as canvas from './tools/canvas.js';
import * as users from './tools/users.js';
import * as files from './tools/files.js';
import * as meta from './tools/meta.js';

const clients = createSlackClients();

const server = new McpServer({
  name: 'slack-mcp',
  version: '0.1.0',
});

const wrap =
  <T extends Record<string, unknown>>(fn: (c: typeof clients, args: T) => Promise<unknown>) =>
  async (args: T) => {
    try {
      const data = await fn(clients, args);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  };

server.tool(
  'slack_whoami',
  'Get the current user/bot identity (user_id, team, etc). Use this FIRST in any session to know who "I" am — needed to interpret is_mine flags correctly.',
  meta.whoamiSchema,
  wrap(meta.whoami),
);
server.tool(
  'slack_resolve_user',
  'Resolve a user by ID, email, display name, or real name. Returns canonical user info. Cached after first lookup.',
  meta.resolveUserSchema,
  wrap(meta.resolveUser),
);
server.tool(
  'slack_get_dm_with',
  'Get the DM channel ID between YOU (user token identity) and another user. Accepts user ID, email, or name. Use this instead of slack_open_dm when you want to read the existing DM history with someone.',
  meta.getDmWithSchema,
  wrap(meta.getDmWith),
);

server.tool('slack_send_message', 'Post a message to a channel, DM, or thread', messages.sendMessageSchema, wrap(messages.sendMessage));
server.tool('slack_update_message', 'Edit an existing message', messages.updateMessageSchema, wrap(messages.updateMessage));
server.tool('slack_delete_message', 'Delete a message', messages.deleteMessageSchema, wrap(messages.deleteMessage));
server.tool('slack_get_history', 'Read messages from a channel', messages.getHistorySchema, wrap(messages.getHistory));
server.tool('slack_get_thread', 'Read all replies in a thread', messages.getThreadSchema, wrap(messages.getThread));
server.tool('slack_add_reaction', 'Add an emoji reaction to a message', messages.addReactionSchema, wrap(messages.addReaction));
server.tool('slack_search_messages', 'Search messages across the workspace', messages.searchMessagesSchema, wrap(messages.searchMessages));

server.tool('slack_list_channels', 'List channels in the workspace', channels.listChannelsSchema, wrap(channels.listChannels));
server.tool('slack_get_channel_info', 'Get channel metadata', channels.getChannelInfoSchema, wrap(channels.getChannelInfo));
server.tool('slack_create_channel', 'Create a new channel', channels.createChannelSchema, wrap(channels.createChannel));
server.tool('slack_invite_to_channel', 'Invite users to a channel', channels.inviteToChannelSchema, wrap(channels.inviteToChannel));
server.tool('slack_archive_channel', 'Archive a channel', channels.archiveChannelSchema, wrap(channels.archiveChannel));
server.tool('slack_set_topic', 'Set the channel topic', channels.setTopicSchema, wrap(channels.setTopic));
server.tool('slack_set_purpose', 'Set the channel purpose', channels.setPurposeSchema, wrap(channels.setPurpose));
server.tool('slack_get_channel_members', 'List members of a channel', channels.getChannelMembersSchema, wrap(channels.getChannelMembers));

server.tool('slack_create_canvas', 'Create a standalone or channel canvas with markdown content', canvas.createCanvasSchema, wrap(canvas.createCanvas));
server.tool('slack_edit_canvas', 'Edit a canvas (insert, replace, or delete sections)', canvas.editCanvasSchema, wrap(canvas.editCanvas));
server.tool('slack_get_canvas', 'Read a canvas content and metadata', canvas.getCanvasSchema, wrap(canvas.getCanvas));
server.tool('slack_delete_canvas', 'Delete a canvas', canvas.deleteCanvasSchema, wrap(canvas.deleteCanvas));
server.tool('slack_set_canvas_access', 'Manage who can read/write a canvas', canvas.setCanvasAccessSchema, wrap(canvas.setCanvasAccess));
server.tool('slack_lookup_canvas_sections', 'Find sections in a canvas matching text', canvas.lookupCanvasSectionsSchema, wrap(canvas.lookupCanvasSections));

server.tool('slack_list_users', 'List workspace users', users.listUsersSchema, wrap(users.listUsers));
server.tool('slack_get_user_info', 'Get user profile info', users.getUserInfoSchema, wrap(users.getUserInfo));
server.tool('slack_lookup_user_by_email', 'Find a user by email', users.lookupUserByEmailSchema, wrap(users.lookupUserByEmail));
server.tool('slack_open_dm', 'Open a DM channel with one or more users', users.openDMSchema, wrap(users.openDM));

server.tool('slack_upload_file', 'Upload a file to a channel', files.uploadFileSchema, wrap(files.uploadFile));
server.tool('slack_get_file_info', 'Get file metadata and content', files.getFileInfoSchema, wrap(files.getFileInfo));
server.tool('slack_delete_file', 'Delete a file', files.deleteFileSchema, wrap(files.deleteFile));

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('slack-mcp server running on stdio');
