import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Trash2, Layers, ArrowLeft, Sparkles } from 'lucide-react';
import { getStudySets, createStudySet, deleteStudySet, type StudySetSummary } from '../lib/api';

export function StudySetsPage() {
  const navigate = useNavigate();
  const [sets, setSets] = useState<StudySetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [creating, setCreating] = useState(false);

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
              {sets.map(s => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/sets/${s.id}`)}
                  className="flex items-center justify-between p-4 bg-amber-50 hover:bg-amber-100 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{s.title}</p>
                    <p className="text-sm text-gray-500">
                      {s.item_count} {s.item_count === 1 ? 'term' : 'terms'} · {new Date(s.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(s.id, e)}
                    className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
