import { useCallback, useRef, useEffect, useState } from 'react';

export interface UseSpeechSynthesisReturn {
  speak: (text: string, lang?: string) => void;
  stop: () => void;
  isSupported: boolean;
  voicesLoaded: boolean;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  
  // Store utterance in ref to prevent garbage collection (Chrome bug)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Cache voices when they become available
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  
  // Load voices - they load asynchronously in most browsers
  useEffect(() => {
    if (!isSupported) return;
    
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        setVoicesLoaded(true);
        console.log('Loaded', availableVoices.length, 'voices');
        // Log Chinese voices specifically
        const chineseVoices = availableVoices.filter(v => v.lang.startsWith('zh'));
        console.log('Chinese voices:', chineseVoices.map(v => `${v.name} (${v.lang})`));
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
    if (!isSupported) {
      console.warn('Speech synthesis not supported');
      return;
    }
    
    if (!text || typeof text !== 'string') {
      console.warn('Invalid text passed to speak:', text);
      return;
    }

    console.log('Speaking text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.8; // Slower for learning
    utterance.pitch = 1;
    utterance.volume = 1;

    // Find a Chinese voice - MUST set voice for Chinese to work properly
    // Priority: zh-CN > zh-TW > any zh voice
    let selectedVoice: SpeechSynthesisVoice | undefined;
    
    if (voices.length > 0) {
      selectedVoice = voices.find(voice => voice.lang === 'zh-CN') ||
                      voices.find(voice => voice.lang === 'zh-TW') ||
                      voices.find(voice => voice.lang.startsWith('zh-CN')) ||
                      voices.find(voice => voice.lang.startsWith('zh'));
    } else {
      // Try getting voices again directly (fallback)
      const currentVoices = window.speechSynthesis.getVoices();
      selectedVoice = currentVoices.find(voice => voice.lang === 'zh-CN') ||
                      currentVoices.find(voice => voice.lang === 'zh-TW') ||
                      currentVoices.find(voice => voice.lang.startsWith('zh'));
    }
    
    if (selectedVoice) {
      console.log('Using Chinese voice:', selectedVoice.name, selectedVoice.lang);
      utterance.voice = selectedVoice;
    } else {
      console.warn('No Chinese voice found! Text may be read incorrectly.');
      console.warn('Available voices:', voices.map(v => v.lang).join(', '));
    }

    // Store in ref to prevent garbage collection
    utteranceRef.current = utterance;

    // Add error handler
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
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
    voicesLoaded,
  };
}
