import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Volume2, Shuffle, ChevronLeft, ChevronRight,
  RotateCcw, Check, X, Target, Trophy,
} from 'lucide-react';
import { getStudySet, type StudySet, type StudySetItem } from '../lib/api';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

type Status = 'unseen' | 'known' | 'dont_know';

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
  const [trackProgress, setTrackProgress] = useState(false);
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitX, setExitX] = useState(0);
  const [entering, setEntering] = useState(false);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipedRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const { speak } = useSpeechSynthesis();

  // Swipe thresholds (px)
  const SWIPE_DISTANCE = 60;
  const SWIPE_MAX_VERTICAL = 60;
  const TAP_MAX_MOVE = 8;
  const EXIT_DURATION = 280;  // ms to fly off-screen
  const ENTER_DURATION = 200; // ms for the new card to fade in

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

  const knownCount = useMemo(
    () => Object.values(statuses).filter(s => s === 'known').length,
    [statuses]
  );
  const dontKnowCount = useMemo(
    () => Object.values(statuses).filter(s => s === 'dont_know').length,
    [statuses]
  );
  const reviewedAll = order.length > 0 &&
    order.every(item => statuses[item.id] && statuses[item.id] !== 'unseen');

  const next = () => {
    setFlipped(false);
    setIdx(i => Math.min(i + 1, order.length - 1));
  };
  const prev = () => {
    setFlipped(false);
    setIdx(i => Math.max(i - 1, 0));
  };
  const markAndAdvance = (status: Exclude<Status, 'unseen'>) => {
    if (!current) return;
    setStatuses(s => ({ ...s, [current.id]: status }));
    if (idx < order.length - 1) {
      setFlipped(false);
      setIdx(i => i + 1);
    } else {
      setFlipped(false);
    }
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
  const resetProgress = () => {
    setStatuses({});
    setIdx(0);
    setFlipped(false);
  };
  const studyDontKnows = () => {
    const remaining = order.filter(item => statuses[item.id] === 'dont_know');
    if (remaining.length === 0) return;
    setOrder(remaining);
    setStatuses({});
    setIdx(0);
    setFlipped(false);
  };

  // Touch swipe handlers (iOS + Android). Tap = flip; horizontal swipe = mark.
  const onTouchStart = (e: React.TouchEvent) => {
    if (isAnimatingRef.current) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    swipedRef.current = false;
    setIsDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current || isAnimatingRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > TAP_MAX_MOVE) {
      e.preventDefault();
      setDragX(dx);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    setIsDragging(false);
    setDragX(0);
    touchStart.current = null;
    if (!start || isAnimatingRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx > SWIPE_DISTANCE && absDy < SWIPE_MAX_VERTICAL && absDx > absDy) {
      swipedRef.current = true;
      e.preventDefault();
      const direction = dx > 0 ? 1 : -1;
      isAnimatingRef.current = true;
      // Flip back to the front immediately so the back side isn't revealed
      // on the next card. The flip transition runs in parallel with the exit.
      setFlipped(false);
      // Animate the card flying off-screen, then apply the action
      setExitX(direction * (window.innerWidth || 400));
      setTimeout(() => {
        if (trackProgress) {
          markAndAdvance(direction > 0 ? 'known' : 'dont_know');
        } else {
          direction > 0 ? next() : prev();
        }
        // Reset exit and trigger an enter animation for the new card
        setExitX(0);
        setEntering(true);
        setTimeout(() => {
          setEntering(false);
          isAnimatingRef.current = false;
        }, ENTER_DURATION);
      }, EXIT_DURATION);
    }
  };

  const onCardClick = () => {
    if (swipedRef.current) {
      swipedRef.current = false;
      return;
    }
    if (isAnimatingRef.current) return;
    setFlipped(f => !f);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); return; }
      if (trackProgress) {
        if (e.key === 'ArrowRight') { e.preventDefault(); markAndAdvance('known'); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); markAndAdvance('dont_know'); }
      } else {
        if (e.key === 'ArrowRight') next();
        else if (e.key === 'ArrowLeft') prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.length, idx, trackProgress, current?.id]);

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

        {/* Track Progress toggle + stats */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-3 mb-4">
          <button
            onClick={() => setTrackProgress(t => !t)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              trackProgress
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title="When on, ← marks Don't know, → marks Known"
          >
            <Target className="w-4 h-4" />
            Track Progress {trackProgress ? 'ON' : 'OFF'}
          </button>
          {trackProgress && (
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-green-700">
                <Check className="w-4 h-4" /> {knownCount}
              </span>
              <span className="flex items-center gap-1 text-red-600">
                <X className="w-4 h-4" /> {dontKnowCount}
              </span>
              <button
                onClick={resetProgress}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
                title="Reset progress"
              >
                reset
              </button>
            </div>
          )}
        </div>

        {/* Completion banner */}
        {trackProgress && reviewedAll && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-4 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900">All cards reviewed!</p>
              <p className="text-sm text-amber-700">
                {knownCount} known · {dontKnowCount} still don't know
              </p>
            </div>
            {dontKnowCount > 0 && (
              <button
                onClick={studyDontKnows}
                className="px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold"
              >
                Study {dontKnowCount} missed
              </button>
            )}
          </div>
        )}

        {/* Progress bar */}
        <div className="w-full h-2 bg-amber-100 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{
              width: `${
                trackProgress
                  ? ((knownCount + dontKnowCount) / order.length) * 100
                  : ((idx + 1) / order.length) * 100
              }%`,
            }}
          />
        </div>

        {/* Current-card status badge */}
        {trackProgress && current && statuses[current.id] && (
          <div className="text-center mb-2">
            {statuses[current.id] === 'known' ? (
              <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3" /> Marked known
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-red-700 text-xs font-medium bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                <X className="w-3 h-3" /> Still don't know
              </span>
            )}
          </div>
        )}

        {/* Card */}
        <div
          onClick={onCardClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => { setIsDragging(false); setDragX(0); touchStart.current = null; }}
          className="relative w-full h-96 sm:h-80 bg-white rounded-3xl shadow-xl cursor-pointer mb-6 select-none overflow-hidden"
          style={{
            perspective: '1000px',
            touchAction: 'pan-y',
            transform: exitX !== 0
              ? `translateX(${exitX}px) rotate(${exitX * 0.06}deg)`
              : dragX !== 0
                ? `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`
                : entering
                  ? 'scale(0.96)'
                  : undefined,
            opacity: exitX !== 0 ? 0 : entering ? 0.6 : 1,
            transition: isDragging
              ? 'none'
              : exitX !== 0
                ? `transform ${EXIT_DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${EXIT_DURATION}ms ease-out`
                : entering
                  ? `transform ${ENTER_DURATION}ms ease-out, opacity ${ENTER_DURATION}ms ease-out`
                  : 'transform 200ms ease-out, opacity 200ms ease-out',
          }}
        >
          {/* Swipe hint overlays (visible during drag, mainly useful when trackProgress is on) */}
          {trackProgress && dragX > 20 && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
              style={{ backgroundColor: `rgba(34,197,94,${Math.min(0.35, dragX / 400)})` }}
            >
              <div className="flex items-center gap-2 text-green-700 font-bold text-2xl bg-white/80 px-4 py-2 rounded-2xl shadow">
                <Check className="w-6 h-6" /> Know
              </div>
            </div>
          )}
          {trackProgress && dragX < -20 && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
              style={{ backgroundColor: `rgba(239,68,68,${Math.min(0.35, -dragX / 400)})` }}
            >
              <div className="flex items-center gap-2 text-red-700 font-bold text-2xl bg-white/80 px-4 py-2 rounded-2xl shadow">
                <X className="w-6 h-6" /> Don't know
              </div>
            </div>
          )}
          <div
            key={current.id}
            className="absolute inset-0 flex items-center justify-center p-8 transition-transform duration-500"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front - Chinese */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-8"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <p
                className="text-6xl sm:text-7xl font-bold text-gray-800 text-center break-words leading-tight"
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
              <p className="absolute bottom-4 text-xs text-gray-400 px-4 text-center">Click or press space to flip</p>
            </div>
            {/* Back - Pinyin + English */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-8"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <p className="text-3xl sm:text-4xl font-medium text-amber-700 mb-3 text-center break-words leading-tight">{current.pinyin}</p>
              <p className="text-2xl sm:text-3xl text-gray-700 text-center break-words leading-tight">{current.english}</p>
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
          {trackProgress ? (
            <button
              onClick={() => markAndAdvance('dont_know')}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium shadow"
              title="Left arrow"
            >
              <X className="w-5 h-5" /> Don't know
            </button>
          ) : (
            <button
              onClick={prev}
              disabled={idx === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white shadow hover:shadow-md disabled:opacity-40"
            >
              <ChevronLeft className="w-5 h-5" /> Prev
            </button>
          )}

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

          {trackProgress ? (
            <button
              onClick={() => markAndAdvance('known')}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium shadow"
              title="Right arrow"
            >
              <Check className="w-5 h-5" /> Know
            </button>
          ) : (
            <button
              onClick={next}
              disabled={idx === order.length - 1}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white shadow hover:shadow-md disabled:opacity-40"
            >
              Next <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {trackProgress && (
          <p className="text-center text-xs text-gray-400 mt-3">
            Shortcuts: space = flip · ← / swipe left = don't know · → / swipe right = know
          </p>
        )}
      </div>
    </div>
  );
}
