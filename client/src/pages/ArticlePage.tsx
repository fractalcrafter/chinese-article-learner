import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Volume2, Loader2, BookOpen, GraduationCap, Plus, X, Trash2 } from 'lucide-react';
import { getArticle, processArticle, addVocabulary, deleteVocabulary, deleteArticle } from '../lib/api';
import type { Article, Sentence } from '../lib/api';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import { VocabularyCard } from '../components/VocabularyCard';

export function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { speak } = useSpeechSynthesis();

  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'article' | 'vocabulary'>('article');
  const [newVocab, setNewVocab] = useState('');
  const [isAddingVocab, setIsAddingVocab] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    loadArticle();
  }, [id]);

  const loadArticle = async () => {
    try {
      setIsLoading(true);
      const data = await getArticle(parseInt(id!));
      setArticle(data);
      
      // Auto-process if not yet processed
      if (!data.summary && !data.sentences?.length) {
        await handleProcess();
      }
    } catch (err) {
      console.error('Failed to load article:', err);
      setError('Failed to load article');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!id) return;
    
    setIsProcessing(true);
    try {
      const result = await processArticle(parseInt(id));
      setArticle(prev => prev ? {
        ...prev,
        summary: result.summary,
        sentences: result.sentences,
        vocabulary: result.vocabulary,
      } : null);
    } catch (err) {
      console.error('Failed to process article:', err);
      setError('Failed to process article. Make sure your Gemini API key is configured.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSpeak = (text: string) => {
    console.log('handleSpeak called with:', text);
    speak(text, 'zh-CN');
  };

  const handleAddVocab = async () => {
    if (!id || !newVocab.trim()) return;
    
    setIsAddingVocab(true);
    try {
      const vocab = await addVocabulary(parseInt(id), newVocab.trim());
      setArticle(prev => prev ? {
        ...prev,
        vocabulary: [...(prev.vocabulary || []), vocab],
      } : null);
      setNewVocab('');
    } catch (err) {
      console.error('Failed to add vocabulary:', err);
      alert('Failed to add vocabulary');
    } finally {
      setIsAddingVocab(false);
    }
  };

  const handleDeleteVocab = async (vocabId: number) => {
    if (!id) return;
    
    try {
      await deleteVocabulary(parseInt(id), vocabId);
      setArticle(prev => prev ? {
        ...prev,
        vocabulary: prev.vocabulary?.filter(v => v.id !== vocabId) || [],
      } : null);
    } catch (err) {
      console.error('Failed to delete vocabulary:', err);
    }
  };

  const handleDeleteArticle = async () => {
    if (!id) return;
    if (!confirm('Delete this article? This cannot be undone.')) return;
    
    try {
      await deleteArticle(parseInt(id));
      navigate('/');
    } catch (err) {
      console.error('Failed to delete article:', err);
      alert('Failed to delete article');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <p className="text-red-600 mb-4">{error || 'Article not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-amber-200 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-amber-800" />
            </button>
            <h1 className="text-2xl font-bold text-amber-800">
              {article.title || 'Untitled Article'}
            </h1>
          </div>
          <button
            onClick={handleDeleteArticle}
            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete article"
          >
            <Trash2 className="w-5 h-5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="bg-amber-100 rounded-xl p-6 mb-6 text-center">
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-2" />
            <p className="text-amber-800 font-medium">Processing article...</p>
            <p className="text-amber-600 text-sm">Generating summary, translations, and vocabulary</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('article')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'article'
                ? 'bg-amber-500 text-white'
                : 'bg-white text-amber-700 hover:bg-amber-100'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            Article
          </button>
          <button
            onClick={() => setActiveTab('vocabulary')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'vocabulary'
                ? 'bg-amber-500 text-white'
                : 'bg-white text-amber-700 hover:bg-amber-100'
            }`}
          >
            <GraduationCap className="w-5 h-5" />
            Vocabulary ({article.vocabulary?.length || 0})
          </button>
        </div>

        {/* Article Tab */}
        {activeTab === 'article' && (
          <div className="space-y-6">
            {/* Summary */}
            {article.summary && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-blue-800 mb-2">📝 Summary</h2>
                <p className="text-blue-900">{article.summary}</p>
              </div>
            )}

            {/* Sentences */}
            {article.sentences && article.sentences.length > 0 ? (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-amber-800">Sentence Breakdown</h2>
                {article.sentences.map((sentence, index) => (
                  <SentenceCard 
                    key={index} 
                    sentence={sentence} 
                    onSpeak={handleSpeak}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Original Text</h2>
                <p className="text-xl leading-relaxed" style={{ fontFamily: '"Noto Sans SC", sans-serif' }}>
                  {article.transcription_edited || article.transcription_original}
                </p>
                {!isProcessing && (
                  <button
                    onClick={handleProcess}
                    className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                  >
                    Process Article
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Vocabulary Tab */}
        {activeTab === 'vocabulary' && (
          <div className="space-y-6">
            {/* Add Vocabulary Form */}
            <div className="bg-white rounded-xl shadow-md p-4">
              <h3 className="text-lg font-semibold text-amber-800 mb-3">➕ Add Vocabulary</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newVocab}
                  onChange={(e) => setNewVocab(e.target.value)}
                  placeholder="Enter Chinese word (e.g., 学习)"
                  className="flex-1 px-4 py-2 border-2 border-amber-200 rounded-lg focus:border-amber-400 focus:outline-none text-lg"
                  style={{ fontFamily: '"Noto Sans SC", sans-serif' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddVocab()}
                />
                <button
                  onClick={handleAddVocab}
                  disabled={!newVocab.trim() || isAddingVocab}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isAddingVocab ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                  Add
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Pinyin and English translation will be generated automatically
              </p>
            </div>

            {/* Vocabulary List */}
            {article.vocabulary && article.vocabulary.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {article.vocabulary.map((vocab) => (
                  <div key={vocab.id} className="relative">
                    <VocabularyCard 
                      vocabulary={vocab}
                      onSpeak={handleSpeak}
                    />
                    <button
                      onClick={() => handleDeleteVocab(vocab.id)}
                      className="absolute top-2 right-2 p-1 bg-red-100 hover:bg-red-200 rounded-full text-red-600"
                      title="Remove vocabulary"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-8 text-center">
                <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">
                  No vocabulary yet. Add words above to start learning!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Sentence Card Component
function SentenceCard({ 
  sentence, 
  onSpeak 
}: { 
  sentence: Sentence; 
  onSpeak: (text: string) => void;
}) {
  // Parse pinyin and match with Chinese characters
  // Pinyin is generated only for Chinese characters (server-side)
  const renderChineseWithPinyin = () => {
    // Use spread to handle surrogate pairs (CJK Extension B) correctly
    const chars = [...sentence.chinese];
    const pinyinParts = sentence.pinyin.split(/\s+/);  // Keep placeholders for alignment
    
    // Helper to check if character is Chinese (CJK range) - uses codePointAt for surrogate pairs
    const isChineseChar = (char: string) => {
      const code = char.codePointAt(0) || 0;
      return (code >= 0x4E00 && code <= 0x9FFF) ||  // CJK Unified Ideographs
             (code >= 0x3400 && code <= 0x4DBF) ||  // CJK Extension A
             (code >= 0x20000 && code <= 0x2A6DF);  // CJK Extension B
    };
    
    // Pinyin index - only incremented for Chinese characters
    let pinyinIndex = 0;
    
    return chars.map((char, index) => {
      // Check if it's a Chinese character (only Chinese chars get pinyin)
      if (isChineseChar(char)) {
        const pinyin = pinyinParts[pinyinIndex] || '';
        pinyinIndex++;
        
        // Skip placeholder pinyins (underscore means no pinyin available)
        const displayPinyin = pinyin === '_' ? '' : pinyin;
        
        return (
          <ruby key={index} className="mr-1">
            <span className="text-2xl">{char}</span>
            <rp>(</rp>
            <rt className="text-sm text-amber-600 font-normal">{displayPinyin}</rt>
            <rp>)</rp>
          </ruby>
        );
      }
      
      // Non-Chinese characters (punctuation, numbers, letters) - just display
      return (
        <span key={index} className="text-2xl inline">
          {char}
        </span>
      );
    });
  };
  
  // Handle speak with proper Chinese text
  const handleSpeak = () => {
    const text = sentence.chinese;
    console.log('Speaking Chinese text:', text);
    console.log('Text char codes:', [...text].map(c => c.charCodeAt(0).toString(16)));
    onSpeak(text);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Chinese with Pinyin above each character */}
          <p 
            className="font-medium text-gray-900 mb-4 leading-loose"
            style={{ fontFamily: '"Noto Sans SC", sans-serif' }}
          >
            {renderChineseWithPinyin()}
          </p>
          
          {/* English */}
          <p className="text-gray-600 text-lg">
            {sentence.english}
          </p>
        </div>

        {/* Speak Button */}
        <button
          onClick={handleSpeak}
          className="p-3 bg-amber-100 hover:bg-amber-200 rounded-full transition-colors flex-shrink-0"
          title="Listen to pronunciation"
        >
          <Volume2 className="w-6 h-6 text-amber-700" />
        </button>
      </div>
    </div>
  );
}
