// VoiceCommandModal.tsx
import { useState, useEffect } from 'react';
import { X, Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (transcript: string) => Promise<void>;
}

export function VoiceCommandModal({ isOpen, onClose, onGenerate }: VoiceCommandModalProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;

      recognitionInstance.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptText = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptText + ' ';
          }
        }
        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript);
        }
      };

      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setError('Error with speech recognition. Please try again.');
        setIsListening(false);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    } else {
      setError('Speech recognition is not supported in your browser. Please use Chrome.');
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setError('');
      recognition.start();
      setIsListening(true);
    }
  };

  const handleGenerate = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    try {
      await onGenerate(transcript);
      setTranscript('');
      onClose();
    } catch (error) {
      console.error('Error generating workflow:', error);
      setError('Failed to generate workflow. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-2 rounded-lg">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Voice Command</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center justify-center py-8">
            <button
              onClick={toggleListening}
              disabled={!recognition}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 animate-pulse'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
              } shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isListening ? (
                <MicOff className="w-10 h-10 text-white" />
              ) : (
                <Mic className="w-10 h-10 text-white" />
              )}
            </button>
            <p className="mt-4 text-lg font-medium text-gray-900">
              {isListening ? 'Listening...' : 'Click to start speaking'}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Describe your workflow in your own words
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transcript
            </label>
            <div className="min-h-[120px] max-h-[200px] overflow-y-auto px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-gray-900 whitespace-pre-wrap">
                {transcript || 'Your speech will appear here...'}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setTranscript('')}
              className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium"
            >
              Clear
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading || !transcript.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin w-5 h-5" />
                  Generating...
                </>
              ) : (
                'Generate Workflow'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}