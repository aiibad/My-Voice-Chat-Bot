import profileImg from './profile.jpg';
import { useCallback, useEffect, useRef, useState } from 'react';

// Updated sample questions based on your CV
const SAMPLE_QUESTIONS = [
  'Can you introduce yourself?',
  'What is your current location and expected CTC?',
  'What is your total experience and relevant AI experience?',
  'How many years do you have in Python, React, and AWS?',
  'Confirm your email ID and interview availability.',
];

const STATUS_LABEL = {
  idle: 'Tap my photo to start talking',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

export default function App() {
  const [status, setStatus] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [sttSupported, setSttSupported] = useState(true);
  const [textInput, setTextInput] = useState('');

  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  /* ---------- setup speech recognition ---------- */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSttSupported(false);
      return;
    }

    const recog = new SR();
    recog.lang = 'en-US';
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onresult = (event) => {
      const text = event.results[0][0].transcript.trim();
      if (text) {
        setTranscript(text);
        runPipeline(text);
      }
    };

    recog.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Speech recognition error: ${event.error}`);
      }
      setStatus('idle');
    };

    recog.onend = () => {
      setStatus((s) => (s === 'listening' ? 'idle' : s));
    };

    recognitionRef.current = recog;
  }, []);

  /* ---------- setup speech synthesis + preload voices ---------- */
  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    const loadVoices = () => window.speechSynthesis.getVoices();
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  /* ---------- the actual voice loop ---------- */
  const speak = useCallback((text) => {
    const synth = synthRef.current;
    if (!synth) {
      setStatus('idle');
      return;
    }
    synth.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-US';
    utt.rate = 1;
    
    // Slightly lower the pitch as a fallback to sound more masculine
    utt.pitch = 0.85;

    const voices = synth.getVoices();
    
    // Look specifically for known MALE voice names
    const maleVoice = voices.find((v) => 
      /Google UK English Male|Google US English Male|Microsoft Guy|Microsoft David|Microsoft Mark|Alex|Daniel/i.test(v.name)
    );

    if (maleVoice) {
      utt.voice = maleVoice;
      utt.pitch = 1; // Reset pitch to normal since we found a real male voice
    } else {
      // Fallback to any English voice if no male voice is found
      utt.voice = voices.find((v) => v.lang === 'en-US' || v.lang === 'en-GB');
    }

    utt.onstart = () => setStatus('speaking');
    utt.onend = () => setStatus('idle');
    utt.onerror = () => setStatus('idle');

    synth.speak(utt);
  }, []);

  /* ---------- UPDATED: Streaming Pipeline ---------- */
  const runPipeline = useCallback(
    async (question) => {
      setStatus('thinking');
      setError('');
      setReply('');
      
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        // Read the stream word-by-word
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          
          setReply(fullText); // Update the UI immediately
          setStatus('speaking'); // Show speaking state
        }

        // Once the stream is done, speak the full text
        if (fullText.trim()) {
          speak(fullText.trim());
        } else {
          setStatus('idle');
        }
      } catch (e) {
        setError(e.message || 'Something went wrong');
        setStatus('idle');
      }
    },
    [speak]
  );

  /* ---------- user actions ---------- */
  const startListening = () => {
    if (!recognitionRef.current) return;
    setError('');
    setTranscript('');
    setReply('');
    setStatus('listening');
    try {
      recognitionRef.current.start();
    } catch {}
  };

  const stopAll = () => {
    try { recognitionRef.current?.stop(); } catch {}
    synthRef.current?.cancel();
    setStatus('idle');
  };

  const handleOrbClick = () => {
    if (status === 'idle') startListening();
    else stopAll();
  };

  const askText = (e) => {
    e.preventDefault();
    const q = textInput.trim();
    if (!q) return;
    setTranscript(q);
    setTextInput('');
    runPipeline(q);
  };

  const askSample = (q) => {
    setTranscript(q);
    runPipeline(q);
  };

  /* ---------- render ---------- */
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-dot" />
          <span>Ibad Rehman</span>
        </div>
      </header>

      <main className="main">
        <h1 className="title">Meet my AI Twin</h1>
        <p className="subtitle">
          Enterprise AI Architect — ask me anything about my tech stack, projects, or experience.
        </p>

        <button
          type="button"
          className={`orb orb--${status}`}
          onClick={handleOrbClick}
          aria-label={status === 'idle' ? 'Start talking' : 'Stop'}
        >
          <span className="orb-glow" />
          {/* FIXED: Now using the imported profileImg variable */}
          <span 
            className="orb-core" 
            style={{ backgroundImage: `url(${profileImg})` }}
          />
        </button>

        <p className="status">{STATUS_LABEL[status]}</p>

        {error && <div className="error" role="alert">{error}</div>}

        {!sttSupported && (
          <div className="warn">
            Your browser doesn’t support voice input. Type your question below
            instead (best in Chrome, Edge or Safari).
          </div>
        )}

        {(transcript || reply) && (
          <section className="bubbles">
            {transcript && (
              <div className="bubble bubble--you">
                <span className="bubble-label">You</span>
                <p>{transcript}</p>
              </div>
            )}
            {reply && (
              <div className="bubble bubble--bot">
                <span className="bubble-label">Ibad AI</span>
                <p>{reply}</p>
              </div>
            )}
          </section>
        )}

        <form className="text-form" onSubmit={askText}>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type your question…"
            aria-label="Type your question"
          />
          <button type="submit" disabled={!textInput.trim()}>
            Send
          </button>
        </form>

        <section className="samples">
          <p className="samples-label">Try one of these:</p>
          <div className="chips">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                className="chip"
                onClick={() => askSample(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        Built with Web Speech API + Groq LPU
      </footer>
    </div>
  );
}
