import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Trash2, Layers, ArrowLeft, Sparkles, Pencil, Check, X, EyeOff } from 'lucide-react';
import { getStudySets, createStudySet, deleteStudySet, updateStudySet, type StudySetSummary } from '../lib/api';

export function StudySetsPage() {
  const navigate = useNavigate();
  const [sets, setSets] = useState<StudySetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setSets(await getStudySets());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!title.trim() || !rawInput.trim()) return;
    setCreating(true);
    try {
      const { id } = await createStudySet({ title: title.trim(), rawInput });
      navigate(`/sets/${id}`);
    } catch (e) {
      console.error(e);
      alert('Failed to create set');
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this study set?')) return;
    try {
      await deleteStudySet(id);
      setSets(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      console.error(e);
      alert('Failed to delete');
    }
  };

  const handleHide = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Hide this study set from the list? You can restore it later by editing the set in the database.')) return;
    try {
      await updateStudySet(id, { hidden: true });
      setSets(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      console.error(e);
      alert('Failed to hide set. Please try again or check your connection.');
    }
  };

  const startEdit = (s: StudySetSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditTitle(s.title);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  const saveEdit = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newTitle = editTitle.trim();
    if (!newTitle) return;
    const current = sets.find(s => s.id === id);
    if (current && current.title === newTitle) {
      setEditingId(null);
      return;
    }
    setSavingEdit(true);
    try {
      await updateStudySet(id, { title: newTitle });
      setSets(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
      setEditingId(null);
    } catch (err) {
      console.error(err);
      alert('Failed to rename set');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-amber-700 hover:text-amber-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-amber-800 mb-2 flex items-center justify-center gap-2">
            <Layers className="w-9 h-9" /> Study Sets
          </h1>
          <p className="text-amber-600">Quizlet-style flashcards & learn mode</p>
        </div>

        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full mb-6 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-lg"
          >
            <Plus className="w-5 h-5" /> New Study Set
          </button>
        )}

        {showCreate && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" /> Create New Set
            </h3>
            <input
              type="text"
              placeholder="Set title (e.g. HSK 3 Animals)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mb-3 px-4 py-3 rounded-xl border-2 border-amber-200 focus:border-amber-400 focus:outline-none"
            />
            <label className="block text-sm text-gray-600 mb-1">
              Paste Chinese words (one per line, or separated by commas/spaces):
            </label>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={'你好\n谢谢\n再见\n老师'}
              className="w-full h-48 p-4 text-lg border-2 border-gray-200 rounded-xl focus:border-amber-400 focus:outline-none resize-none"
              style={{ fontFamily: 'var(--font-chinese)' }}
            />
            <p className="text-xs text-gray-500 mt-1 mb-4">
              Pinyin and English will be generated automatically.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowCreate(false); setTitle(''); setRawInput(''); }}
                disabled={creating}
                className="px-5 py-2 rounded-xl text-gray-600 bg-gray-200 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim() || !rawInput.trim()}
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? 'Creating...' : 'Create Set'}
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-4">My Sets</h3>
          {loading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" /></div>
          ) : sets.length === 0 ? (
            <p className="text-gray-500 text-center py-6">No sets yet. Create your first one above!</p>
          ) : (
            <div className="space-y-2">
              {sets.map(s => {
                const isEditing = editingId === s.id;
                return (
                <div
                  key={s.id}
                  onClick={() => !isEditing && navigate(`/sets/${s.id}`)}
                  className={`flex items-center justify-between p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors group ${isEditing ? '' : 'cursor-pointer'}`}
                >
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editTitle}
                        autoFocus
                        disabled={savingEdit}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); saveEdit(s.id); }
                          if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); }
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border-2 border-amber-300 focus:border-amber-500 focus:outline-none font-medium text-gray-800 bg-white"
                      />
                    ) : (
                      <p className="font-medium text-gray-800 truncate">{s.title}</p>
                    )}
                    <p className="text-sm text-gray-500">
                      {s.item_count} {s.item_count === 1 ? 'term' : 'terms'} · {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={(e) => saveEdit(s.id, e)}
                          disabled={savingEdit || !editTitle.trim()}
                          aria-label="Save name"
                          className="p-2 text-green-600 hover:text-green-700 disabled:opacity-40"
                        >
                          {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={savingEdit}
                          aria-label="Cancel rename"
                          className="p-2 text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => startEdit(s, e)}
                          aria-label="Rename set"
                          className="p-2 text-gray-400 hover:text-amber-600 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleHide(s.id, e)}
                          aria-label="Hide set"
                          className="p-2 text-gray-400 hover:text-slate-600 transition-colors"
                        >
                          <EyeOff className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(s.id, e)}
                          aria-label="Delete set"
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
