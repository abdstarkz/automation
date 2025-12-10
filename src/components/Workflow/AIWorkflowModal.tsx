// AIWorkflowModal.tsx
import { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';

interface AIWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string) => Promise<void>;
}

export function AIWorkflowModal({ isOpen, onClose, onGenerate }: AIWorkflowModalProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      await onGenerate(prompt);
      setPrompt('');
      onClose();
    } catch (error) {
      console.error('Error generating workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  const examples = [
    'Send me an email every morning at 9 AM with my health stats from yesterday',
    'Post a message to Slack when my heart rate goes above 100',
    'Create a daily summary of my steps and calories in a Google Sheet',
    'Alert me via Telegram if I haven\'t logged 8 hours of sleep',
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">AI Workflow Generator</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe your workflow in plain English
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Send me an email every day at 8 AM with my step count and calories burned..."
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">Example prompts:</p>
            <div className="space-y-2">
              {examples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(example)}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-lg transition-all text-sm text-gray-700 hover:text-purple-700"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin w-5 h-5" />
                Generating workflow...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Workflow
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}