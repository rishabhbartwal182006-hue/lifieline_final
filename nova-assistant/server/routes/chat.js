const express = require("express");
const Groq = require("groq-sdk");
const { retrieve } = require("../lib/knowledgeBase");
const { buildSystemPrompt } = require("../lib/systemPrompt");

const router = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

/**
 * POST /api/chat
 * body: { messages: [{ role: "user"|"assistant", content: string }, ...] }
 * (messages = current in-session conversation history, oldest first;
 *  the frontend is responsible for clearing this on sleep/timeout.)
 *
 * returns: { reply: string }
 *
 * Non-streaming fallback — kept for anything that still wants a single JSON
 * reply. The frontend now uses /api/chat/stream (below) instead, so it can
 * start TTS on the first sentence instead of waiting for the whole reply.
 */
router.post("/", async (req, res) => {
  try {
    const { messages, patientContext } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const contextChunks = lastUserMessage ? retrieve(lastUserMessage.content, 6) : [];

    const systemPrompt = buildSystemPrompt(contextChunks, patientContext);

    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 1000,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content }))
      ]
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || "";

    res.json({ reply });
  } catch (err) {
    console.error("[/api/chat] error:", err);
    res.status(500).json({ error: "chat_failed" });
  }
});

/**
 * POST /api/chat/stream
 * body: same as above.
 * Streams the reply as Server-Sent Events so the frontend can split it into
 * sentences and kick off TTS on each sentence as soon as it's complete,
 * instead of waiting for the full reply before speaking anything.
 *
 * Events:
 *   data: {"delta": "..."}   -- one or more per token/chunk
 *   data: [DONE]             -- final event
 * On error before any data has been sent, responds with normal JSON 500.
 */
router.post("/stream", async (req, res) => {
  const { messages, patientContext } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  try {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const contextChunks = lastUserMessage ? retrieve(lastUserMessage.content, 6) : [];
    const systemPrompt = buildSystemPrompt(contextChunks, patientContext);

    const stream = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 1000,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content }))
      ]
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("[/api/chat/stream] error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "chat_failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: "chat_failed" })}\n\n`);
      res.end();
    }
  }
});

module.exports = router;
