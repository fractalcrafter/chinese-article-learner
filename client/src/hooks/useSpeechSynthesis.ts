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
        console.log('Loaded voices:', availableVoices.map(v => `${v.name} (${v.lang})`));
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
    if (!text || typeof text !== 'string') {
      console.warn('Invalid text passed to speak:', text);
      return;
    }

    console.log('Speaking text:', text, 'lang:', lang);

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.8; // Slower for learning
    utterance.pitch = 1;
    utterance.volume = 1;

    // Find a Chinese voice - prioritize zh-CN voices
    const chineseVoice = voices.find(voice => voice.lang === 'zh-CN') ||
                         voices.find(voice => voice.lang.startsWith('zh-CN')) ||
                         voices.find(voice => voice.lang.startsWith('zh')) ||
                         voices.find(voice => voice.lang.includes('Chinese'));
    
    if (chineseVoice) {
      console.log('Using voice:', chineseVoice.name, chineseVoice.lang);
      utterance.voice = chineseVoice;
    } else {
      console.warn('No Chinese voice found, using default. Available voices:', 
        voices.map(v => `${v.name} (${v.lang})`));
    }

    // Store in ref to prevent garbage collection
    utteranceRef.current = utterance;

    // Add error handler
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
    };

    utterance.onstart = () => {
      console.log('Speech started');
    };

    utterance.onend = () => {
      console.log('Speech ended');
    };

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
