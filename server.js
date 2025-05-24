// SmartArticle-AI server.js (ES module, OpenAI SDK v4 streaming)
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from .env
dotenv.config();

const app = express();
const port = 3002;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// OpenAI client with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Multilingual prompt templates
const prompts = {
  en: (topic) => `Write a detailed, well-structured article about: "${topic}".`,
  ar: (topic) => `اكتب مقالًا مفصلًا ومنظمًا جيدًا حول: "${topic}".`,
  fr: (topic) => `Rédigez un article détaillé et bien structuré sur : "${topic}".`,
  es: (topic) => `Escribe un artículo detallado y bien estructurado sobre: "${topic}".`,
};

// POST /generate endpoint
app.post('/generate', async (req, res) => {
  const { topic, language } = req.body;

  if (!topic || !language || !prompts[language]) {
    return res.status(400).send('Missing topic or invalid language.');
  }

  const userPrompt = prompts[language](topic);

  try {
    // Create streaming chat completion with roles
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.7,
      stream: true,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    // Async iteration over streaming chunks
    for await (const part of stream) {
      const content = part.choices?.[0]?.delta?.content;
      if (content) {
        res.write(content);
      }
    }

    res.end();
  } catch (error) {
    console.error('OpenAI request failed:', error);
    if (error.status === 429) {
      res.status(429).send("🛠️ We're currently performing scheduled maintenance to improve your experience. Please check back shortly. Thank you for your patience.");
    } else {
      res.status(500).send("❌ 🛠️ Maintenance mode is active. Rejecting request.");
    }
  }
});

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(port, () => {
  console.log(`✅ SmartArticle AI server running at http://localhost:${port}`);
});
