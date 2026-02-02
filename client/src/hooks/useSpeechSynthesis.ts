import { useCallback, useRef, useEffect, useState } from 'react';

export interface UseSpeechSynthesisReturn {
  speak: (text: string, lang?: string) => void;
  stop: () => void;
  isSupported: boolean;
  voicesLoaded: boolean;
  hasChineseVoice: boolean;
  chineseVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  
  // Store utterance in ref to prevent garbage collection (Chrome bug)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Cache voices when they become available
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [hasChineseVoice, setHasChineseVoice] = useState(false);
  const [chineseVoices, setChineseVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  
  // Load voices - they load asynchronously in most browsers
  useEffect(() => {
    if (!isSupported) return;
    
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        setVoicesLoaded(true);
        
        // Filter Chinese voices - catch various formats (zh-CN, zh-TW, zh_CN, Chinese, etc.)
        const zhVoices = availableVoices.filter(v => 
          v.lang.startsWith('zh') || 
          v.lang.includes('Chinese') ||
          v.name.includes('Chinese') ||
          v.name.includes('Xiaoxiao') ||
          v.name.includes('Yunyang') ||
          v.name.includes('Huihui') ||
          v.name.includes('Kangkang') ||
          v.name.includes('Yaoyao') ||
          v.name.includes('Yunxi')
        );
        setChineseVoices(zhVoices);
        setHasChineseVoice(zhVoices.length > 0);
        
        console.log('Loaded', availableVoices.length, 'total voices');
        console.log('Chinese voices found:', zhVoices.length);
        console.log('Chinese voices:', zhVoices.map(v => `${v.name} (${v.lang})`));
        // Also log all voices for debugging
        console.log('All voices:', availableVoices.map(v => `${v.name} (${v.lang})`));
        
        // Auto-select best Chinese voice if none selected
        if (!selectedVoice && zhVoices.length > 0) {
          // Prefer Natural/Online voices, then zh-CN, then any zh
          const preferred = zhVoices.find(v => v.name.includes('Natural')) ||
                           zhVoices.find(v => v.name.includes('Online')) ||
                           zhVoices.find(v => v.lang === 'zh-CN') ||
                           zhVoices[0];
          setSelectedVoice(preferred);
        }
        
        if (zhVoices.length === 0) {
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

    // Use selected voice if available, otherwise find one
    if (selectedVoice) {
      console.log('Using selected voice:', selectedVoice.name, selectedVoice.lang);
      utterance.voice = selectedVoice;
    } else {
      // Fallback: try to find a Chinese voice
      const currentVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      const fallbackVoice = currentVoices.find(v => v.lang === 'zh-CN') ||
                            currentVoices.find(v => v.lang.startsWith('zh'));
      if (fallbackVoice) {
        console.log('Using fallback voice:', fallbackVoice.name, fallbackVoice.lang);
        utterance.voice = fallbackVoice;
      } else {
        console.warn('No Chinese voice found! Speech may be incorrect.');
      }
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
  }, [isSupported, voices, selectedVoice]);

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
    chineseVoices,
    selectedVoice,
    setSelectedVoice,
  };
}
