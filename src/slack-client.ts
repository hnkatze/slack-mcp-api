import { WebClient } from '@slack/web-api';

export interface SlackClients {
  bot: WebClient;
  user: WebClient;
}

export function createSlackClients(): SlackClients {
  const botToken = process.env['SLACK_BOT_TOKEN'];
  const userToken = process.env['SLACK_USER_TOKEN'];

  if (!botToken) {
    throw new Error('SLACK_BOT_TOKEN environment variable is required');
  }

  const bot = new WebClient(botToken);
  const user = userToken ? new WebClient(userToken) : bot;

  return { bot, user };
}
