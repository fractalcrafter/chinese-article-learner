import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Volume2, Shuffle, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { getStudySet, type StudySet, type StudySetItem } from '../lib/api';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function FlashcardsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const setId = id ? parseInt(id) : 0;
  const [set, setSet] = useState<StudySet | null>(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<StudySetItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const { speak } = useSpeechSynthesis();

  useEffect(() => {
    (async () => {
      try {
        const s = await getStudySet(setId);
        setSet(s);
        setOrder(s.items);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [setId]);

  const current = order[idx];
  const progress = useMemo(
    () => order.length ? `${idx + 1} / ${order.length}` : '0 / 0',
    [idx, order.length]
  );

  const next = () => {
    setFlipped(false);
    setIdx(i => Math.min(i + 1, order.length - 1));
  };
  const prev = () => {
    setFlipped(false);
    setIdx(i => Math.max(i - 1, 0));
  };
  const toggleShuffle = () => {
    if (isShuffled && set) {
      setOrder(set.items);
      setIsShuffled(false);
    } else {
      setOrder(shuffle(order));
      setIsShuffled(true);
    }
    setIdx(0);
    setFlipped(false);
  };
  const restart = () => { setIdx(0); setFlipped(false); };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); }
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order.length]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50">
        <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (!set || order.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>No cards.</p>
      </div>
    );
  }

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
          <span className="text-sm text-gray-600 font-medium">{progress}</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-amber-100 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${((idx + 1) / order.length) * 100}%` }}
          />
        </div>

        {/* Card */}
        <div
          onClick={() => setFlipped(f => !f)}
          className="relative w-full h-80 bg-white rounded-3xl shadow-xl cursor-pointer mb-6 select-none"
          style={{ perspective: '1000px' }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center p-8 transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front - Chinese */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-8 backface-hidden"
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
              <p className="absolute bottom-4 text-xs text-gray-400">Click or press space to flip</p>
            </div>
            {/* Back - Pinyin + English */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-8"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <p className="text-3xl font-medium text-amber-700 mb-3">{current.pinyin}</p>
              <p className="text-2xl text-gray-700 text-center">{current.english}</p>
              {current.example_sentence && (
                <p
                  className="mt-6 text-base text-gray-500 text-center italic"
                  style={{ fontFamily: '"Noto Sans SC", sans-serif' }}
                >
                  {current.example_sentence}
                </p>
              )}
              <p className="absolute bottom-4 text-xs text-gray-400">Click or press space to flip back</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={prev}
            disabled={idx === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white shadow hover:shadow-md disabled:opacity-40"
          >
            <ChevronLeft className="w-5 h-5" /> Prev
          </button>

          <div className="flex gap-2">
            <button
              onClick={toggleShuffle}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl shadow hover:shadow-md ${
                isShuffled ? 'bg-amber-500 text-white' : 'bg-white'
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button
              onClick={restart}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white shadow hover:shadow-md"
              title="Restart"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={next}
            disabled={idx === order.length - 1}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white shadow hover:shadow-md disabled:opacity-40"
          >
            Next <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
