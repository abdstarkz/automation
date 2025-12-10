// src/types/workflow.types.ts

// All supported node types in the canvas
export type NodeType =
  // Triggers
  | 'trigger_manual'
  | 'trigger_schedule'
  | 'trigger_webhook'
  | 'trigger_health'
  | 'trigger_chat_error'
  // Google Workspace
  | 'google_sheets_read'
  | 'google_sheets_write'
  | 'google_gmail_send'
  | 'google_calendar_create'
  // Messaging
  | 'discord_send'
  | 'telegram_send'
  | 'slack_send'
  | 'whatsapp_send'
  // AI Models
  | 'ai_chatgpt'
  | 'ai_claude'
  | 'ai_gemini'
  // Logic & Control
  | 'if_else'
  | 'switch'
  | 'loop'
  | 'filter'
  | 'delay'
  | 'wait'
  | 'sub_workflow'
  | 'error_handler'
  // Data / HTTP
  | 'http_request'
  | 'json_parse'
  | 'data_transform'
  // Notion
  | 'notion_create_page'
  | 'notion_update_db'
  // Social & Dev
  | 'meta_facebook_post'
  | 'meta_instagram_post'
  | 'x_tweet'
  | 'github_issue_create'
  | 'linkedin_share'
  | 'jira_issue_create'
  | 'youtube_upload'
  | 'gdrive_upload'
  | 'spotify_playlist_add'
  // Commerce
  | 'amazon_order_trigger'
  | 'flipkart_order_trigger';

export interface NodeData {
  label: string;
  type: NodeType;
  config?: Record<string, any>;
  icon?: React.ReactNode;
  color?: string;
  variant?: 'default' | 'schedule' | 'loop';
}

import React from 'react';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  nodes: any[];
  edges: any[];
  color: string;

}

export type NodeParameterSchema = Record<
  string,
  {
    type: 'string' | 'text' | 'select';
    label: string;
    placeholder?: string;
    description?: string;
    required?: boolean;
    default?: string;
    options?: string[];
  }
>;

/**
 * Parameter definitions for each node type shown in NodeConfigPanel.
 * Only include keys that need configuration – triggers without options can be empty.
 */
