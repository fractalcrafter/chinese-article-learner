import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import HanziWriter from 'hanzi-writer';
import type { Vocabulary } from '../lib/api';

interface VocabularyCardProps {
  vocabulary: Vocabulary;
  onSpeak: (text: string) => void;
}

export function VocabularyCard({ vocabulary, onSpeak }: VocabularyCardProps) {
  const strokeRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const writerRef = useRef<HanziWriter | null>(null);

  useEffect(() => {
    if (!strokeRef.current || !vocabulary.chinese) return;

    // Clear previous writer
    strokeRef.current.innerHTML = '';

    // Get the first character for stroke animation
    const firstChar = vocabulary.chinese[0];
    
    try {
      const writer = HanziWriter.create(strokeRef.current, firstChar, {
        width: 120,
        height: 120,
        padding: 5,
        strokeColor: '#d97706', // amber-600
        radicalColor: '#92400e', // amber-800
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 200,
        showOutline: true,
        showCharacter: true,
      });
      
      writerRef.current = writer;
    } catch (e) {
      console.warn('Could not create HanziWriter for:', firstChar);
    }

    return () => {
      writerRef.current = null;
    };
  }, [vocabulary.chinese]);

  const handleAnimate = () => {
    if (writerRef.current && !isAnimating) {
      setIsAnimating(true);
      writerRef.current.animateCharacter({
        onComplete: () => setIsAnimating(false),
      });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex gap-4">
        {/* Stroke Animation */}
        <div 
          className="flex-shrink-0 cursor-pointer hover:bg-amber-50 rounded-lg transition-colors"
          onClick={handleAnimate}
          title="Click to see stroke order"
        >
          <div ref={strokeRef} className="w-[120px] h-[120px]" />
          {vocabulary.chinese.length > 1 && (
            <p className="text-xs text-center text-gray-400 mt-1">
              +{vocabulary.chinese.length - 1} more
            </p>
          )}
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
