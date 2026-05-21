import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Volume2, RotateCcw, Check, X, Trophy } from 'lucide-react';
import { getStudySet, type StudySet, type StudySetItem } from '../lib/api';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

// Distance to push a "don't know" item back in the queue so it doesn't repeat immediately.
const REQUEUE_GAP = 4;

interface ItemStats {
  dontKnowCount: number;
  finalKnown: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function LearnPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setId = id ? parseInt(id) : 0;
  const [set, setSet] = useState<StudySet | null>(null);
  const [loading, setLoading] = useState(true);

  // Queue of itemIds still being studied; stats keyed by itemId
  const [queue, setQueue] = useState<number[]>([]);
  const [stats, setStats] = useState<Record<number, ItemStats>>({});
  const [knownIds, setKnownIds] = useState<number[]>([]);
  const [flipped, setFlipped] = useState(false);

  const { speak } = useSpeechSynthesis();

  const itemMap = useMemo(() => {
    const m: Record<number, StudySetItem> = {};
    set?.items.forEach(i => { m[i.id] = i; });
    return m;
  }, [set]);

  const initialize = (items: StudySetItem[]) => {
    const ids = shuffle(items.map(i => i.id));
    setQueue(ids);
    setStats(Object.fromEntries(items.map(i => [i.id, { dontKnowCount: 0, finalKnown: false }])));
    setKnownIds([]);
    setFlipped(false);
  };

