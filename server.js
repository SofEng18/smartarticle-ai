import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3002;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/generate", async (req, res) => {
  const { topic, language, length } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  const lengthMap = {
    short: "150",
    medium: "350",
    long: "700",
  };
  const maxWords = lengthMap[length] || "350";

  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "أنت كاتب مقالات محترف، اكتب مقال مفصل وواضح باللغة التي يختارها المستخدم، مع مراعاة طول المقال المطلوب.",
        },
        {
          role: "user",
          content: `اكتب مقال عن: "${topic}" باللغة: ${language}، وعدد الكلمات حوالي ${maxWords}.`,
        },
      ],
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        res.write(text);
      }
    }
    res.end();
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).send("خطأ في توليد المقال");
  }
});

app.listen(port, () => {
  console.log(`SmartArticle AI backend running on http://localhost:${port}`);
});
