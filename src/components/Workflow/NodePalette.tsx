// src/components/Workflow/NodePalette.tsx
import { memo, useState, useMemo } from 'react';
import {
  Activity,
  Clock,
  GitBranch,
  MessageCircle,
  MessageSquare,
  Code2,
  Database,
  Globe2,
  PlayCircle,
  Search,
  X,
  Brain,
  FileText,
  ShoppingCart,
} from 'lucide-react';
import type { NodeType } from '@/types/workflow.types';

type PaletteNode = {
  label: string;
  type: NodeType;
  icon?: React.ReactNode;
  color?: string;
};

type Group = {
  id: string;
  label: string;
  nodes: PaletteNode[];
};

const groups: Group[] = [
  {
    id: 'triggers',
    label: 'Triggers',
    nodes: [
      {
        label: 'Manual Trigger',
        type: 'trigger_manual',
        color: '#22c55e',
        icon: <PlayCircle className="w-3 h-3" />,
      },
      {
        label: 'Schedule Trigger',
        type: 'trigger_schedule',
        color: '#0ea5e9',
        icon: <Clock className="w-3 h-3" />,
      },
      {
        label: 'Webhook Trigger',
        type: 'trigger_webhook',
        color: '#f97316',
        icon: <GitBranch className="w-3 h-3" />,
      },
      {
        label: 'Health Trigger',
        type: 'trigger_health',
        color: '#10b981',
        icon: <Activity className="w-3 h-3" />,
      },
      {
        label: 'Chat Error Trigger',
        type: 'trigger_chat_error',
        color: '#ec4899',
        icon: <MessageCircle className="w-3 h-3" />,
      },
    ],
  },
  {
    id: 'google',
    label: 'Google Workspace',
    nodes: [
      { label: 'Sheets Read', type: 'google_sheets_read', color: '#22c55e', icon: <FileText className="w-3 h-3" /> },
      { label: 'Sheets Write', type: 'google_sheets_write', color: '#16a34a', icon: <FileText className="w-3 h-3" /> },
      { label: 'Gmail Send', type: 'google_gmail_send', color: '#ef4444', icon: <MessageSquare className="w-3 h-3" /> },
      {
        label: 'Calendar Event',
        type: 'google_calendar_create',
        color: '#3b82f6',
        icon: <Clock className="w-3 h-3" />,
      },
    ],
  },
  {
    id: 'messaging',
    label: 'Messaging',
    nodes: [
      { label: 'Slack Send', type: 'slack_send', color: '#4ade80', icon: <MessageSquare className="w-3 h-3" /> },
      { label: 'Telegram Send', type: 'telegram_send', color: '#0ea5e9', icon: <MessageSquare className="w-3 h-3" /> },
      { label: 'Discord Send', type: 'discord_send', color: '#6366f1', icon: <MessageSquare className="w-3 h-3" /> },
      { label: 'WhatsApp Send', type: 'whatsapp_send', color: '#22c55e', icon: <MessageSquare className="w-3 h-3" /> },
    ],
  },
  {
    id: 'ai',
    label: 'AI Models',
    nodes: [
      { label: 'ChatGPT', type: 'ai_chatgpt', color: '#22c55e', icon: <Brain className="w-3 h-3" /> },
      { label: 'Claude', type: 'ai_claude', color: '#8b5cf6', icon: <Brain className="w-3 h-3" /> },
      { label: 'Gemini', type: 'ai_gemini', color: '#0ea5e9', icon: <Brain className="w-3 h-3" /> },
    ],
  },
  {
    id: 'logic',
    label: 'Logic & Control',
    nodes: [
      { label: 'If / Else', type: 'if_else', color: '#6366f1', icon: <GitBranch className="w-3 h-3" /> },
      { label: 'Switch', type: 'switch', color: '#a855f7', icon: <GitBranch className="w-3 h-3" /> },
      { label: 'Loop', type: 'loop', color: '#22c55e', icon: <Clock className="w-3 h-3" /> },
      { label: 'Wait', type: 'wait', color: '#f59e0b', icon: <Clock className="w-3 h-3" /> },
      { label: 'Delay', type: 'delay', color: '#f97316', icon: <Clock className="w-3 h-3" /> },
      { label: 'Filter', type: 'filter', color: '#64748b', icon: <Code2 className="w-3 h-3" /> },
      { label: 'Sub-workflow', type: 'sub_workflow', color: '#0ea5e9', icon: <GitBranch className="w-3 h-3" /> },
      { label: 'Error Handler', type: 'error_handler', color: '#ef4444', icon: <X className="w-3 h-3" /> },
    ],
  },
  {
    id: 'data',
    label: 'Data & HTTP',
    nodes: [
      { label: 'HTTP Request', type: 'http_request', color: '#0ea5e9', icon: <Globe2 className="w-3 h-3" /> },
      { label: 'JSON Parse', type: 'json_parse', color: '#64748b', icon: <Code2 className="w-3 h-3" /> },
      { label: 'Data Transform', type: 'data_transform', color: '#22c55e', icon: <Code2 className="w-3 h-3" /> },
    ],
  },
  {
    id: 'notion',
    label: 'Notion',
    nodes: [
      {
        label: 'Create Page',
        type: 'notion_create_page',
        color: '#111827',
        icon: <FileText className="w-3 h-3" />,
      },
      { label: 'Update DB', type: 'notion_update_db', color: '#4b5563', icon: <Database className="w-3 h-3" /> },
    ],
  },
  {
    id: 'social',
    label: 'Social & Dev',
    nodes: [
      {
        label: 'Facebook Post',
        type: 'meta_facebook_post',
        color: '#1877f2',
        icon: <MessageSquare className="w-3 h-3" />,
      },
      {
        label: 'Instagram Post',
        type: 'meta_instagram_post',
        color: '#e1306c',
        icon: <MessageSquare className="w-3 h-3" />,
      },
      { label: 'X Tweet', type: 'x_tweet', color: '#000000', icon: <MessageSquare className="w-3 h-3" /> },
      {
        label: 'GitHub Issue',
        type: 'github_issue_create',
        color: '#111827',
        icon: <GitBranch className="w-3 h-3" />,
      },
      {
        label: 'LinkedIn Share',
        type: 'linkedin_share',
        color: '#0a66c2',
        icon: <MessageSquare className="w-3 h-3" />,
      },
      { label: 'Jira Ticket', type: 'jira_issue_create', color: '#2684ff', icon: <FileText className="w-3 h-3" /> },
      {
        label: 'YouTube Upload',
        type: 'youtube_upload',
        color: '#ff0000',
        icon: <PlayCircle className="w-3 h-3" />,
      },
      {
        label: 'Drive Upload',
        type: 'gdrive_upload',
        color: '#0f9d58',
        icon: <FileText className="w-3 h-3" />,
      },
      {
        label: 'Spotify Playlist',
        type: 'spotify_playlist_add',
        color: '#1db954',
        icon: <PlayCircle className="w-3 h-3" />,
      },
    ],
  },
  {
    id: 'commerce',
    label: 'E-commerce',
    nodes: [
      {
        label: 'Amazon Order Trigger',
        type: 'amazon_order_trigger',
        color: '#ff9900',
        icon: <ShoppingCart className="w-3 h-3" />,
      },
      {
        label: 'Flipkart Order Trigger',
        type: 'flipkart_order_trigger',
        color: '#2874f0',
        icon: <ShoppingCart className="w-3 h-3" />,
      },
    ],
  },
];

