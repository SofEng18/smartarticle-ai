import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3002;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ Serve appropriate page based on maintenance flag
app.get("/", (req, res) => {
  const maintenanceFlagPath = path.join(__dirname, "maintenance.flag");
  const isMaintenance = fs.existsSync(maintenanceFlagPath);

  if (isMaintenance) {
    // Send maintenance page if maintenance.flag exists
    res.sendFile(path.join(__dirname, "public", "maintenance.html"));
  } else {
    // Otherwise, send the regular index page
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Maintenance messages in different languages
const maintenanceMessages = {
  arabic:
    "الموقع تحت الصيانة حاليًا.\n" +
    "سنعود قريبًا بإذن الله.\n" +
    "شكرًا على صبركم وتفهمكم.\n" +
    "نديم\n",

  english:
    "The site is currently under maintenance.\n" +
    "We will be back soon, God willing.\n" +
    "Thank you for your patience and understanding.\n" +
    "Nadim\n",
};

app.post("/generate", async (req, res) => {
  const { topic, language = "english", length } = req.body;

  // ✅ Check for maintenance.flag file
  const maintenanceFlagPath = path.join(__dirname, "maintenance.flag");
  const isMaintenance = fs.existsSync(maintenanceFlagPath);

  if (isMaintenance) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    // Select appropriate language message
    const message = language.toLowerCase().startsWith("ar")
      ? maintenanceMessages.arabic
      : maintenanceMessages.english;

    // Stream message character by character
    for (const char of message) {
      res.write(char);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    return res.end();
  }

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
  console.log(`✅ SmartArticle AI backend running at http://localhost:${port}`);
});
