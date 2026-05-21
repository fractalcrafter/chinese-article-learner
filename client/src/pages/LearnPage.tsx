import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Volume2, Check, X, Trophy, RotateCcw, ArrowRight,
} from 'lucide-react';
import { getStudySet, type StudySet, type StudySetItem } from '../lib/api';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

const ROUND_SIZE = 5;

interface Question {
  item: StudySetItem;
  options: StudySetItem[]; // includes the correct item
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestion(item: StudySetItem, allItems: StudySetItem[]): Question {
  const pool = allItems.filter(i => i.id !== item.id);
  const distractors = shuffle(pool).slice(0, Math.min(3, pool.length));
  return { item, options: shuffle([item, ...distractors]) };
}

export function LearnPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const subsetIds: number[] | undefined = (location.state as any)?.subsetIds;
  const subsetLabel: string | undefined = (location.state as any)?.subsetLabel;
  const setId = id ? parseInt(id) : 0;
  const [set, setSet] = useState<StudySet | null>(null);
  const [loading, setLoading] = useState(true);

  // Session-wide
  const [masteredIds, setMasteredIds] = useState<Set<number>>(new Set());
  const [roundNumber, setRoundNumber] = useState(1);

  // Round state
  const [roundItems, setRoundItems] = useState<StudySetItem[]>([]); // the items in this round (pre-shuffled order)
  const [queue, setQueue] = useState<StudySetItem[]>([]); // active question queue (head = current)
  const [firstTryFailed, setFirstTryFailed] = useState<Set<number>>(new Set());
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<null | { correct: boolean; chosen: StudySetItem }>(null);
  const [phase, setPhase] = useState<'question' | 'review' | 'done'>('question');

  const { speak } = useSpeechSynthesis();

  // If a subsetIds was passed via navigation state, restrict the learning pool to those.
  const subsetIdSet = useMemo(
    () => (subsetIds && subsetIds.length > 0 ? new Set(subsetIds) : null),
    [subsetIds]
  );
  const allItems = useMemo(() => {
    if (!set) return [];
    return subsetIdSet ? set.items.filter(i => subsetIdSet.has(i.id)) : set.items;
  }, [set, subsetIdSet]);
  const total = allItems.length;
  const masteredCount = masteredIds.size;

