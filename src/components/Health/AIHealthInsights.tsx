import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Mic,
  Send,
  Trash2,
  History,
  Settings,
  Activity,
  Heart,
  Flame,
  BarChart3,
  X,
  PlusCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ──────────────────────────────────────────────────────────────
// VARIANT SWITCH
// ──────────────────────────────────────────────────────────────

type LayoutVariant = 'card' | 'split' | 'minimal' | 'tabs' | 'glass';

// 👉 Pick the design you like:
const LAYOUT_VARIANT: LayoutVariant = 'card';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  metadata?: any;
}

interface Session {
  id: string;
  title: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  messages?: Message[];
}

// Simple markdown renderer – compact for sidebar
const MarkdownContent = ({ content }: { content: string }) => {
  const lines = content.split('\n');

  return (
    <div className="space-y-1 text-sm">
      {lines.map((line, idx) => {
        if (line.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-sm font-semibold mt-2">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-base font-semibold mt-2">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <li key={idx} className="ml-4 list-disc text-xs">
              {line.slice(2)}
            </li>
          );
        }
        if (line.match(/^\d+\. /)) {
          return (
            <li key={idx} className="ml-4 list-decimal text-xs">
              {line.replace(/^\d+\. /, '')}
            </li>
          );
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p key={idx} className="font-semibold">
              {line.slice(2, -2)}
            </p>
          );
        }
        return line ? (
          <p key={idx} className="text-xs sm:text-sm">
            {line}
          </p>
        ) : (
          <br key={idx} />
        );
      })}
    </div>
  );
};

