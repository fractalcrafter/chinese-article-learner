import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Volume2, Shuffle, ChevronLeft, ChevronRight,
  RotateCcw, Check, X, Target, Brain, Undo2, Sparkles,
} from 'lucide-react';
import { getStudySet, type StudySet, type StudySetItem } from '../lib/api';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

type Status = 'unseen' | 'known' | 'dont_know';

const HIDDEN_KEY = (setId: number) => `monkey_hidden_${setId}`;

function addToHidden(setId: number, vocabId: number) {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY(setId));
    const arr: number[] = raw ? JSON.parse(raw) : [];
    if (!arr.includes(vocabId)) {
      arr.push(vocabId);
      localStorage.setItem(HIDDEN_KEY(setId), JSON.stringify(arr));
    }
  } catch {}
}

function removeFromHidden(setId: number, vocabId: number) {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY(setId));
    if (!raw) return;
    const arr: number[] = JSON.parse(raw);
    const next = arr.filter((id) => id !== vocabId);
    localStorage.setItem(HIDDEN_KEY(setId), JSON.stringify(next));
  } catch {}
}

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
  const location = useLocation();
  const subsetIds: number[] | undefined = (location.state as any)?.subsetIds;
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
  const [enterDir, setEnterDir] = useState<null | 'left' | 'right'>(null);
  const [carouselTarget, setCarouselTarget] = useState(0);
  const [instantSnap, setInstantSnap] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  type UndoEntry = {
    cardId: number;
    idx: number;
    prevStatus: Status | undefined;
    addedToHidden: boolean;
    prevStreak: number;
    prevBestStreak: number;
  };
  const [history, setHistory] = useState<UndoEntry[]>([]);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipedRef = useRef(false);
  const isAnimatingRef = useRef(false);
  const { speak } = useSpeechSynthesis();

  // Swipe thresholds (px) — kept generous so flicks register reliably on iOS
  const SWIPE_DISTANCE = 45;
  const SWIPE_FLICK_DISTANCE = 22;
  const SWIPE_FLICK_MAX_MS = 280;
  const SWIPE_MAX_VERTICAL = 100;
  const TAP_MAX_MOVE = 6;
  const EXIT_DURATION = 200;
  const ENTER_DURATION = 220;

  useEffect(() => {
    (async () => {
      try {
        const s = await getStudySet(setId);
        setSet(s);
        const items = subsetIds && subsetIds.length > 0
          ? s.items.filter(i => subsetIds.includes(i.id))
          : s.items;
        setOrder(items);
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
    const prevStatus = statuses[current.id];
    const wasHidden = (() => {
      try {
        const raw = localStorage.getItem(HIDDEN_KEY(setId));
        return raw ? (JSON.parse(raw) as number[]).includes(current.id) : false;
      } catch { return false; }
    })();

    setStatuses(s => ({ ...s, [current.id]: status }));

    // Auto-hide "known" terms from future study sessions for this set
    let addedToHidden = false;
    if (status === 'known' && !wasHidden) {
      addToHidden(setId, current.id);
      addedToHidden = true;
    }

    // Streak (shown in header badge only; no toasts)
    const prevStreak = streak;
    const prevBestStreak = bestStreak;
    if (status === 'known') {
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > bestStreak) setBestStreak(newStreak);
    } else {
      setStreak(0);
    }

    setHistory(h => [...h, {
      cardId: current.id,
      idx,
      prevStatus,
      addedToHidden,
      prevStreak,
      prevBestStreak,
    }]);

    if (idx < order.length - 1) {
      setFlipped(false);
      setIdx(i => i + 1);
    } else {
      setFlipped(false);
    }
  };

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setStatuses(s => {
      const copy = { ...s };
      if (last.prevStatus === undefined) {
        delete copy[last.cardId];
      } else {
        copy[last.cardId] = last.prevStatus;
      }
      return copy;
    });
    if (last.addedToHidden) {
      removeFromHidden(setId, last.cardId);
    }
    setStreak(last.prevStreak);
    setBestStreak(last.prevBestStreak);
    setIdx(last.idx);
    setFlipped(false);
  };
  const baseItems = useMemo(() => {
    if (!set) return [];
    return subsetIds && subsetIds.length > 0
      ? set.items.filter(i => subsetIds.includes(i.id))
      : set.items;
  }, [set, subsetIds]);

  const toggleShuffle = () => {
    if (isShuffled) {
      setOrder(baseItems);
      setIsShuffled(false);
    } else {
      setOrder(shuffle(order));
      setIsShuffled(true);
    }
    setIdx(0);
    setFlipped(false);
    setHistory([]);
  };
  const restart = () => { setIdx(0); setFlipped(false); setHistory([]); };
  const resetProgress = () => {
    setStatuses({});
    setIdx(0);
    setFlipped(false);
    setStreak(0);
    setBestStreak(0);
    setHistory([]);
  };
  const restartWholeSet = () => {
    setOrder(isShuffled ? shuffle(baseItems) : baseItems);
    resetProgress();
  };
  const studyDontKnows = () => {
    const remaining = order.filter(item => statuses[item.id] === 'dont_know');
    if (remaining.length === 0) return;
    setOrder(remaining);
    resetProgress();
  };

  // Touch swipe handlers (iOS + Android). Tap = flip; horizontal swipe = mark.
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    swipedRef.current = false;
    setIsDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
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
    touchStart.current = null;
    if (!start) { setDragX(0); return; }
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const elapsed = Date.now() - start.t;
    const isFlick = elapsed < SWIPE_FLICK_MAX_MS && absDx >= SWIPE_FLICK_DISTANCE;
    const isSwipe =
      absDy < SWIPE_MAX_VERTICAL &&
      absDx > absDy &&
      (absDx > SWIPE_DISTANCE || isFlick);

    if (!isSwipe) {
      // Not a swipe — bounce back
      setDragX(0);
      return;
    }

    swipedRef.current = true;
    e.preventDefault();
    const direction = dx > 0 ? 1 : -1;
    isAnimatingRef.current = true;

    if (trackProgress) {
      // ON mode: fly-off + slide-in (visual matches the "mark" action)
      setExitX(direction * (window.innerWidth || 400));
      setDragX(0);
      window.setTimeout(() => {
        markAndAdvance(direction > 0 ? 'known' : 'dont_know');
        setExitX(0);
        setEnterDir(direction > 0 ? 'left' : 'right');
        window.setTimeout(() => {
          setEnterDir(null);
          isAnimatingRef.current = false;
        }, ENTER_DURATION);
      }, EXIT_DURATION);
    } else {
      // OFF mode: photo-style carousel slide.
      // Swipe LEFT -> advance to NEXT. Swipe RIGHT -> go to PREV.
      const w = window.innerWidth || 400;
      setCarouselTarget(direction * w);
      setDragX(0);
      window.setTimeout(() => {
        // Snap track back to 0 INSTANTLY (no transition) and advance the index.
        // Without instantSnap, the track would animate from +/-width back to 0
        // and produce the visible bounce-back.
        setInstantSnap(true);
        if (direction > 0) prev(); else next();
        setCarouselTarget(0);
        // Re-enable the transition for the next swipe after the browser paints
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setInstantSnap(false);
            isAnimatingRef.current = false;
          });
        });
      }, 260);
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (trackProgress && history.length > 0) {
          e.preventDefault();
          undo();
        }
        return;
      }
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
  }, [order.length, idx, trackProgress, current?.id, history.length]);

  const renderCardFace = (item: StudySetItem, isFlipped: boolean, interactive: boolean) => (
    <div
      className={`relative w-full h-full bg-white rounded-3xl shadow-xl ${interactive ? 'cursor-pointer' : ''}`}
      style={{ perspective: '1000px' }}
    >
      <div
        key={item.id}
        className="absolute inset-0 flex items-center justify-center p-8 transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-8"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <p
            className="text-6xl sm:text-7xl font-bold text-gray-800 text-center break-words leading-tight"
            style={{ fontFamily: 'var(--font-chinese)' }}
          >
            {item.chinese}
          </p>
          {interactive && (
            <button
              onClick={(e) => { e.stopPropagation(); speak(item.chinese); }}
              className="mt-6 p-3 bg-amber-100 hover:bg-amber-200 rounded-full"
              title="Listen"
            >
              <Volume2 className="w-6 h-6 text-amber-700" />
            </button>
          )}
          {interactive && (
            <p className="absolute bottom-4 text-xs text-gray-400 px-4 text-center">Click or press space to flip</p>
          )}
        </div>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-6 sm:p-8"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <p className="text-3xl sm:text-4xl font-medium text-amber-700 mb-2 text-center break-words leading-tight">{item.pinyin}</p>
          {item.pronunciation_hint && (
            <p
              className="mb-3 text-xs sm:text-sm text-amber-600 text-center italic flex items-start gap-1 max-w-md"
              title="How to pronounce"
            >
              <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{item.pronunciation_hint}</span>
            </p>
          )}
          <p className="text-2xl sm:text-3xl text-gray-700 text-center break-words leading-tight">{item.english}</p>
          {item.example_sentence && (
            <p
              className="mt-6 text-base text-gray-500 text-center italic"
              style={{ fontFamily: 'var(--font-chinese)' }}
            >
              {item.example_sentence}
            </p>
          )}
          {interactive && (
            <p className="absolute bottom-4 text-xs text-gray-400">Click or press space to flip back</p>
          )}
        </div>
      </div>
    </div>
  );

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

        <div className="flex items-center justify-between mb-4 gap-3">
          <h1 className="text-2xl font-bold text-amber-800 truncate">{set.title}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {trackProgress && streak >= 3 && (
              <span className="flex items-center gap-1 text-orange-600 font-semibold bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full text-xs animate-pulse">
                🔥 {streak} streak
              </span>
            )}
            <span className="text-sm text-gray-600 font-medium">{progress}</span>
          </div>
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

        {/* ============ Celebration screen ============ */}
        {trackProgress && reviewedAll ? (
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 text-center">
            <div className="text-6xl mb-2">
              {dontKnowCount === 0 ? '🏆' : knownCount > dontKnowCount ? '🎉' : '💪'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">
              {dontKnowCount === 0
                ? 'Perfect run!'
                : knownCount === 0
                  ? "Tough one — keep going!"
                  : knownCount > dontKnowCount
                    ? 'Nicely done!'
                    : 'Solid effort!'}
            </h2>
            <p className="text-gray-500 mb-1">
              You knew <span className="font-semibold text-green-700">{knownCount}</span> out of {order.length}
              {' '}({Math.round((knownCount / order.length) * 100)}%)
            </p>
            {knownCount > 0 && (
              <p className="text-xs text-gray-400 mb-1">
                ✓ {knownCount} known {knownCount === 1 ? 'term has' : 'terms have'} been hidden from this set. Use "Show all" on the set page to bring {knownCount === 1 ? 'it' : 'them'} back.
              </p>
            )}
            {bestStreak >= 3 && (
              <p className="text-sm text-orange-600 font-medium mb-1">
                🔥 Best streak this round: {bestStreak}
              </p>
            )}

            {/* Big visual breakdown bar */}
            <div className="flex h-4 w-full rounded-full overflow-hidden mt-4 mb-6 bg-gray-100">
              {knownCount > 0 && (
                <div
                  className="bg-green-500 flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: `${(knownCount / order.length) * 100}%` }}
                  title={`${knownCount} known`}
                >
                  {knownCount / order.length > 0.12 ? knownCount : ''}
                </div>
              )}
              {dontKnowCount > 0 && (
                <div
                  className="bg-red-400 flex items-center justify-center text-white text-xs font-bold"
                  style={{ width: `${(dontKnowCount / order.length) * 100}%` }}
                  title={`${dontKnowCount} don't know`}
                >
                  {dontKnowCount / order.length > 0.12 ? dontKnowCount : ''}
                </div>
              )}
            </div>

            {/* Don't-know list */}
            {dontKnowCount > 0 && (
              <div className="text-left bg-red-50 border border-red-200 rounded-xl p-4 mb-6 max-h-60 overflow-y-auto">
                <p className="text-sm font-semibold text-red-800 mb-2">
                  Worth another look ({dontKnowCount}):
                </p>
                <div className="space-y-1.5">
                  {order.filter(it => statuses[it.id] === 'dont_know').map(it => (
                    <div key={it.id} className="flex items-baseline gap-2 text-sm">
                      <span
                        className="font-medium text-gray-800"
                        style={{ fontFamily: 'var(--font-chinese)' }}
                      >
                        {it.chinese}
                      </span>
                      <span className="text-amber-700">{it.pinyin}</span>
                      <span className="text-gray-500 truncate">— {it.english}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center flex-wrap">
              {dontKnowCount > 0 && (
                <>
                  <button
                    onClick={studyDontKnows}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold shadow-lg"
                  >
                    <Target className="w-5 h-5" /> Study {dontKnowCount} I don't know
                  </button>
                  <button
                    onClick={() => {
                      const ids = order.filter(it => statuses[it.id] === 'dont_know').map(it => it.id);
                      navigate(`/sets/${setId}/learn`, {
                        state: { subsetIds: ids, subsetLabel: `${ids.length} to learn` },
                      });
                    }}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold shadow-lg"
                  >
                    <Brain className="w-5 h-5" /> Learn {dontKnowCount} I don't know
                  </button>
                </>
              )}
              <button
                onClick={restartWholeSet}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-lg"
              >
                <RotateCcw className="w-5 h-5" /> Restart whole set
              </button>
            </div>
            <button
              onClick={() => navigate(`/sets/${setId}`)}
              className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Back to set
            </button>
          </div>
        ) : (
        <>
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

        {/* Card viewport (carousel in OFF mode, single card in ON mode) */}
        {trackProgress ? (
        <div
          onClick={onCardClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => { setIsDragging(false); setDragX(0); touchStart.current = null; }}
          className={`relative w-full h-96 sm:h-80 bg-white rounded-3xl shadow-xl cursor-pointer mb-6 select-none overflow-hidden ${
            enterDir === 'right' ? 'card-enter-from-right' : enterDir === 'left' ? 'card-enter-from-left' : ''
          }`}
          style={{
            perspective: '1000px',
            touchAction: 'pan-y',
            transform: enterDir
              ? undefined
              : exitX !== 0
                ? `translateX(${exitX}px) rotate(${exitX * 0.06}deg)`
                : dragX !== 0
                  ? `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`
                  : undefined,
            transition: isDragging
              ? 'none'
              : enterDir
                ? 'none'
                : exitX !== 0
                  ? `transform ${EXIT_DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${EXIT_DURATION}ms ease-out`
                  : 'transform 180ms ease-out',
            opacity: exitX !== 0 ? 0 : 1,
          }}
        >
          {/* Swipe hint overlays (visible during drag) */}
          {dragX > 20 && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
              style={{ backgroundColor: `rgba(34,197,94,${Math.min(0.35, dragX / 400)})` }}
            >
              <div className="flex items-center gap-2 text-green-700 font-bold text-2xl bg-white/80 px-4 py-2 rounded-2xl shadow">
                <Check className="w-6 h-6" /> Know
              </div>
            </div>
          )}
          {dragX < -20 && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
              style={{ backgroundColor: `rgba(239,68,68,${Math.min(0.35, -dragX / 400)})` }}
            >
              <div className="flex items-center gap-2 text-red-700 font-bold text-2xl bg-white/80 px-4 py-2 rounded-2xl shadow">
                <X className="w-6 h-6" /> Don't know
              </div>
            </div>
          )}
          {renderCardFace(current, flipped, true)}
        </div>
        ) : (
        <div
          className="relative w-full h-96 sm:h-80 mb-6 select-none overflow-hidden rounded-3xl"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={() => { setIsDragging(false); setDragX(0); touchStart.current = null; }}
          style={{ touchAction: 'pan-y' }}
        >
          {/* Carousel track: prev | current | next */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translateX(${isDragging ? dragX : (carouselTarget !== 0 ? carouselTarget : 0)}px)`,
              transition: isDragging || instantSnap ? 'none' : 'transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1)',
            }}
          >
            {/* Previous card (off-screen left) */}
            {idx > 0 && (
              <div className="absolute inset-0" style={{ transform: 'translateX(-100%)' }}>
                {renderCardFace(order[idx - 1], false, false)}
              </div>
            )}
            {/* Current card (centered) */}
            <div className="absolute inset-0" onClick={onCardClick}>
              {renderCardFace(current, flipped, true)}
            </div>
            {/* Next card (off-screen right) */}
            {idx < order.length - 1 && (
              <div className="absolute inset-0" style={{ transform: 'translateX(100%)' }}>
                {renderCardFace(order[idx + 1], false, false)}
              </div>
            )}
          </div>
        </div>
        )}

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
            {trackProgress && (
              <button
                onClick={undo}
                disabled={history.length === 0}
                className="flex items-center gap-1 px-3 py-2 rounded-xl shadow hover:shadow-md bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                title="Undo last mark (Ctrl/Cmd+Z)"
                aria-label="Undo last mark"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            )}
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
            Shortcuts: space = flip · ← / swipe left = don't know · → / swipe right = know · ⌘/Ctrl+Z = undo
          </p>
        )}
        </>
        )}
      </div>
    </div>
  );
}
