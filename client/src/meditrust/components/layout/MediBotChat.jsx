import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, ChevronDown } from 'lucide-react';

const SYSTEM_PROMPT = `You are MediBot, a friendly and knowledgeable AI medical assistant integrated into MediTrust — a medicine verification and patient care platform. 

Your role is to help patients with:
- Understanding symptoms and what they might indicate (always advise consulting a doctor for diagnosis)
- Home remedies and natural care tips for common ailments
- General health knowledge and wellness advice
- Information and research about diseases, conditions, and treatments
- Medication information (general — not a substitute for a pharmacist/doctor)
- Healthy lifestyle guidance

Tone: Warm, caring, clear, and professional. Use simple language.
Format: Keep responses concise and easy to read. Use bullet points when listing items.
Important: Always remind users that your advice does not replace professional medical consultation. For emergencies, direct them to call emergency services immediately.

Never diagnose definitively. Always encourage visiting a healthcare professional for proper diagnosis and treatment.`;

const QUICK_PROMPTS = [
  "I have a headache and fever, what should I do?",
  "Home remedies for common cold",
  "Tell me about diabetes",
  "How to improve my immunity?",
];

export default function MediBotChat({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! 👋 I'm **MediBot**, your AI health assistant. I can help you with symptoms, home remedies, disease information, and general health advice.\n\nHow can I assist you today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;

    setInput('');
    const updatedMessages = [...messages, { role: 'user', content: userText }];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

      if (!GROQ_API_KEY) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '⚠️ API key missing. Please add VITE_GROQ_API_KEY=your_key to the client/.env file and restart the app.',
          },
        ]);
        setLoading(false);
        return;
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1000,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not get a response. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '⚠️ Error: ' + (err.message || 'Connection failed. Please check your API key and internet connection.') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderContent = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10,15,30,0.35)',
          backdropFilter: 'blur(3px)',
          zIndex: 9998,
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Chat Panel */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 400,
          height: 600,
          background: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,102,255,0.2), 0 8px 32px rgba(0,0,0,0.12)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          border: '1px solid rgba(0,102,255,0.12)',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0047cc 0%, #0066ff 60%, #338bff 100%)',
            padding: '16px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid rgba(255,255,255,0.3)',
              }}
            >
              <Bot size={20} color="white" />
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '0.97rem', fontFamily: "'Syne', sans-serif" }}>
                MediBot
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, background: '#00e5aa', borderRadius: '50%', boxShadow: '0 0 6px #00e5aa' }} />
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.73rem' }}>AI Health Assistant · Online</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 10,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: '#f8faff',
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                animation: 'msgIn 0.25s ease',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: msg.role === 'assistant'
                    ? 'linear-gradient(135deg, #0047cc, #0066ff)'
                    : 'linear-gradient(135deg, #6c63ff, #9c74ff)',
                }}
              >
                {msg.role === 'assistant' ? (
                  <Bot size={15} color="white" />
                ) : (
                  <User size={15} color="white" />
                )}
              </div>

              {/* Bubble */}
              <div
                style={{
                  maxWidth: '78%',
                  padding: '10px 13px',
                  borderRadius: msg.role === 'user'
                    ? '16px 4px 16px 16px'
                    : '4px 16px 16px 16px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #0047cc, #0066ff)'
                    : '#ffffff',
                  color: msg.role === 'user' ? 'white' : '#1a2138',
                  fontSize: '0.855rem',
                  lineHeight: 1.6,
                  fontFamily: "'DM Sans', sans-serif",
                  whiteSpace: 'pre-wrap',
                  boxShadow: msg.role === 'assistant'
                    ? '0 2px 8px rgba(0,0,0,0.06)'
                    : '0 2px 8px rgba(0,102,255,0.2)',
                  border: msg.role === 'assistant' ? '1px solid rgba(0,102,255,0.08)' : 'none',
                }}
              >
                {renderContent(msg.content)}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #0047cc, #0066ff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={15} color="white" />
              </div>
              <div
                style={{
                  padding: '10px 16px',
                  background: '#ffffff',
                  borderRadius: '4px 16px 16px 16px',
                  border: '1px solid rgba(0,102,255,0.08)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  display: 'flex',
                  gap: 5,
                  alignItems: 'center',
                }}
              >
                {[0, 1, 2].map((d) => (
                  <div
                    key={d}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#0066ff',
                      animation: `bounce 1.2s ${d * 0.2}s ease-in-out infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <div
            style={{
              padding: '8px 14px',
              background: '#f8faff',
              borderTop: '1px solid rgba(0,102,255,0.06)',
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 20,
                  border: '1.5px solid rgba(0,102,255,0.2)',
                  background: 'white',
                  color: '#0066ff',
                  fontSize: '0.72rem',
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e8f0ff';
                  e.currentTarget.style.borderColor = '#0066ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = 'rgba(0,102,255,0.2)';
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid rgba(0,102,255,0.08)',
            background: 'white',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
            flexShrink: 0,
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about symptoms, remedies, diseases..."
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              border: '1.5px solid rgba(0,102,255,0.18)',
              borderRadius: 12,
              padding: '9px 12px',
              fontSize: '0.855rem',
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none',
              resize: 'none',
              lineHeight: 1.5,
              background: loading ? '#f8faff' : 'white',
              color: '#1a2138',
              transition: 'border-color 0.2s',
              maxHeight: 90,
              overflowY: 'auto',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#0066ff')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(0,102,255,0.18)')}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: 'none',
              background: !input.trim() || loading
                ? '#e5e7eb'
                : 'linear-gradient(135deg, #0047cc, #0066ff)',
              color: !input.trim() || loading ? '#9ca3af' : 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              transition: 'all 0.2s',
              boxShadow: input.trim() && !loading ? '0 4px 12px rgba(0,102,255,0.3)' : 'none',
            }}
          >
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
          </button>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '6px 14px 10px',
            background: 'white',
            textAlign: 'center',
            fontSize: '0.68rem',
            color: '#9ca3af',
            fontFamily: "'DM Sans', sans-serif",
            flexShrink: 0,
          }}
        >
          🩺 Not a substitute for professional medical advice
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes msgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
