import { useCallback, useRef, useEffect, useState } from 'react';

export interface UseSpeechSynthesisReturn {
  speak: (text: string, lang?: string) => void;
  stop: () => void;
  isSupported: boolean;
  voicesLoaded: boolean;
  hasChineseVoice: boolean;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  
  // Store utterance in ref to prevent garbage collection (Chrome bug)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Cache voices when they become available
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [hasChineseVoice, setHasChineseVoice] = useState(false);
  
  // Load voices - they load asynchronously in most browsers
  useEffect(() => {
    if (!isSupported) return;
    
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        setVoicesLoaded(true);
        
        // Check for Chinese voices
        const chineseVoices = availableVoices.filter(v => v.lang.startsWith('zh'));
        setHasChineseVoice(chineseVoices.length > 0);
        
        console.log('Loaded', availableVoices.length, 'voices');
        console.log('Chinese voices:', chineseVoices.map(v => `${v.name} (${v.lang})`));
        
        if (chineseVoices.length === 0) {
          console.warn('No Chinese voice available! Install Chinese language pack in Windows Settings > Language.');
        }
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

    console.log('TTS speak() called with:', JSON.stringify(text));

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.8; // Slower for learning
    utterance.pitch = 1;
    utterance.volume = 1;

    // Find a Chinese voice - MUST set voice for Chinese to work properly
    // Get fresh voices list each time (in case they loaded after component mounted)
    const currentVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
    
    // Priority: Microsoft Chinese voices (best quality) > other zh-CN > zh-TW > any zh
    let selectedVoice = currentVoices.find(v => v.lang === 'zh-CN' && v.name.includes('Microsoft')) ||
                        currentVoices.find(v => v.lang === 'zh-CN') ||
                        currentVoices.find(v => v.lang === 'zh-TW') ||
                        currentVoices.find(v => v.lang.startsWith('zh'));
    
    if (selectedVoice) {
      console.log('Using Chinese voice:', selectedVoice.name, selectedVoice.lang);
      utterance.voice = selectedVoice;
    } else {
      console.warn('No Chinese voice found! Speech may be incorrect.');
      console.warn('Available voices:', currentVoices.map(v => `${v.name}(${v.lang})`).join(', '));
      // Still try to speak - lang setting might help on some systems
    }

    // Store in ref to prevent garbage collection
    utteranceRef.current = utterance;

    // Add handlers for debugging
    utterance.onstart = () => console.log('TTS started');
    utterance.onend = () => console.log('TTS ended');
    utterance.onerror = (event) => {
      console.error('TTS error:', event.error);
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
    hasChineseVoice,
  };
}