  // ============ Loading ============
  useEffect(() => {
    (async () => {
      try {
        const s = await getStudySet(setId);
        setSet(s);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [setId]);

  // ============ Round init ============
  const startRound = (mastered: Set<number>, roundNum: number) => {
    if (!set || allItems.length === 0) return;
    const remaining = allItems.filter(i => !mastered.has(i.id));
    if (remaining.length === 0) {
      setPhase('done');
      return;
    }
    const next = shuffle(remaining).slice(0, Math.min(ROUND_SIZE, remaining.length));
    setRoundItems(next);
    setQueue(next);
    setFirstTryFailed(new Set());
    setFeedback(null);
    setRoundNumber(roundNum);
    setPhase('question');
    setQuestion(buildQuestion(next[0], allItems));
  };

  // Auto-start first round when set loads
  useEffect(() => {
    if (set && phase === 'question' && !question && roundItems.length === 0 && allItems.length > 0) {
      startRound(new Set(), 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, allItems.length]);

  // ============ Answer handling ============
  const handleAnswer = (chosen: StudySetItem) => {
    if (!question || feedback) return;
    const correct = chosen.id === question.item.id;
    setFeedback({ correct, chosen });
    if (!correct) {
      setFirstTryFailed(prev => {
        const n = new Set(prev);
        n.add(question.item.id);
        return n;
      });
    }
  };

  const advance = () => {
    if (!question || !set) return;
    const wasCorrect = feedback?.correct;
    const currentItem = question.item;
    setFeedback(null);

    let newQueue = queue;
    let newMastered = masteredIds;

    if (wasCorrect) {
      // Remove the current item from the queue
      newQueue = queue.filter(i => i.id !== currentItem.id);
      // If they never failed it in this round, count as mastered
      if (!firstTryFailed.has(currentItem.id)) {
        newMastered = new Set(masteredIds);
        newMastered.add(currentItem.id);
        setMasteredIds(newMastered);
      }
    } else {
      // Move to back of queue
      newQueue = [...queue.slice(1), queue[0]];
    }
    setQueue(newQueue);

    if (newQueue.length === 0) {
      setPhase('review');
      setQuestion(null);
    } else {
      // Avoid immediate repeat of the same item if possible
      let nextItem = newQueue[0];
      if (newQueue.length > 1 && nextItem.id === currentItem.id) {
        nextItem = newQueue[1];
      }
      setQuestion(buildQuestion(nextItem, allItems));
    }
  };

  const continueToNextRound = () => {
    startRound(masteredIds, roundNumber + 1);
  };

  const restartAll = () => {
    setMasteredIds(new Set());
    setRoundItems([]);
    setQueue([]);
    setFirstTryFailed(new Set());
    setQuestion(null);
    setFeedback(null);
    setPhase('question');
    startRound(new Set(), 1);
  };

  // Keyboard shortcut: Enter advances after feedback / continues from review
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (feedback) { e.preventDefault(); advance(); }
        else if (phase === 'review') { e.preventDefault(); continueToNextRound(); }
      } else if (phase === 'question' && !feedback && question) {
        const num = parseInt(e.key);
        if (!isNaN(num) && num >= 1 && num <= question.options.length) {
          e.preventDefault();
          handleAnswer(question.options[num - 1]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, phase, question]);

  // ============ Render ============
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

  // Round progress: how many round items have been mastered or removed
  const roundRemaining = queue.length;
  const roundDone = roundItems.length - roundRemaining;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <button
          onClick={() => navigate(`/sets/${setId}`)}
          className="flex items-center gap-1 text-amber-700 hover:text-amber-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to set
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-amber-800 truncate">
            {set.title}
            {subsetIdSet && (
              <span className="ml-2 text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full align-middle">
                {subsetLabel ?? `${total} subset`}
              </span>
            )}
          </h1>
          <span className="text-sm text-gray-600 font-medium">
            {masteredCount} / {total} mastered
          </span>
        </div>

        {/* Overall progress bar */}
        <div className="mb-2">
          <div className="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all"
              style={{ width: `${(masteredCount / total) * 100}%` }}
            />
          </div>
        </div>

        {/* Round progress (inline) */}
        {phase !== 'done' && (
          <div className="flex items-center justify-between text-xs text-gray-500 mb-6">
            <span>Round {roundNumber}</span>
            {phase === 'question' && roundItems.length > 0 && (
              <span>{roundDone} / {roundItems.length} in this round</span>
            )}
          </div>
        )}

        {/* ============== DONE ============== */}
        {phase === 'done' ? (
          <div className="bg-white rounded-3xl shadow-xl p-10 text-center">
            <Trophy className="w-20 h-20 text-amber-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-800 mb-2">You mastered it all! 🎉</h2>
            <p className="text-gray-600 mb-6">All {total} terms mastered.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={restartAll}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold"
              >
                <RotateCcw className="w-5 h-5" /> Start over
              </button>
              <button
                onClick={() => navigate(`/sets/${setId}`)}
                className="px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        ) : phase === 'review' ? (
          /* ============== ROUND REVIEW ============== */
          <div className="bg-white rounded-3xl shadow-xl p-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold mb-3">
                <Check className="w-4 h-4" /> Round {roundNumber} complete
              </div>
              <h2 className="text-xl font-bold text-gray-800">Review what you just learned</h2>
              <p className="text-sm text-gray-500 mt-1">
                {roundItems.filter(i => masteredIds.has(i.id) && !firstTryFailed.has(i.id)).length} mastered ·
                {' '}{roundItems.filter(i => firstTryFailed.has(i.id)).length} need more practice
              </p>
            </div>

            <div className="space-y-2 mb-6">
              {roundItems.map(item => {
                const mastered = masteredIds.has(item.id);
                const failed = firstTryFailed.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                      mastered && !failed
                        ? 'bg-green-50 border-green-200'
                        : failed
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <p
                        className="text-2xl font-bold text-gray-800"
                        style={{ fontFamily: 'var(--font-chinese)' }}
                      >
                        {item.chinese}
                      </p>
                    </div>
                    <button
                      onClick={() => speak(item.chinese)}
                      className="p-1.5 text-amber-700 hover:bg-amber-100 rounded-full flex-shrink-0"
                      title="Listen"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-amber-700 font-medium">{item.pinyin}</p>
                      <p className="text-sm text-gray-700">{item.english}</p>
                    </div>
                    {mastered && !failed ? (
                      <span title="Got it first try" className="text-green-600">
                        <Check className="w-5 h-5" />
                      </span>
                    ) : failed ? (
                      <span title="Needed more tries" className="text-amber-600 text-xs font-medium">
                        review
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <button
              onClick={continueToNextRound}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-semibold shadow-lg"
            >
              {masteredCount >= total ? (
                <>Finish <Trophy className="w-5 h-5" /></>
              ) : (
                <>Continue to Round {roundNumber + 1} <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">Press Enter to continue</p>
          </div>
        ) : question ? (
          /* ============== QUESTION ============== */
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
            <p className="text-sm text-gray-500 text-center mb-4">
              Choose the pinyin
            </p>

            {/* Prompt — always Chinese characters */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <p
                  className="text-4xl sm:text-5xl font-bold text-gray-800 break-words"
                  style={{ fontFamily: 'var(--font-chinese)' }}
                >
                  {question.item.chinese}
                </p>
                <button
                  onClick={() => speak(question.item.chinese)}
                  className="p-2 bg-amber-100 hover:bg-amber-200 rounded-full"
                  title="Listen"
                >
                  <Volume2 className="w-5 h-5 text-amber-700" />
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {question.options.map((opt, i) => {
                const isCorrect = opt.id === question.item.id;
                const isChosen = feedback?.chosen.id === opt.id;
                let cls = 'border-amber-200 bg-amber-50 hover:bg-amber-100';
                if (feedback) {
                  if (isCorrect) cls = 'border-green-400 bg-green-50';
                  else if (isChosen) cls = 'border-red-400 bg-red-50';
                  else cls = 'border-amber-200 bg-amber-50 opacity-50';
                }
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleAnswer(opt)}
                    disabled={!!feedback}
                    className={`flex items-start gap-2 p-4 rounded-xl text-left transition-all border-2 ${cls}`}
                  >
                    <span className="text-xs text-gray-400 font-mono mt-1 flex-shrink-0">{i + 1}</span>
                    <span className="text-amber-800 font-medium break-words">{opt.pinyin}</span>
                    {feedback && isCorrect && (
                      <Check className="w-5 h-5 text-green-600 ml-auto flex-shrink-0" />
                    )}
                    {feedback && isChosen && !isCorrect && (
                      <X className="w-5 h-5 text-red-600 ml-auto flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Feedback panel */}
            {feedback && (
              <div
                className={`mt-6 p-4 rounded-xl flex flex-col sm:flex-row sm:items-start gap-3 ${
                  feedback.correct
                    ? 'bg-green-50 border-2 border-green-300'
                    : 'bg-red-50 border-2 border-red-300'
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {feedback.correct ? (
                    <Check className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <X className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold ${feedback.correct ? 'text-green-800' : 'text-red-800'}`}>
                      {feedback.correct ? 'Correct!' : 'Not quite — we\'ll come back to it'}
                    </p>
                    <p className="text-sm text-gray-700 mt-1 break-words">
                      <span
                        className="font-medium"
                        style={{ fontFamily: 'var(--font-chinese)' }}
                      >
                        {question.item.chinese}
                      </span>
                      {' '}({question.item.pinyin}) — {question.item.english}
                    </p>
                  </div>
                </div>
                <button
                  onClick={advance}
                  className="px-4 py-2 rounded-lg bg-white shadow hover:shadow-md text-sm font-medium w-full sm:w-auto flex-shrink-0"
                >
                  Continue →
                </button>
              </div>
            )}

            {!feedback && (
              <p className="text-center text-xs text-gray-400 mt-4">
                Tip: press 1–{question.options.length} to choose · Enter to continue after feedback
              </p>
            )}
          </div>
        ) : null}

        {/* Restart */}
        {phase !== 'done' && (
          <button
            onClick={restartAll}
            className="mt-6 flex items-center gap-1 mx-auto text-sm text-gray-500 hover:text-gray-700"
          >
            <RotateCcw className="w-4 h-4" /> Restart session
          </button>
        )}
      </div>
    </div>
  );
}
