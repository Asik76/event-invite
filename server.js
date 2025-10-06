import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const app = express();
app.use(express.json());

// --- сайт ---
const staticPath = path.join(__dirname, "birthday-invite");
app.use(express.static(staticPath));

// --- Telegram ---
const TOKEN   = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

app.post("/rsvp-bot", async (req, res) => {
  try {
    const { name, surname, spouseName, spouseSurname, option } = req.body;
    let text = `📩 Жаңа жауап:\n👤 ${name} ${surname}\n`;
    if (spouseName) text += `👤 ${spouseName} ${spouseSurname}\n`;
    text += `✅ Таңдауы: ${option}`;

    const tgRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
    });

    const tgJson = await tgRes.json();
    if (!tgRes.ok) return res.status(500).json({ ok: false, error: tgJson });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- для всех маршрутов ---
app.get("*", (req, res) => {
  res.sendFile(path.join(staticPath, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));