export const NODE_PARAMETERS: Partial<Record<NodeType, NodeParameterSchema>> = {
  // ───────────────────── Triggers ─────────────────────
  trigger_manual: {
    label: {
      type: 'string',
      label: 'Label',
      placeholder: 'Manual trigger',
    },
  },
  trigger_schedule: {
    cronExpression: {
      type: 'string',
      label: 'Cron Expression',
      placeholder: '0 9 * * MON',
      description: 'E.g. "0 9 * * MON" for 9 AM every Monday',
      required: true,
    },
    timezone: {
      type: 'select',
      label: 'Timezone',
      options: ['UTC', 'IST', 'EST', 'CST', 'MST', 'PST'],
      default: 'UTC',
    },
  },
  trigger_webhook: {
    webhookUrl: {
      type: 'string',
      label: 'Webhook URL',
      placeholder: 'Generated automatically when saving workflow',
      description: 'You can copy this URL and use it as a webhook target.',
    },
  },
  trigger_health: {
    eventType: {
      type: 'select',
      label: 'Event Type',
      options: ['heart_rate_high', 'steps_goal_reached', 'sleep_low'],
      required: true,
    },
  },
  trigger_chat_error: {
    app: {
      type: 'select',
      label: 'Chat App',
      options: ['Slack', 'Discord', 'WhatsApp', 'Telegram'],
      required: true,
    },
    errorType: {
      type: 'select',
      label: 'Error Type',
      options: ['delivery_failed', 'rate_limited', 'bot_unavailable', 'other'],
      required: true,
    },
  },

  // ───────────────────── Google Sheets ─────────────────────
  google_sheets_read: {
    spreadsheetId: {
      type: 'string',
      label: 'Spreadsheet ID',
      placeholder: 'Google Sheet ID',
      required: true,
    },
    range: {
      type: 'string',
      label: 'Range',
      placeholder: 'Sheet1!A1:Z100',
      required: true,
    },
  },
  google_sheets_write: {
    spreadsheetId: {
      type: 'string',
      label: 'Spreadsheet ID',
      placeholder: 'Google Sheet ID',
      required: true,
    },
    range: {
      type: 'string',
      label: 'Range',
      placeholder: 'Sheet1!A1',
      required: true,
    },
    data: {
      type: 'text',
      label: 'Data (JSON)',
      placeholder: '[["Header1","Header2"],["Value1","Value2"]]',
      required: true,
    },
    append: {
      type: 'select',
      label: 'Mode',
      options: ['Write (Replace)', 'Append'],
      default: 'Write (Replace)',
    },
  },

  // ───────────────────── Gmail ─────────────────────
  google_gmail_send: {
    to: {
      type: 'string',
      label: 'To Email',
      placeholder: 'recipient@example.com',
      required: true,
    },
    subject: {
      type: 'string',
      label: 'Subject',
      placeholder: 'Email subject',
      required: true,
    },
    body: {
      type: 'text',
      label: 'Message Body',
      placeholder: 'Email content',
      required: true,
    },
    cc: {
      type: 'string',
      label: 'CC (optional)',
      placeholder: 'cc@example.com',
    },
  },

  // ───────────────────── Calendar ─────────────────────
  google_calendar_create: {
    summary: {
      type: 'string',
      label: 'Event Title',
      placeholder: 'Meeting with team',
      required: true,
    },
    startTime: {
      type: 'string',
      label: 'Start Time (ISO 8601)',
      placeholder: '2025-01-15T10:00:00',
      required: true,
    },
    endTime: {
      type: 'string',
      label: 'End Time (ISO 8601)',
      placeholder: '2025-01-15T11:00:00',
      required: true,
    },
    description: {
      type: 'text',
      label: 'Description',
    },
  },

  // ───────────────────── Messaging ─────────────────────
  discord_send: {
    webhookUrl: {
      type: 'string',
      label: 'Webhook URL',
      placeholder: 'https://discord.com/api/webhooks/…',
      required: true,
    },
    content: {
      type: 'text',
      label: 'Message',
      required: true,
    },
  },
  telegram_send: {
    chatId: {
      type: 'string',
      label: 'Chat ID',
      placeholder: '123456789',
      required: true,
    },
    message: {
      type: 'text',
      label: 'Message',
      required: true,
    },
    parseMode: {
      type: 'select',
      label: 'Parse Mode',
      options: ['HTML', 'Markdown', 'MarkdownV2'],
      default: 'HTML',
    },
  },
  slack_send: {
    channel: {
      type: 'string',
      label: 'Channel',
      placeholder: '#general or @user',
      required: true,
    },
    text: {
      type: 'text',
      label: 'Message',
      required: true,
    },
  },
  whatsapp_send: {
    to: {
      type: 'string',
      label: 'To (phone without whatsapp:)',
      placeholder: '+919876543210',
      required: true,
    },
    message: {
      type: 'text',
      label: 'Message',
      required: true,
    },
  },

  // ───────────────────── AI Models ─────────────────────
  ai_chatgpt: {
    prompt: {
      type: 'text',
      label: 'Prompt',
      placeholder: 'What would you like to ask?',
      required: true,
    },
    model: {
      type: 'select',
      label: 'Model',
      options: ['gpt-4.1-mini', 'gpt-4.1'], // add others if you like
      default: 'gpt-4.1-mini',
    },
    temperature: {
      type: 'string',
      label: 'Temperature',
      default: '0.7',
      description: '0–1, higher = more creative,lower = more precise.',
    },
    maxTokens: {
      type: 'string',
      label: 'Max Tokens',
      default: '1000',
    },
  },
  ai_claude: {
    prompt: {
      type: 'text',
      label: 'Prompt',
      required: true,
    },
    model: {
      type: 'select',
      label: 'Model',
      options: [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ],
      default: 'claude-3-sonnet-20240229',
    },
    maxTokens: {
      type: 'string',
      label: 'Max Tokens',
      default: '1000',
    },
  },
// src/types/workflow.types.ts
  ai_gemini: {
    model: {
      label: 'Model',
      type: 'select',
      required: false,
      options: [
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.5-pro-001',
        'gemini-1.5-flash-001',
        'gemini-pro',
        'gemini-pro-vision',
        'gemini-2.5-pro',
        'gemini-2.5-flash',
      ],
      default: 'gemini-1.5-flash',
      description: 'Choose a Gemini model. Flash is cheaper & faster.',
    },
    prompt: {
      label: 'Prompt',
      type: 'text',
      required: true,
      placeholder: 'Ask Gemini to summarize, generate, etc…',
    },
    maxTokens: {
      label: 'Max tokens',
      type: 'string',
      required: false,
      default: '1024',
    },
    temperature: {
      label: 'Temperature',
      type: 'string',
      required: false,
      default: '0.7',
    },
  },

  // ───────────────────── Logic & Control ─────────────────────
  if_else: {
    condition: {
      type: 'string',
      label: 'Condition (expression)',
      placeholder: '{{$json.value}}',
      required: true,
    },
    operator: {
      type: 'select',
      label: 'Operator',
      options: ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
      required: true,
    },
    compareTo: {
      type: 'string',
      label: 'Compare to (optional)',
      placeholder: '42',
    },
  },
  switch: {
    expression: {
      type: 'text',
      label: 'Switch expression',
      placeholder: '{{$json.status}}',
      required: true,
    },
    cases: {
      type: 'text',
      label: 'Cases (JSON map)',
      placeholder: '{"success":"branchA","error":"branchB"}',
      description: 'Maps values to branch labels.',
      required: true,
    },
  },
  loop: {
    iterations: {
      type: 'string',
      label: 'Iterations',
      placeholder: '5',
      default: '1',
      required: true,
    },
  },
  filter: {
    condition: {
      type: 'string',
      label: 'Filter condition',
      placeholder: '{{$json.amount}} > 1000',
      required: true,
    },
  },
  delay: {
    seconds: {
      type: 'string',
      label: 'Delay (seconds)',
      default: '5',
      required: true,
    },
  },
  wait: {
    seconds: {
      type: 'string',
      label: 'Wait (seconds)',
      default: '60',
      required: true,
    },
    untilTime: {
      type: 'string',
      label: 'Or until time (ISO, optional)',
      placeholder: '2025-01-01T09:00:00Z',
    },
  },
  sub_workflow: {
    workflowId: {
      type: 'string',
      label: 'Sub-workflow ID',
      required: true,
    },
    waitForCompletion: {
      type: 'select',
      label: 'Wait for completion',
      options: ['yes', 'no'],
      default: 'yes',
    },
  },
  error_handler: {
    onError: {
      type: 'select',
      label: 'On error',
      options: ['retry', 'stop_workflow', 'send_notification', 'branch'],
      required: true,
    },
    maxRetries: {
      type: 'string',
      label: 'Max retries (if retry)',
      default: '3',
    },
  },

  // ───────────────────── Data / HTTP ─────────────────────
  http_request: {
    url: {
      type: 'string',
      label: 'URL',
      placeholder: 'https://api.example.com/endpoint',
      required: true,
    },
    method: {
      type: 'select',
      label: 'Method',
      options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      default: 'GET',
    },
    body: {
      type: 'text',
      label: 'Request body (JSON)',
      placeholder: '{"key":"value"}',
    },
  },
  json_parse: {
    jsonString: {
      type: 'text',
      label: 'JSON string',
      placeholder: '{"data":"value"}',
      required: true,
    },
  },
  data_transform: {
    input: {
      type: 'text',
      label: 'Input data',
      required: true,
    },
    transformation: {
      type: 'text',
      label: 'Transformation logic',
      placeholder: 'Describe how to transform',
      required: true,
    },
  },

  // ───────────────────── Notion ─────────────────────
  notion_create_page: {
    databaseId: {
      type: 'string',
      label: 'Database ID',
      required: true,
    },
    title: {
      type: 'string',
      label: 'Page title',
      required: true,
    },
  },
  notion_update_db: {
    pageId: {
      type: 'string',
      label: 'Page ID',
      required: true,
    },
    properties: {
      type: 'text',
      label: 'Properties (JSON)',
      placeholder:
        '{"Title":{"title":[{"text":{"content":"Updated"}}]}}',
      required: true,
    },
  },

  // ───────────────────── Social & Dev ─────────────────────
  meta_facebook_post: {
    pageId: {
      type: 'string',
      label: 'Page ID',
      required: true,
    },
    message: {
      type: 'text',
      label: 'Message',
      required: true,
    },
    link: {
      type: 'string',
      label: 'Link (optional)',
    },
  },
  meta_instagram_post: {
    igBusinessId: {
      type: 'string',
      label: 'Instagram Business ID',
      required: true,
    },
    caption: {
      type: 'text',
      label: 'Caption',
      required: true,
    },
    mediaUrl: {
      type: 'string',
      label: 'Media URL',
      required: true,
    },
  },
  x_tweet: {
    text: {
      type: 'text',
      label: 'Tweet text',
      required: true,
    },
  },
  github_issue_create: {
    repo: {
      type: 'string',
      label: 'Repository',
      placeholder: 'owner/repo',
      required: true,
    },
    title: {
      type: 'string',
      label: 'Issue title',
      required: true,
    },
    body: {
      type: 'text',
      label: 'Issue body',
    },
  },
  linkedin_share: {
    profileOrOrgId: {
      type: 'string',
      label: 'Profile / Org ID',
      required: true,
    },
    text: {
      type: 'text',
      label: 'Post text',
      required: true,
    },
    link: {
      type: 'string',
      label: 'Link (optional)',
    },
  },
  jira_issue_create: {
    projectKey: {
      type: 'string',
      label: 'Project key',
      required: true,
    },
    summary: {
      type: 'string',
      label: 'Summary',
      required: true,
    },
    description: {
      type: 'text',
      label: 'Description',
    },
    issueType: {
      type: 'string',
      label: 'Issue type',
      default: 'Task',
    },
  },
  youtube_upload: {
    title: {
      type: 'string',
      label: 'Video title',
      required: true,
    },
    description: {
      type: 'text',
      label: 'Description',
    },
    videoUrl: {
      type: 'string',
      label: 'Source video URL',
      required: true,
    },
    privacy: {
      type: 'select',
      label: 'Privacy',
      options: ['public', 'unlisted', 'private'],
      default: 'unlisted',
    },
  },
  gdrive_upload: {
    folderId: {
      type: 'string',
      label: 'Folder ID',
      required: true,
    },
    fileUrl: {
      type: 'string',
      label: 'File URL',
      required: true,
    },
    fileName: {
      type: 'string',
      label: 'File name',
      required: true,
    },
  },
  spotify_playlist_add: {
    playlistId: {
      type: 'string',
      label: 'Playlist ID',
      required: true,
    },
    trackUri: {
      type: 'string',
      label: 'Track URI',
      placeholder: 'spotify:track:…',
      required: true,
    },
  },

  // ───────────────────── Commerce ─────────────────────
  amazon_order_trigger: {
    storeName: {
      type: 'string',
      label: 'Store name',
      required: true,
    },
    eventType: {
      type: 'select',
      label: 'Event',
      options: ['order_created', 'order_shipped', 'order_cancelled'],
      default: 'order_created',
    },
  },
  flipkart_order_trigger: {
    storeName: {
      type: 'string',
      label: 'Store name',
      required: true,
    },
    eventType: {
      type: 'select',
      label: 'Event',
      options: ['order_created', 'order_shipped', 'order_cancelled'],
      default: 'order_created',
    },
  },
};
