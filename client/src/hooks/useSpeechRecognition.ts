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
  
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

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
      
      // Don't show error for "no-speech" - just restart
      if (event.error === 'no-speech') {
        // Auto-restart after no speech detected
        if (shouldRestartRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (shouldRestartRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                // Ignore
              }
            }
          }, 100);
        }
        return;
      }
      
      // For "aborted" error, just try to restart
      if (event.error === 'aborted') {
        if (shouldRestartRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (shouldRestartRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                // Ignore
              }
            }
          }, 100);
        }
        return;
      }
      
      setError(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      // Clear interim transcript on end
      setInterimTranscript('');
      
      // Auto-restart if still supposed to be listening
      if (shouldRestartRef.current) {
        // Add punctuation to mark the pause
        setTranscript(prev => addChinesePunctuation(prev));
        
        // Restart after a brief delay
        restartTimeoutRef.current = setTimeout(() => {
          if (shouldRestartRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.warn('Failed to restart recognition:', e);
              // If restart fails, try again after a longer delay
              restartTimeoutRef.current = setTimeout(() => {
                if (shouldRestartRef.current && recognitionRef.current) {
                  try {
                    recognitionRef.current.start();
                  } catch (e2) {
                    // Give up and mark as stopped
                    setIsListening(false);
                  }
                }
              }, 500);
            }
          }
        }, 100);
      } else {
        setIsListening(false);
      }
    };

    recognition.onstart = () => {
      setError(null);
    };

    recognitionRef.current = recognition;

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      recognition.abort();
    };
  }, [isSupported, language, continuous, interimResults]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) {
      setError('Speech recognition not supported');
      return;
    }

    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }

    setError(null);
    setIsListening(true);
    shouldRestartRef.current = true;
    
    try {
      recognitionRef.current.start();
    } catch (e) {
      // Might already be started, try stopping and restarting
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          if (recognitionRef.current && shouldRestartRef.current) {
            recognitionRef.current.start();
          }
        }, 100);
      } catch (e2) {
        console.warn('Recognition start error:', e2);
      }
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    // Clear any pending restart
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    
    shouldRestartRef.current = false;
    setIsListening(false);
    setInterimTranscript('');
    
    // Add final period when user manually stops
    setTranscript(prev => addChinesePunctuation(prev, true));
    
    if (!recognitionRef.current) return;
    
    try {
      recognitionRef.current.stop();
    } catch (e) {
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
