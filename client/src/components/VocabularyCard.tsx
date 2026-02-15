import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import HanziWriter from 'hanzi-writer';
import type { Vocabulary } from '../lib/api';

interface VocabularyCardProps {
  vocabulary: Vocabulary;
  onSpeak: (text: string) => void;
}

export function VocabularyCard({ vocabulary, onSpeak }: VocabularyCardProps) {
  // One ref per character container, and one HanziWriter per character
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const writersRef = useRef<HanziWriter[]>([]);

  // Extract individual Chinese characters (filter out non-CJK)
  const chars = [...vocabulary.chinese].filter(ch => {
    const code = ch.codePointAt(0) || 0;
    return (code >= 0x4E00 && code <= 0x9FFF) ||
           (code >= 0x3400 && code <= 0x4DBF) ||
           (code >= 0x20000 && code <= 0x2A6DF);
  });

  useEffect(() => {
    if (!containerRef.current || chars.length === 0) return;

    // Clean up previous writers before creating new ones
    writersRef.current.forEach(w => {
      try { w.hideCharacter(); } catch (_) { /* ignore */ }
    });
    containerRef.current.innerHTML = '';
    writersRef.current = [];

    // Determine size based on character count (smaller for more chars)
    const size = chars.length <= 2 ? 100 : 60;

    for (const char of chars) {
      const charDiv = document.createElement('div');
      charDiv.style.width = `${size}px`;
      charDiv.style.height = `${size}px`;
      charDiv.style.display = 'inline-block';
      containerRef.current.appendChild(charDiv);

      try {
        const writer = HanziWriter.create(charDiv, char, {
          width: size,
          height: size,
          padding: 3,
          strokeColor: '#d97706',
          radicalColor: '#92400e',
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 200,
          showOutline: true,
          showCharacter: true,
        });
        writersRef.current.push(writer);
      } catch (e) {
        console.warn('Could not create HanziWriter for:', char);
      }
    }

    return () => {
      writersRef.current.forEach(w => {
        try { w.hideCharacter(); } catch (_) { /* ignore */ }
      });
      writersRef.current = [];
    };
  }, [vocabulary.chinese]);

  // Animate all characters sequentially, capturing writers array to avoid stale refs
  const handleAnimate = () => {
    const writers = writersRef.current;
    if (writers.length === 0 || isAnimating) return;
    setIsAnimating(true);

    let i = 0;
    const animateNext = () => {
      // Check writers still match current ref (vocab didn't change mid-animation)
      if (i >= writers.length || writers !== writersRef.current) {
        setIsAnimating(false);
        return;
      }
      writers[i].animateCharacter({
        onComplete: () => {
          i++;
          animateNext();
        },
      });
    };
    animateNext();
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex gap-4">
        {/* Stroke Animation - shows all characters side by side */}
        <div 
          className="flex-shrink-0 cursor-pointer hover:bg-amber-50 rounded-lg transition-colors p-1"
          onClick={handleAnimate}
          title="Click to see stroke order"
        >
          <div ref={containerRef} className="flex" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              {/* Emoji & Chinese */}
              <div className="flex items-center gap-2 mb-1">
                {vocabulary.emoji && (
                  <span className="text-2xl">{vocabulary.emoji}</span>
                )}
                <span 
                  className="text-2xl font-bold text-gray-900"
                  style={{ fontFamily: '"Noto Sans SC", sans-serif' }}
                >
                  {vocabulary.chinese}
                </span>
              </div>

              {/* Pinyin */}
              <p className="text-amber-600 font-medium mb-1">
                {vocabulary.pinyin}
              </p>

              {/* English */}
              <p className="text-gray-700">
                {vocabulary.english}
              </p>
            </div>

            {/* Speak Button */}
            <button
              onClick={() => onSpeak(vocabulary.chinese)}
              className="p-2 bg-amber-100 hover:bg-amber-200 rounded-full transition-colors flex-shrink-0"
              title="Listen to pronunciation"
            >
              <Volume2 className="w-5 h-5 text-amber-700" />
            </button>
          </div>

          {/* Example Sentence */}
          {vocabulary.example_sentence && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Example:</p>
              <p 
                className="text-gray-700"
                style={{ fontFamily: '"Noto Sans SC", sans-serif' }}
              >
                {vocabulary.example_sentence}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
