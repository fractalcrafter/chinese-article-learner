import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Layers, BookOpen, Brain, Trash2, Plus, Volume2, Pencil, Check, X } from 'lucide-react';
import {
  getStudySet,
  addStudySetItems,
  removeStudySetItem,
  updateVocabularyItem,
  type StudySet,
  type StudySetItem,
} from '../lib/api';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

export function StudySetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setId = id ? parseInt(id) : 0;
  const [set, setSet] = useState<StudySet | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [rawAdd, setRawAdd] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editChinese, setEditChinese] = useState('');
  const [editPinyin, setEditPinyin] = useState('');
  const [editEnglish, setEditEnglish] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const { speak } = useSpeechSynthesis();

  const load = async () => {
    setLoading(true);
    try {
      setSet(await getStudySet(setId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (setId) load(); }, [setId]);

  const handleAdd = async () => {
    if (!rawAdd.trim()) return;
    setAdding(true);
    try {
      await addStudySetItems(setId, { rawInput: rawAdd });
      setRawAdd('');
      setShowAdd(false);
      await load();
    } catch (e) {
      console.error(e);
      alert('Failed to add items');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (vocabId: number) => {
    if (!confirm('Remove this word from the set?')) return;
    try {
      await removeStudySetItem(setId, vocabId);
      setSet(s => s ? { ...s, items: s.items.filter(i => i.id !== vocabId) } : s);
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (item: StudySetItem) => {
    setEditingId(item.id);
    setEditChinese(item.chinese);
    setEditPinyin(item.pinyin || '');
    setEditEnglish(item.english || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditChinese('');
    setEditPinyin('');
    setEditEnglish('');
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    if (!editChinese.trim()) {
      alert('Chinese text is required');
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await updateVocabularyItem(editingId, {
        chinese: editChinese.trim(),
        pinyin: editPinyin.trim(),
        english: editEnglish.trim(),
      });
      setSet(s => s ? {
        ...s,
        items: s.items.map(i =>
          i.id === editingId
            ? { ...i, chinese: updated.chinese, pinyin: updated.pinyin, english: updated.english }
            : i
        ),
      } : s);
      cancelEdit();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to save');
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50">
        <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (!set) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Set not found.</p>
      </div>
    );
  }

  const hasItems = set.items.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <button
          onClick={() => navigate('/sets')}
          className="flex items-center gap-1 text-amber-700 hover:text-amber-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> All Sets
        </button>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-start gap-3 mb-2">
            <Layers className="w-8 h-8 text-amber-600 mt-1" />
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{set.title}</h1>
              <p className="text-gray-500">{set.items.length} {set.items.length === 1 ? 'term' : 'terms'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            <button
              disabled={!hasItems}
              onClick={() => navigate(`/sets/${setId}/flashcards`)}
              className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-lg disabled:opacity-50"
            >
              <BookOpen className="w-5 h-5" /> Flashcards
            </button>
            <button
              disabled={!hasItems}
              onClick={() => navigate(`/sets/${setId}/learn`)}
              className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold shadow-lg disabled:opacity-50"
            >
              <Brain className="w-5 h-5" /> Learn
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Terms</h3>
            <button
              onClick={() => setShowAdd(s => !s)}
              className="flex items-center gap-1 px-3 py-1 text-sm rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          {showAdd && (
            <div className="mb-4 p-3 bg-amber-50 rounded-xl">
              <textarea
                value={rawAdd}
                onChange={(e) => setRawAdd(e.target.value)}
                placeholder="Paste more Chinese words..."
                className="w-full h-24 p-2 border-2 border-amber-200 rounded-lg focus:border-amber-400 focus:outline-none text-lg"
                style={{ fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif' }}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => { setShowAdd(false); setRawAdd(''); }}
                  disabled={adding}
                  className="px-4 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={adding || !rawAdd.trim()}
                  className="flex items-center gap-1 px-4 py-1 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm disabled:opacity-50"
                >
                  {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add
                </button>
              </div>
            </div>
          )}

          {set.items.length === 0 ? (
            <p className="text-gray-500 text-center py-6">No terms yet.</p>
          ) : (
            <div className="space-y-2">
              {set.items.map(item => (
                editingId === item.id ? (
                  <div key={item.id} className="p-3 bg-blue-50 border-2 border-blue-200 rounded-xl space-y-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Chinese</label>
                      <input
                        value={editChinese}
                        onChange={(e) => setEditChinese(e.target.value)}
                        className="w-full px-3 py-2 text-lg rounded-lg border-2 border-amber-200 focus:border-amber-400 focus:outline-none"
                        style={{ fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif' }}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Pinyin</label>
                        <input
                          value={editPinyin}
                          onChange={(e) => setEditPinyin(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">English</label>
                        <input
                          value={editEnglish}
                          onChange={(e) => setEditEnglish(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border-2 border-amber-200 focus:border-amber-400 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={cancelEdit}
                        disabled={savingEdit}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm"
                      >
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={savingEdit || !editChinese.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm disabled:opacity-50"
                      >
                        {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl group">
                    <div className="flex-1 min-w-0">
                      <p className="text-xl font-medium text-gray-800 break-words" style={{ fontFamily: '"Noto Sans SC", sans-serif' }}>
                        {item.chinese}
                      </p>
                      <p className="text-sm text-amber-700 break-words">{item.pinyin}</p>
                      <p className="text-sm text-gray-600 break-words">{item.english}</p>
                    </div>
                    <button
                      onClick={() => speak(item.chinese)}
                      className="p-2 text-amber-700 hover:bg-amber-200 rounded-full"
                      title="Listen"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => startEdit(item)}
                      className="p-2 text-gray-500 hover:text-blue-600 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                      title="Edit term"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-2 text-gray-400 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                      title="Remove term"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
