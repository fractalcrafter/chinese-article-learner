import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Save, Loader2, AlertCircle, LogOut, Trash2, BookOpen, BarChart3 } from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { createArticle, getArticles, deleteArticle } from '../lib/api';
import { useUser } from '../contexts/UserContext';

type ArticleListItem = {
  id: number;
  title: string;
  created_at: string;
};

export function RecordPage() {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const [text, setText] = useState('');  // Single source of truth for committed text
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  
  // Track what we've already appended to avoid duplicates
  const appendedLengthRef = useRef(0);

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

  // Append new finalized speech to text (includes punctuation from pauses)
  useEffect(() => {
    if (transcript.length > appendedLengthRef.current) {
      const newText = transcript.slice(appendedLengthRef.current);
      setText(prev => prev + newText);
      appendedLengthRef.current = transcript.length;
    }
  }, [transcript]);

  // Load articles on mount
  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const data = await getArticles();
      setArticles(data as ArticleListItem[]);
    } catch (err) {
      console.error('Failed to load articles:', err);
    } finally {
      setLoadingArticles(false);
    }
  };

  const handleDeleteArticle = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this article?')) return;
    try {
      await deleteArticle(id);
      // Use functional update to avoid stale closure
      setArticles(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete article');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleLogout = () => {
    setUser(null);
    navigate('/login');
  };

  const handleSave = async () => {
    // Flush any pending transcript before saving
    const pendingText = transcript.slice(appendedLengthRef.current);
    const textToSave = text + pendingText;
    
    if (!textToSave.trim()) return;

    setIsSaving(true);
    try {
      const { id } = await createArticle(textToSave, title || undefined);
      navigate(`/article/${id}`);
      // Don't setIsSaving(false) here - component will unmount
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save article. Please try again.');
      setIsSaving(false);  // Only reset on error since we stay on page
    }
  };

  const handleReset = () => {
    resetTranscript();
    appendedLengthRef.current = 0;
    setText('');
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
        {/* User Header */}
        {user && (
          <div className="flex items-center justify-between mb-4 bg-white rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{user.avatar_emoji}</span>
              <span className="font-medium text-gray-700">{user.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/progress')}
                className="flex items-center gap-1 px-3 py-1 text-gray-500 hover:text-amber-600 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="text-sm">Progress</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-1 text-gray-500 hover:text-red-500 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-amber-800 mb-2">
            🐵 Monkey
          </h1>
          <p className="text-amber-600">
            Learn Chinese through articles
          </p>
        </div>

        {/* Previous Articles */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            My Articles
          </h3>
          
          {loadingArticles ? (
            <div className="text-center py-4 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : articles.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No articles yet. Add your first Chinese article below!
            </p>
          ) : (
            <div className="space-y-2">
              {articles.map((article) => (
                <div
                  key={article.id}
                  onClick={() => navigate(`/article/${article.id}`)}
                  className="flex items-center justify-between p-3 bg-amber-50 hover:bg-amber-100 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {article.title || 'Untitled Article'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(article.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteArticle(article.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete article"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Article Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Mic className="w-5 h-5 text-amber-600" />
            Add New Article
          </h3>

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
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-500 mb-2">
            Transcription (click to edit)
          </label>
          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder="Your Chinese transcription will appear here...

Click 'Start Recording' and speak in Chinese, or type/paste text directly."
            className="w-full h-48 p-4 text-xl leading-relaxed border-2 border-gray-200 rounded-xl focus:border-amber-400 focus:outline-none resize-none"
            style={{ fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif' }}
          />
          
          {/* Show interim transcript below textarea */}
          {interimTranscript && (
            <div 
              className="mt-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xl text-amber-700"
              style={{ fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif' }}
            >
              <span className="animate-pulse">🎤</span> {interimTranscript}...
            </div>
          )}
          
          {/* Character count and status */}
          <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
            <span>{text.length} characters</span>
            {isListening && !interimTranscript && (
              <span className="text-amber-600 animate-pulse">🎤 Listening...</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={handleReset}
            disabled={!text && !title}
            className="px-6 py-3 rounded-xl font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Clear All
          </button>
          
          <button
            onClick={handleSave}
            disabled={!text.trim() || isSaving}
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
        <div className="mt-6 bg-amber-100 rounded-xl p-4">
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
    </div>
  );
}