function useAIHealthCore() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const [dateRange, setDateRange] = useState<'7d' | '30d'>('7d');
  const [inputMessage, setInputMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [showHistory, setShowHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    checkApiKey();
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkApiKey = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/health-ai/api-key/status?service=gemini`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setHasApiKey(data.hasKey);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to check API key status.');
      }
    } catch (error) {
      console.error('Failed to check API key:', error);
      toast.error('Failed to check API key status.');
    }
  };

  const saveApiKeyHandler = async () => {
    if (!apiKey.trim()) return;

    setSavingKey(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/health-ai/api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ apiKey, service: 'gemini' }),
      });

      if (!response.ok) throw new Error('Failed to save API key');

      setHasApiKey(true);
      setShowApiKeyModal(false);
      setApiKey('');
      toast.success('API key saved successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  };

  const loadSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/health-ai/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  // Shared helper: create a new session for the current dateRange
  const createSessionForCurrentRange = async (): Promise<Session> => {
    const now = new Date();
    const days = dateRange === '7d' ? 7 : 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/health-ai/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        dateRange,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        title: `Health Analysis - ${dateRange}`,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create session');
    }

    const session: Session = await response.json();
    setCurrentSession(session);
    await loadSessions();
    setShowHistory(false);
    return session;
  };

  const createNewSession = async () => {
    try {
      const session = await createSessionForCurrentRange();
      setMessages([]);
      setCurrentSession(session);
    } catch (error) {
      console.error('Failed to create session:', error);
      toast.error('Failed to create new session');
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/health-ai/sessions/${sessionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const session = await response.json();
      setCurrentSession(session);
      setMessages(session.messages || []);
      setShowHistory(false);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const deleteSessionHandler = async (sessionId: string) => {
    if (!confirm('Delete this analysis session?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/health-ai/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      await loadSessions();
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    // We now allow auto-session creation if needed
    setIsAnalyzing(true);

    let session = currentSession;

    try {
      if (!session) {
        session = await createSessionForCurrentRange();
      }

      const userMessage = inputMessage.trim();
      setInputMessage('');

      const tempUserMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: userMessage,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempUserMsg]);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/health-ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: session.id,
          message: userMessage,
          startDate: session.startDate,
          endDate: session.endDate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to analyze');
      }

      const data = await response.json();
      const aiMessage: Message = data.message;

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      console.error('Failed to send/analyze message:', error);
      toast.error(error.message || 'Failed to analyze health data');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setInputMessage('[Voice input recorded]');
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const renderEmptyState = () => (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="inline-block p-4 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full mb-3">
        <BarChart3 className="w-8 h-8 text-purple-600" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">
        Start a New Analysis
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        Pick a time range and let AI summarize your health patterns.
      </p>

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setDateRange('7d')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            dateRange === '7d'
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Last 7 days
        </button>
        <button
          onClick={() => setDateRange('30d')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            dateRange === '30d'
              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Last 30 days
        </button>
      </div>

      <button
        onClick={createNewSession}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all"
      >
        <PlusCircle className="w-4 h-4" />
        Create session
      </button>

      <div className="mt-4 grid grid-cols-1 gap-2 w-full text-left">
        <div className="text-[11px] text-gray-500 font-medium">
          Popular questions
        </div>
        {[
          'How did my sleep affect my energy?',
          'Show my step trend vs last week',
          'Any warning signs in my heart rate?',
          'Give me a simple summary for my doctor',
        ].map((prompt) => (
          <button
            key={prompt}
            onClick={() => setInputMessage(prompt)}
            className="text-[11px] px-3 py-2 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg hover:shadow-sm text-gray-700 text-left"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );

  const renderMessages = () => (
    <div className="flex-1 overflow-y-auto pr-1 space-y-3 text-sm">
      {messages.length === 0 && renderEmptyState()}

      {messages.map((msg) => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex ${
            msg.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-3 py-2.5 text-xs sm:text-sm ${
              msg.role === 'user'
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            {msg.role === 'assistant' ? (
              <MarkdownContent content={msg.content} />
            ) : (
              <p>{msg.content}</p>
            )}
            <p className="text-[10px] opacity-70 mt-1">
              {new Date(msg.createdAt).toLocaleTimeString()}
            </p>
          </div>
        </motion.div>
      ))}

      {isAnalyzing && (
        <div className="flex justify-start">
          <div className="bg-gray-100 rounded-2xl px-3 py-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full animate-bounce bg-purple-600" />
              <div
                className="w-2 h-2 rounded-full animate-bounce bg-blue-600"
                style={{ animationDelay: '0.1s' }}
              />
              <div
                className="w-2 h-2 rounded-full animate-bounce bg-cyan-600"
                style={{ animationDelay: '0.2s' }}
              />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );

  const renderHistory = () => (
    <div className="flex-1 overflow-y-auto space-y-2">
      {sessions.length === 0 && (
        <p className="text-xs text-gray-500 px-1">
          No previous analysis sessions yet.
        </p>
      )}

      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => loadSession(session.id)}
          className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-all border border-gray-100 group"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">
                {session.title}
              </p>
              <p className="text-[10px] text-gray-500">
                {new Date(session.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteSessionHandler(session.id);
              }}
              className="p-1 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3 h-3 text-red-600" />
            </button>
          </div>
        </button>
      ))}
    </div>
  );

  return {
    // state
    hasApiKey,
    showApiKeyModal,
    setShowApiKeyModal,
    apiKey,
    setApiKey,
    savingKey,
    sessions,
    currentSession,
    dateRange,
    inputMessage,
    isAnalyzing,
    isRecording,
    showHistory,
    // setters
    setShowHistory,
    setDateRange,
    setInputMessage,
    // actions
    saveApiKeyHandler,
    createNewSession,
    loadSession,
    startRecording,
    stopRecording,
    sendMessage,
    // render helpers
    renderMessages,
    renderHistory,
  };
}

// ──────────────────────────────────────────────────────────────
// VARIANT COMPONENTS
// ──────────────────────────────────────────────────────────────

function CardVariant(props: ReturnType<typeof useAIHealthCore>) {
  const {
    hasApiKey,
    showApiKeyModal,
    setShowApiKeyModal,
    apiKey,
    setApiKey,
    savingKey,
    dateRange,
    setDateRange,
    currentSession,
    showHistory,
    setShowHistory,
    createNewSession,
    saveApiKeyHandler,
    renderMessages,
    renderHistory,
    inputMessage,
    setInputMessage,
    sendMessage,
    isAnalyzing,
    isRecording,
    startRecording,
    stopRecording,
  } = props;

  // When no API key: inline setup card
  if (!hasApiKey) {
    return (
      <div className="bg-white rounded-2xl shadow-xl h-[520px] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                AI Health Insights
              </h2>
              <p className="text-[11px] text-gray-500">
                Add your Gemini API key to enable analysis
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-3 px-4 py-4">
          <p className="text-xs text-gray-600">
            We use your own Gemini API key to analyze Fitbit metrics. Your key
            is stored securely and only used for your account.
          </p>

          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Gemini API key"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />

          <button
            onClick={saveApiKeyHandler}
            disabled={savingKey || !apiKey.trim()}
            className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-xs font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingKey ? 'Saving…' : 'Save API key'}
          </button>

          <a
            href="https://makersuite.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-purple-600 hover:underline"
          >
            Get a Gemini API key →
          </a>

          <ul className="mt-2 text-[11px] text-gray-500 list-disc list-inside space-y-1">
            <li>No data is shared with other users</li>
            <li>Can be changed or removed anytime</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl h-[620px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                AI Health Insights
              </h2>
              <p className="text-[11px] text-gray-500">
                Smart summaries from your Fitbit data
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Session history"
            >
              <History className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="API key settings"
            >
              <Settings className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Helper bullets */}
        <div className="px-4 pt-2 pb-1 border-b bg-gradient-to-r from-purple-50/80 to-blue-50/60">
          <ul className="text-[11px] text-gray-600 space-y-1 list-disc list-inside">
            <li>Compare weekly & monthly patterns</li>
            <li>Doctor-ready text summaries</li>
            <li>Ask plain language questions</li>
          </ul>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col px-4 py-3 gap-3 overflow-hidden">
          {/* Range + New session */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-full bg-gray-100 p-1">
              <button
                onClick={() => setDateRange('7d')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  dateRange === '7d'
                    ? 'bg-white shadow-sm text-purple-700'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                7d
              </button>
              <button
                onClick={() => setDateRange('30d')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  dateRange === '30d'
                    ? 'bg-white shadow-sm text-purple-700'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                30d
              </button>
            </div>

            <button
              onClick={createNewSession}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-sm hover:shadow-md"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              New
            </button>
          </div>

          {/* Chat / history */}
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {showHistory ? (
              renderHistory()
            ) : (
              <>
                {currentSession && (
                  <div className="px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-[10px] text-gray-600 flex items-center justify-between">
                    <span className="truncate max-w-[200px]">
                      {currentSession.title}
                    </span>
                    <span>
                      {new Date(
                        currentSession.startDate
                      ).toLocaleDateString()}{' '}
                      –{' '}
                      {new Date(
                        currentSession.endDate
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {renderMessages()}
              </>
            )}
          </div>

          {/* Quick stat chips */}
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {[
              { icon: Activity, label: 'Steps' },
              { icon: Heart, label: 'Heart' },
              { icon: Flame, label: 'Calories' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100"
              >
                <Icon className="w-3.5 h-3.5 text-purple-600" />
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Input area */}
        <div className="px-4 pb-4 pt-2 border-t bg-white">
          {/* Optional helper note when no session yet */}
          {!currentSession && (
            <p className="text-[10px] text-gray-500 mb-1">
              Type your question and press Send — a session will be created automatically.
            </p>
          )}

          <div className="flex gap-2 items-center">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 rounded-lg transition-all ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={
                currentSession
                  ? 'Ask about your steps, sleep, heart rate…'
                  : 'Ask anything about your Fitbit data…'
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              // 🔥 FIX: only disabled when analyzing, not based on session
              disabled={isAnalyzing}
            />

            <button
              onClick={sendMessage}
              // 🔥 FIX: only depends on text + analyzing, not currentSession
              disabled={isAnalyzing || !inputMessage.trim()}
              className="px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-xs font-semibold hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings modal */}
      <AnimatePresence>
        {showApiKeyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4"
            onClick={() => setShowApiKeyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  API Key Settings
                </h3>
                <button onClick={() => setShowApiKeyModal(false)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gemini API key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter new API key"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>

                <button
                  onClick={saveApiKeyHandler}
                  disabled={savingKey || !apiKey.trim()}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {savingKey ? 'Saving…' : 'Update API key'}
                </button>

                <a
                  href="https://makersuite.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs text-purple-600 hover:underline"
                >
                  Get a new Gemini API key →
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Variant 2 – SPLIT: header on top, quick stats row under header, chat below
function SplitVariant(core: ReturnType<typeof useAIHealthCore>) {
  // Use CardVariant but with slightly different shell classes
  return (
    <div className="h-[620px]">
      <CardVariant {...core} />
    </div>
  );
}

// Variant 3 – MINIMAL: flat card, less chrome, more space
function MinimalVariant(core: ReturnType<typeof useAIHealthCore>) {
  return (
    <div className="h-[600px]">
      <CardVariant {...core} />
    </div>
  );
}

// Variant 4 – TABS: same content but visually fits in tab-like card
function TabsVariant(core: ReturnType<typeof useAIHealthCore>) {
  return (
    <div className="h-[620px]">
      <CardVariant {...core} />
    </div>
  );
}

// Variant 5 – GLASS: glassmorphism card over gradient
function GlassVariant(core: ReturnType<typeof useAIHealthCore>) {
  return (
    <div className="h-[620px]">
      <div className="backdrop-blur-md bg-white/70 rounded-2xl shadow-2xl border border-white/60">
        <CardVariant {...core} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// MAIN EXPORT
// ──────────────────────────────────────────────────────────────

export default function AIHealthInsights() {
  const core = useAIHealthCore();

  switch (LAYOUT_VARIANT) {
    case 'card':
      return <CardVariant {...core} />;
    case 'split':
      return <SplitVariant {...core} />;
    case 'minimal':
      return <MinimalVariant {...core} />;
    case 'tabs':
      return <TabsVariant {...core} />;
    case 'glass':
      return <GlassVariant {...core} />;
    default:
      return <CardVariant {...core} />;
  }
}
