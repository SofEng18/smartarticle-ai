import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';  // <-- import cookie-parser
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

// Middleware to show maintenance message if maintenance.flag exists
app.use((req, res, next) => {
  const maintenanceFile = path.join(__dirname, 'maintenance.flag');
  if (fs.existsSync(maintenanceFile)) {
    return res.status(503).send(`
      <html>
        <head>
          <title>🚧 Maintenance Mode</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f9f9f9;
              color: #333;
              text-align: center;
              padding: 60px 20px;
            }
            h1 {
              color: #d35400;
              font-size: 2.5rem;
            }
            p {
              font-size: 1.25rem;
              max-width: 600px;
              margin: 20px auto;
              line-height: 1.5;
            }
            footer {
              margin-top: 40px;
              font-size: 0.9rem;
              color: #666;
            }
          </style>
        </head>
        <body>
          <h1>🚧 الموقع تحت الصيانة / Site Under Maintenance</h1>
          <p>
            شكراً لزيارتكم واهتمامكم.<br/>
            نحن حالياً نقوم ببعض التحديثات لتحسين تجربتكم.<br/>
            الرجاء العودة لاحقاً. نقدر صبركم وتفهمكم.<br/><br/>
            Thank you for visiting and your patience.<br/>
            We are currently performing updates to improve your experience.<br/>
            Please check back soon.
          </p>
          <footer>نديم الصلوي &copy; 2025</footer>
        </body>
      </html>
    `);
  }
  next();
});

// Use cookie-parser middleware
app.use(cookieParser());

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

// Example: Set a cookie on first visit or read it if already set
app.get('/', (req, res, next) => {
  // Read cookie named 'visitor'
  const visitor = req.cookies.visitor;

  if (!visitor) {
    // Set cookie if not set
    res.cookie('visitor', 'true', {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      sameSite: 'lax',
    });
    console.log('New visitor cookie set.');
  } else {
    console.log('Visitor cookie found.');
  }

  next(); // Proceed to serve index.html below
});

// Serve index.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST /generate endpoint
app.post('/generate', async (req, res) => {
  const { topic, language } = req.body;

  if (!topic || !language || !prompts[language]) {
    return res.status(400).send('Missing topic or invalid language.');
  }

  const userPrompt = prompts[language](topic);

  try {
    // Use GPT-3.5-turbo model (faster & cheaper)
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.7,
      stream: true,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    for await (const part of stream) {
      const content = part.choices?.[0]?.delta?.content;
      if (content) res.write(content);
    }
    res.end();

  } catch (error) {
    console.error('OpenAI request failed:', error);

    if (error.status === 429) {
      // Rate limit or quota exceeded
      res.status(429).send("❌ OpenAI quota exceeded. Please check your plan.");
    } else {
      // Other errors
      res.status(500).send("❌ An error occurred. Please try again later.");
    }
  }
});

// Start server
app.listen(port, () => {
  console.log(`✅ SmartArticle AI server running at http://localhost:${port}`);
});
