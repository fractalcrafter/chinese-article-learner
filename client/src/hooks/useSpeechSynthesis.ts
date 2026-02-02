import { useCallback, useRef, useEffect, useState } from 'react';

export interface UseSpeechSynthesisReturn {
  speak: (text: string, lang?: string) => void;
  stop: () => void;
  isSupported: boolean;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  
  // Store utterance in ref to prevent garbage collection (Chrome bug)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Cache voices when they become available
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // Load voices - they load asynchronously in most browsers
  useEffect(() => {
    if (!isSupported) return;
    
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
      }
    };
    
    // Try to load immediately (works in Firefox)
    loadVoices();
    
    // Listen for voiceschanged event (needed for Chrome/Edge)
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [isSupported]);

  const speak = useCallback((text: string, lang = 'zh-CN') => {
    if (!isSupported) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; // Slightly slower for learning
    utterance.pitch = 1;

    // Find a Chinese voice from cached voices
    const chineseVoice = voices.find(
      voice => voice.lang.startsWith('zh') || voice.lang.includes('Chinese')
    );
    
    if (chineseVoice) {
      utterance.voice = chineseVoice;
    }

    // Store in ref to prevent garbage collection
    utteranceRef.current = utterance;

    window.speechSynthesis.speak(utterance);
  }, [isSupported, voices]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
  }, [isSupported]);

  return {
    speak,
    stop,
    isSupported,
  };
}