  useEffect(() => {
    (async () => {
      try {
        const s = await getStudySet(setId);
        setSet(s);
        initialize(s.items);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [setId]);

  const currentId = queue[0];
  const current = currentId !== undefined ? itemMap[currentId] : null;
  const total = set?.items.length ?? 0;
  const knownCount = knownIds.length;
  const isComplete = !loading && total > 0 && queue.length === 0;

  const markKnown = () => {
    if (!current) return;
    setKnownIds(prev => [...prev, current.id]);
    setStats(prev => ({
      ...prev,
      [current.id]: { ...prev[current.id], finalKnown: true },
    }));
    setQueue(prev => prev.slice(1));
    setFlipped(false);
  };

  const markDontKnow = () => {
    if (!current) return;
    setStats(prev => ({
      ...prev,
      [current.id]: {
        dontKnowCount: (prev[current.id]?.dontKnowCount ?? 0) + 1,
        finalKnown: false,
      },
    }));
    setQueue(prev => {
      const [head, ...rest] = prev;
      const insertAt = Math.min(REQUEUE_GAP, rest.length);
      return [...rest.slice(0, insertAt), head, ...rest.slice(insertAt)];
    });
    setFlipped(false);
  };

  const restartAll = () => {
    if (!set) return;
    initialize(set.items);
  };

  const restartDontKnowsOnly = () => {
    if (!set) return;
    const dontKnowItems = set.items.filter(i => (stats[i.id]?.dontKnowCount ?? 0) > 0);
    if (dontKnowItems.length === 0) {
      restartAll();
      return;
    }
    initialize(dontKnowItems);
  };

  // Keyboard shortcuts
  const currentIdRef = useRef(currentId);
  const flippedRef = useRef(flipped);
  useEffect(() => { currentIdRef.current = currentId; }, [currentId]);
  useEffect(() => { flippedRef.current = flipped; }, [flipped]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (currentIdRef.current === undefined) return;
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped(f => !f);
      } else if (flippedRef.current) {
        if (e.key === '2' || e.key === 'ArrowRight') {
          e.preventDefault();
          markKnown();
        } else if (e.key === '1' || e.key === 'ArrowLeft') {
          e.preventDefault();
          markDontKnow();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50">
        <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (!set || total === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>No items.</p>
      </div>
    );
  }

  // Completion stats
  const dontKnowItems = set.items.filter(i => (stats[i.id]?.dontKnowCount ?? 0) > 0);
  const firstTryKnown = set.items.filter(i => stats[i.id]?.finalKnown && (stats[i.id]?.dontKnowCount ?? 0) === 0).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <button
          onClick={() => navigate(`/sets/${setId}`)}
          className="flex items-center gap-1 text-amber-700 hover:text-amber-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to set
        </button>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-amber-800">{set.title}</h1>
          <span className="text-sm text-gray-600 font-medium">
            {knownCount} / {total} known
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-amber-100 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-purple-500 transition-all"
            style={{ width: `${(knownCount / total) * 100}%` }}
          />
        </div>

        {isComplete ? (
          <div className="bg-white rounded-3xl shadow-xl p-10 text-center">
            <Trophy className="w-20 h-20 text-amber-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800 mb-2">All done! 🎉</h2>
            <p className="text-gray-600 mb-2">You marked all {total} terms as known.</p>
            <p className="text-sm text-gray-500 mb-6">
              {firstTryKnown} on first try · {dontKnowItems.length} needed review
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {dontKnowItems.length > 0 && (
                <button
                  onClick={restartDontKnowsOnly}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold"
                >
                  <RotateCcw className="w-5 h-5" /> Review {dontKnowItems.length} I missed
                </button>
              )}
              <button
                onClick={restartAll}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              >
                <RotateCcw className="w-5 h-5" /> Restart all
              </button>
              <button
                onClick={() => navigate(`/sets/${setId}`)}
                className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        ) : current ? (
          <>
            {/* Card */}
            <div
              onClick={() => setFlipped(f => !f)}
              className="relative w-full h-80 bg-white rounded-3xl shadow-xl cursor-pointer mb-6 select-none"
              style={{ perspective: '1000px' }}
            >
              <div
                className="absolute inset-0 transition-transform duration-500"
                style={{
                  transformStyle: 'preserve-3d',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* Front - Chinese */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center p-8"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <p
                    className="text-6xl font-bold text-gray-800 text-center"
                    style={{ fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif' }}
                  >
                    {current.chinese}
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); speak(current.chinese); }}
                    className="mt-6 p-3 bg-amber-100 hover:bg-amber-200 rounded-full"
                    title="Listen"
                  >
                    <Volume2 className="w-6 h-6 text-amber-700" />
                  </button>
                  <p className="absolute bottom-4 text-xs text-gray-400">
                    Click or press space to reveal
                  </p>
                </div>
                {/* Back - Pinyin + English */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center p-8"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <p
                    className="text-3xl font-medium text-gray-700 mb-3"
                    style={{ fontFamily: '"Noto Sans SC", sans-serif' }}
                  >
                    {current.chinese}
                  </p>
                  <p className="text-2xl font-medium text-amber-700 mb-2">{current.pinyin}</p>
                  <p className="text-xl text-gray-700 text-center">{current.english}</p>
                  {current.example_sentence && (
                    <p
                      className="mt-4 text-base text-gray-500 text-center italic"
                      style={{ fontFamily: '"Noto Sans SC", sans-serif' }}
                    >
                      {current.example_sentence}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {flipped ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={markDontKnow}
                  className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold shadow-lg"
                >
                  <X className="w-5 h-5" /> Don't know
                </button>
                <button
                  onClick={markKnown}
                  className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold shadow-lg"
                >
                  <Check className="w-5 h-5" /> Known
                </button>
              </div>
            ) : (
              <button
                onClick={() => setFlipped(true)}
                className="w-full px-6 py-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-lg"
              >
                Reveal answer
              </button>
            )}

            {/* Queue info */}
            <p className="text-center text-sm text-gray-500 mt-4">
              {queue.length} {queue.length === 1 ? 'card' : 'cards'} left in this round
              {(stats[current.id]?.dontKnowCount ?? 0) > 0 && (
                <span className="ml-2 text-orange-600">
                  · seen {stats[current.id].dontKnowCount + 1}×
                </span>
              )}
            </p>

            <p className="text-center text-xs text-gray-400 mt-2">
              Shortcuts: space to flip · ← / 1 = don't know · → / 2 = known
            </p>

            <button
              onClick={restartAll}
              className="mt-6 flex items-center gap-1 mx-auto text-sm text-gray-500 hover:text-gray-700"
            >
              <RotateCcw className="w-4 h-4" /> Restart session
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
