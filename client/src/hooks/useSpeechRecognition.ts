import { useState, useEffect, useCallback, useRef } from 'react';

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface UseSpeechRecognitionReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

// Module-level constant to avoid unnecessary hook recreation
const MAX_RESTART_ATTEMPTS = 10;

// Helper: Add punctuation for Chinese text if it doesn't end with punctuation
function addChinesePunctuation(text: string, isFinalStop = false): string {
  if (!text) return text;
  const trimmed = text.trim();
  if (!trimmed) return text;
  
  // Chinese punctuation marks
  const endPunctuation = ['。', '！', '？', '；'];
  const allPunctuation = [...endPunctuation, '，', '、', '：', '"', '"', "'", "'", '…', '—'];
  const lastChar = trimmed[trimmed.length - 1];
  
  // If already ends with punctuation, return as-is
  if (allPunctuation.includes(lastChar) || /[.!?,;:]$/.test(lastChar)) {
    return text;
  }
  
  // Add period if it's a final stop, otherwise comma for natural pauses
  return text + (isFinalStop ? '。' : '，');
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    language = 'zh-CN',
    continuous = true,  // Back to continuous for reliability
    interimResults = true,  // Show interim results for better UX
  } = options;

  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);  // Track listening state for callbacks
  const shouldRestartRef = useRef(false);  // Track if we should auto-restart
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartAttemptsRef = useRef(0);  // Track restart attempts to prevent infinite loops
  const pendingRestartDelayRef = useRef<number | null>(null);  // Track pending restart delay to prevent onend override
  const isMountedRef = useRef(true);  // Track mount state to prevent state updates after unmount
  
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Helper to safely restart recognition with retry logic
  const attemptRestart = useCallback((delayMs: number = 100, force: boolean = false) => {
    // Don't override a longer pending delay unless forced (e.g., network backoff)
    if (!force && pendingRestartDelayRef.current !== null && pendingRestartDelayRef.current > delayMs) {
      return;
    }
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    if (!shouldRestartRef.current || !recognitionRef.current) {
      pendingRestartDelayRef.current = null;
      return;
    }
    
    if (restartAttemptsRef.current >= MAX_RESTART_ATTEMPTS) {
      console.warn('Max restart attempts reached, stopping');
      pendingRestartDelayRef.current = null;
      if (isMountedRef.current) {
        setError('Speech recognition stopped. Click "Start Recording" to continue.');
        setIsListening(false);
      }
      shouldRestartRef.current = false;
      return;
    }
    
    pendingRestartDelayRef.current = delayMs;
    
    restartTimeoutRef.current = setTimeout(() => {
      pendingRestartDelayRef.current = null;
      if (!shouldRestartRef.current || !recognitionRef.current) return;
      
      try {
        recognitionRef.current.start();
        // Only increment after start() doesn't throw synchronously
        restartAttemptsRef.current++;
      } catch (e) {
        restartAttemptsRef.current++;
        console.warn('Restart attempt failed:', e, `(attempt ${restartAttemptsRef.current})`);
        // Exponential backoff: 100ms, 200ms, 400ms, 800ms...
        const nextDelay = Math.min(delayMs * 2, 2000);
        attemptRestart(nextDelay, true);
      }
    }, delayMs);
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    isListeningRef.current = isListening;
    shouldRestartRef.current = isListening;
  }, [isListening]);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Don't show error for "no-speech" - just silently restart
      if (event.error === 'no-speech') {
        if (shouldRestartRef.current) {
          attemptRestart(100);
        }
        return;
      }
      
      // For "aborted" error, just try to restart
      if (event.error === 'aborted') {
        if (shouldRestartRef.current) {
          attemptRestart(100);
        }
        return;
      }
      
      // Network errors are common - allow retry with longer delay (force to override any pending restart)
      if (event.error === 'network') {
        if (shouldRestartRef.current) {
          if (isMountedRef.current) {
            setError('Network issue - retrying...');
          }
          attemptRestart(1000, true);  // Force to ensure network backoff isn't overridden
        }
        return;
      }
      
      if (isMountedRef.current) {
        setError(event.error);
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Clear interim transcript on end
      if (isMountedRef.current) {
        setInterimTranscript('');
      }
      
      // Auto-restart if still supposed to be listening
      if (shouldRestartRef.current) {
        // Add punctuation to mark the pause
        if (isMountedRef.current) {
          setTranscript(prev => addChinesePunctuation(prev));
        }
        
        // Restart quickly to minimize gap (but don't override longer pending delays like network backoff)
        attemptRestart(100);
      } else if (isMountedRef.current) {
        setIsListening(false);
      }
    };

    recognition.onstart = () => {
      if (isMountedRef.current) {
        setError(null);
      }
      pendingRestartDelayRef.current = null;
      restartAttemptsRef.current = 0;  // Reset counter on successful start
    };

    recognitionRef.current = recognition;

    return () => {
      isMountedRef.current = false;  // Mark as unmounted to prevent state updates
      shouldRestartRef.current = false;  // Prevent post-unmount restarts
      pendingRestartDelayRef.current = null;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      recognition.abort();
    };
  }, [isSupported, language, continuous, interimResults, attemptRestart]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) {
      setError('Speech recognition not supported');
      return;
    }

    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    pendingRestartDelayRef.current = null;

    setError(null);
    setIsListening(true);
    shouldRestartRef.current = true;
    restartAttemptsRef.current = 0;  // Reset counter when user manually starts
    
    try {
      recognitionRef.current.start();
    } catch (e) {
      // Might already be started, try stopping and use attemptRestart for proper handling
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      // Use attemptRestart which properly tracks the timeout and handles errors
      attemptRestart(100, true);
    }
  }, [isSupported, attemptRestart]);

  const stopListening = useCallback(() => {
    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    pendingRestartDelayRef.current = null;
    
    shouldRestartRef.current = false;
    setIsListening(false);
    setInterimTranscript('');
    
    // Add final period when user manually stops
    setTranscript(prev => addChinesePunctuation(prev, true));
    
    if (!recognitionRef.current) return;
    
    try {
      recognitionRef.current.stop();
    } catch {
      // Might already be stopped
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
