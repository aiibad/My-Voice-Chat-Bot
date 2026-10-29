import { useCallback, useEffect, useRef, useState } from 'react';

const SAMPLE_QUESTIONS = [
  'What should we know about your life story in a few sentences?',
  "What's your #1 superpower?",
  "What are the top 3 areas you'd like to grow in?",
  'What misconception do your coworkers have about you?',
  'How do you push your boundaries and limits?',
];

const STATUS_LABEL = {
  idle: 'Tap the orb to start talking',
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
    utt.pitch = 1;

    const voices = synth.getVoices();
    const preferred =
      voices.find((v) =>
        /Google US English|Samantha|Microsoft Aria|Microsoft Zira/i.test(v.name)
      ) || voices.find((v) => v.lang === 'en-US');

    if (preferred) utt.voice = preferred;

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
          <span>Voice&nbsp;Twin</span>
        </div>
      </header>

      <main className="main">
        <h1 className="title">Talk to my AI twin</h1>
        <p className="subtitle">
          Ask anything about me — I’ll answer out loud, in my own voice.
        </p>

        <button
          type="button"
          className={`orb orb--${status}`}
          onClick={handleOrbClick}
          aria-label={status === 'idle' ? 'Start talking' : 'Stop'}
        >
          <span className="orb-glow" />
          <span className="orb-core" />
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
                <span className="bubble-label">Me</span>
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
        Built with the Web Speech API + Google Gemini
      </footer>
    </div>
  );
}