const groupIcon: Record<string, JSX.Element> = {
  triggers: <PlayCircle className="w-3 h-3" />,
  google: <Activity className="w-3 h-3" />,
  messaging: <MessageSquare className="w-3 h-3" />,
  ai: <Brain className="w-3 h-3" />,
  logic: <GitBranch className="w-3 h-3" />,
  data: <Database className="w-3 h-3" />,
  notion: <FileText className="w-3 h-3" />,
  social: <Globe2 className="w-3 h-3" />,
  commerce: <ShoppingCart className="w-3 h-3" />,
};


export const NodePalette = memo(function NodePalette() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;

    const q = searchQuery.toLowerCase();
    return groups.map(group => ({
      ...group,
      nodes: group.nodes.filter(node =>
        node.label.toLowerCase().includes(q) ||
        node.type.toLowerCase().includes(q)
      )
    })).filter(group => group.nodes.length > 0);
  }, [searchQuery]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    triggers: true,
    google: true,
  });

  const handleDragStart =
    (node: PaletteNode) => (event: React.DragEvent<HTMLDivElement>) => {
      event.dataTransfer.setData(
        'application/reactflow',
        JSON.stringify(node)
      );
      event.dataTransfer.effectAllowed = 'move';
    };

  return (
    <div className="space-y-3">
        <div className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes..."
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs font-semibold text-slate-700">Node Library</p>
          <p className="text-[11px] text-slate-400">
            Tip: drag a node onto the canvas, then click it to configure.
          </p>
        </div>
      </div>

      {filteredGroups.map((group) => {
        const isOpen = expanded[group.id] ?? false;
        return (
          <div key={group.id} className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setExpanded((prev) => ({
                  ...prev,
                  [group.id]: !isOpen,
                }))
              }
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors duration-150 border-b border-slate-200"
            >
              <span className="inline-flex items-center gap-2">
                {groupIcon[group.id] ?? (
                  <Clock className="w-3 h-3 text-slate-400" />
                )}
                {group.label}
              </span>
              <span className="text-[10px] text-slate-400">
                {isOpen ? '▴' : '▾'}
              </span>
            </button>

            {isOpen && (
              <div className="divide-y divide-slate-100">
                {group.nodes.map((node) => (
                  <div
                    key={node.label}
                    draggable
                    onDragStart={handleDragStart(node)}
                    className="px-3 py-2 text-xs flex items-center justify-between cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors duration-150"
                  >
                    <span className="flex items-center gap-2">
                      {node.icon && <span className="flex-shrink-0">{node.icon}</span>}
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: node.color || '#6366f1' }}
                      />
                      {node.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
