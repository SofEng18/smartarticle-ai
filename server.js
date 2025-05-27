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

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3002;

// Middleware to show maintenance message if maintenance.flag file exists
app.use((req, res, next) => {
  const maintenanceFile = path.join(__dirname, 'maintenance.flag');
  if (fs.existsSync(maintenanceFile)) {
    // Send friendly HTML maintenance page
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

// Middleware: cookie-parser to parse cookies
app.use(cookieParser());

// Middleware: enable CORS for all origins (adjust if needed)
app.use(cors());

// Middleware: parse JSON bodies
app.use(bodyParser.json());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize OpenAI client with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Multilingual prompt templates for article generation
const prompts = {
  en: (topic) => `Write a detailed, well-structured article about: "${topic}".`,
  ar: (topic) => `اكتب مقالًا مفصلًا ومنظمًا جيدًا حول: "${topic}".`,
  fr: (topic) => `Rédigez un article détaillé et bien structuré sur : "${topic}".`,
  es: (topic) => `Escribe un artículo detallado y bien estructurado sobre: "${topic}".`,
};

// Example route: set or read 'visitor' cookie on root access
app.get('/', (req, res, next) => {
  const visitor = req.cookies.visitor;

  if (!visitor) {
    // Set cookie for new visitor, expires in 30 days
    res.cookie('visitor', 'true', {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
      httpOnly: true,
      sameSite: 'lax',
    });
    console.log('New visitor cookie set.');
  } else {
    console.log('Visitor cookie found.');
  }

  next(); // Continue to next middleware to serve index.html
});

// Serve index.html at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST /generate endpoint: generate article using OpenAI streaming
app.post('/generate', async (req, res) => {
  const { topic, language } = req.body;

  // Validate input
  if (!topic || !language || !prompts[language]) {
    return res.status(400).send('Missing topic or invalid language.');
  }

  const userPrompt = prompts[language](topic);

  try {
    // Create streaming chat completion request using GPT-3.5-turbo
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.7,
      stream: true,
    });

    // Set headers to indicate plain text streaming with UTF-8
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    // Stream the content chunk by chunk as it arrives
    for await (const part of stream) {
      const content = part.choices?.[0]?.delta?.content;
      if (content) res.write(content);
    }

    res.end();

  } catch (error) {
    console.error('OpenAI request failed:', error);

    // Handle specific errors like quota exceeded or rate limits
    if (error.status === 429) {
      res.status(429).send("❌ OpenAI quota exceeded. Please check your plan.");
    } else {
      res.status(500).send("❌ An error occurred. Please try again later.");
    }
  }
});

// Start Express server
app.listen(port, () => {
  console.log(`✅ SmartArticle AI server running at http://localhost:${port}`);
});
