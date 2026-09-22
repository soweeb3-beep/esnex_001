const axios = require('axios');

const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_AUTH_METHOD = (process.env.GEMINI_AUTH_METHOD || 'apiKey').toLowerCase();
const GEMINI_API_URL = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

function buildGeminiHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (GEMINI_AUTH_METHOD === 'oauth') {
    headers.Authorization = `Bearer ${GEMINI_API_KEY}`;
  } else {
    headers['x-goog-api-key'] = GEMINI_API_KEY;
  }
  return headers;
}

async function callGemini({ prompt, model, maxTokens = 800 }) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required for Gemini provider');
  }

  const modelName = model || GEMINI_MODEL;
  const endpoints = [
    GEMINI_API_URL,
    'https://generativelanguage.googleapis.com/v1beta/models',
    'https://generativeai.googleapis.com/v1beta/models',
  ].filter(Boolean);

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: maxTokens,
    },
  };

  const headers = buildGeminiHeaders();
  const errors = [];

  for (const baseUrl of endpoints) {
    const url = `${baseUrl}/${modelName}:generateContent`;
    try {
      const response = await axios.post(url, payload, { headers, timeout: 20000 });
      const data = response.data;
      const contentParts = data?.candidates?.[0]?.content?.parts || [];
      const content = contentParts.map((part) => part.text || '').join('') || data?.output || JSON.stringify(data);
      return { raw: data, content, provider: 'gemini' };
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data ? JSON.stringify(err.response.data).slice(0, 800) : err.message;
      errors.push({ url, status, body });
      if (status && status < 500 && status !== 404 && status !== 403) {
        break;
      }
    }
  }

  const message = errors
    .map((entry) => `${entry.url} => ${entry.status || 'ERR'}: ${entry.body}`)
    .join(' | ');
  throw new Error(`Gemini request failed: ${message}`);
}

async function callProvider({ prompt, model, maxTokens = 800 }) {
  // If configured to use Gemini, try Gemini first. If Gemini returns a model-not-found / 404
  // error and OpenAI credentials are available, fall back to OpenAI automatically instead
  // of immediately failing to the local grader. This helps when Gemini model names/config
  // are mismatched but OpenAI is available as a backup.
  if (AI_PROVIDER === 'gemini') {
    try {
      return await callGemini({ prompt, model, maxTokens });
    } catch (err) {
      const status = err.response?.status;
      const body = err.response?.data ? JSON.stringify(err.response.data).slice(0, 800) : err.message;
      if (OPENAI_API_KEY) {
        console.warn(`Gemini call failed (${status}): ${body}. Falling back to OpenAI since OPENAI_API_KEY is present.`);
        // fall through to OpenAI block below
      } else {
        throw new Error(`Gemini call failed${status ? ` (${status})` : ''}: ${body}`);
      }
    }
  }

  // OpenAI path
  if (OPENAI_API_KEY) {
    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model: model || OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'You are a precise and conservative grader. Output only JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens: maxTokens,
    };
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` };
    const resp = await axios.post(url, payload, { headers, timeout: 20000 });
    const data = resp.data;
    const content = data.choices?.[0]?.message?.content || JSON.stringify(data);
    return { raw: data, content, provider: 'openai' };
  }

  throw new Error('No AI provider configured or API key missing');
}

async function generateModelAnswer({ questionText, rubric, model }) {
  const rubricText = rubric && typeof rubric === 'string' ? rubric : (rubric ? JSON.stringify(rubric) : 'No rubric provided');
  const prompt = `You are an expert exam answer writer. Generate a clear, exam-style model answer for the following theory question.\n\nQUESTION:\n${questionText}\n\nRUBRIC:\n${rubricText}\n\nIf no rubric is available, answer the question in a concise, well-structured paragraph. Output only the answer text with no additional explanation.`;
  const { content } = await callProvider({ prompt, model });
  const cleaned = String(content || '').trim().replace(/^```(?:\w+)?\s*/, '').replace(/```$/, '').trim();
  return cleaned;
}

async function getEmbedding({ text, model }) {
  // Prefer OpenAI embeddings if configured
  if (OPENAI_API_KEY) {
    const url = 'https://api.openai.com/v1/embeddings';
    const payload = { model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large', input: String(text).slice(0, 20000) };
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` };
    const resp = await axios.post(url, payload, { headers, timeout: 20000 });
    const vec = resp.data?.data?.[0]?.embedding;
    if (Array.isArray(vec)) return vec;
    throw new Error('Failed to parse OpenAI embedding response');
  }

  // Gemini embedding path: try generativelanguage embed endpoint if configured
  if (GEMINI_API_KEY) {
    try {
      const url = `${GEMINI_API_URL}/${GEMINI_MODEL}:embedText`;
      const payload = { text: String(text) };
      const headers = buildGeminiHeaders();
      const resp = await axios.post(url, payload, { headers, timeout: 20000 });
      const vec = resp.data?.embedding?.[0]?.vector || resp.data?.candidates?.[0]?.embedding;
      if (Array.isArray(vec)) return vec;
    } catch (err) {
      // fallthrough to error below
    }
  }

  throw new Error('No embedding provider configured (set OPENAI_API_KEY or supported GEMINI settings)');
}

module.exports = { callProvider, generateModelAnswer, getEmbedding };
