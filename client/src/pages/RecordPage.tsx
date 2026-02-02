import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Save, Loader2, AlertCircle } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { createArticle } from '../lib/api';

export function RecordPage() {
  const navigate = useNavigate();
  const [editedText, setEditedText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');

  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({ language: 'zh-CN' });

  // Combine transcript with edited text
  const displayText = editedText || transcript;
  const fullText = displayText + interimTranscript;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedText(e.target.value);
  };

  const handleSave = async () => {
    const textToSave = editedText || transcript;
    if (!textToSave.trim()) return;

    setIsSaving(true);
    try {
      const { id } = await createArticle(textToSave, title || undefined);
      navigate(`/article/${id}`);
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save article. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    resetTranscript();
    setEditedText('');
    setTitle('');
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Speech Recognition Not Supported
          </h2>
          <p className="text-gray-600">
            Please use Chrome or Edge browser for speech recognition features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-amber-800 mb-2">
            🐵 Monkey
          </h1>
          <p className="text-amber-600">
            Record a Chinese article to start learning
          </p>
        </div>

        {/* Title Input */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Article title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 focus:border-amber-400 focus:outline-none text-lg"
          />
        </div>

        {/* Recording Controls */}
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-lg
              transition-all duration-200 shadow-lg
              ${isListening 
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                : 'bg-amber-500 hover:bg-amber-600 text-white'
              }
            `}
          >
            {isListening ? (
              <>
                <MicOff className="w-6 h-6" />
                Stop Recording
              </>
            ) : (
              <>
                <Mic className="w-6 h-6" />
                Start Recording
              </>
            )}
          </button>
        </div>

        {/* Status */}
        {isListening && (
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-2 text-red-600 font-medium">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              Listening... Speak in Chinese
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4">
            <p className="font-medium">Error: {error}</p>
            {error === 'network' && (
              <p className="text-sm mt-1">
                💡 Tip: Speech recognition works best in <strong>Chrome</strong>. 
                You can also paste Chinese text directly below.
              </p>
            )}
          </div>
        )}

        {/* Transcription Area */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <label className="block text-sm font-medium text-gray-500 mb-2">
            Transcription (click to edit)
          </label>
          <textarea
            value={fullText}
            onChange={handleTextChange}
            onFocus={() => {
              if (!editedText && transcript) {
                setEditedText(transcript);
              }
            }}
            placeholder="Your Chinese transcription will appear here...

Click 'Start Recording' and speak in Chinese, or type/paste text directly."
            className="w-full h-64 p-4 text-xl leading-relaxed border-2 border-gray-200 rounded-xl focus:border-amber-400 focus:outline-none resize-none"
            style={{ fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif' }}
          />
          
          {/* Character count */}
          <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
            <span>{fullText.length} characters</span>
            {interimTranscript && (
              <span className="text-amber-600">Processing speech...</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={handleReset}
            disabled={!fullText && !title}
            className="px-6 py-3 rounded-xl font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Clear All
          </button>
          
          <button
            onClick={handleSave}
            disabled={!fullText.trim() || isSaving}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save & Process
              </>
            )}
          </button>
        </div>

        {/* Tips */}
        <div className="mt-8 bg-amber-100 rounded-xl p-4">
          <h3 className="font-semibold text-amber-800 mb-2">💡 Tips</h3>
          <ul className="text-amber-700 text-sm space-y-1">
            <li>• Speak clearly and at a normal pace</li>
            <li>• You can edit the transcription after recording</li>
            <li>• You can also paste Chinese text directly</li>
            <li>• Works best in Chrome or Edge browsers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
