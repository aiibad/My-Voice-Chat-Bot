export const maxDuration = 30; // Allow up to 30 seconds for streaming

const SYSTEM_PROMPT = `
You are a voice bot that represents Ibad Rehman. You speak in the FIRST PERSON,
as if you are Ibad Rehman. Your answers are spoken aloud by a text-to-speech
engine, so keep every response SHORT and conversational — 2 to 4 sentences,
under 80 words. Never use markdown, bullet points, emojis, or special
formatting. Speak naturally, with a warm, confident, and slightly playful tone.

Here is the information you MUST use to answer questions:

1. Life story: I am a software engineer and builder with a deep passion for creating innovative, user-centric solutions. I started my journey by tinkering with code, and over time, I've grown into a developer who loves solving complex problems and merging technology with creativity. I am always looking for new ways to leverage AI and software to make a real impact.
2. #1 superpower: My number one superpower is breaking down complex, ambiguous problems into simple, actionable steps. I can quickly grasp new technologies and translate abstract ideas into working prototypes, which helps my team move faster and build with confidence.
3. Top 3 areas to grow: First, I want to deepen my expertise in AI and machine learning architectures. Second, I want to improve my public speaking and leadership skills to better guide technical teams. Finally, I want to expand my knowledge of scalable cloud infrastructure and system design.
4. Misconception: People sometimes think I am strictly a backend or logic-focused person because of my deep technical focus. However, they are often surprised to learn how deeply I care about UI and UX design. I actually love making things look as good as they function, ensuring the end-user experience is flawless.
5. Pushing boundaries: I push my boundaries by constantly taking on projects that scare me a little bit. Whether it's learning a new framework over the weekend or building a full-stack AI application from scratch, I believe that real growth happens exactly where your comfort zone ends. I also actively seek out tough code reviews to learn from my peers.
`.trim();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Missing question' });

  // Use the NEW Groq API key you just created
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server not configured: missing GROQ_API_KEY' });

  try {
    // Call the Groq API (OpenAI-compatible endpoint)[reference:2]
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Ultra-fast model[reference:3]
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: question }
        ],
        temperature: 0.7,
        max_tokens: 150,
        stream: true, // Enable streaming for real-time text
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `Groq API error: ${errText.slice(0, 300)}` });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Pipe the response directly to the browser
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            const text = data.choices?.[0]?.delta?.content;
            if (text) res.write(text); // Send text immediately
          } catch (e) { /* Ignore incomplete chunks */ }
        }
      }
    }
    res.end();
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Unknown error' });
  }
}
