import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db.js";
import { ObjectId } from "mongodb";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "birthday-invite")));

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Asik2025";
let db;

// --- RSVP API ---
app.post("/rsvp-bot", async (req, res) => {
  try {
    const { name, surname, spouseName, spouseSurname, option } = req.body;

    await db.collection("guests").insertOne({
      name,
      surname,
      spouseName,
      spouseSurname,
      option,
      date: new Date(),
    });

    const guests = await db.collection("guests").find().toArray();

    // Подсчёт статистики
    let totalComing = 0, totalNotComing = 0;
    guests.forEach(g => {
      if (g.option === "Әрине, келемін") totalComing += 1;
      else if (g.option === "Жұбайыммен келемін") totalComing += 2;
      else if (g.option === "Өкінішке орай, келе алмаймын") totalNotComing += 1;
    });

    // Сообщение в Telegram
    let text = `📩 Жаңа жауап:\n👤 ${name} ${surname}\n`;
    if (option === "Жұбайыммен келемін" && spouseName)
      text += `💑 ${spouseName} ${spouseSurname}\n`;

    text += option === "Өкінішке орай, келе алмаймын"
      ? `🙁 ${option}\n\n`
      : `✅ Таңдауы: ${option}\n\n`;

    text += `👥 Қонақтар саны: ${totalComing}\n🙁 Келе алмайтындар: ${totalNotComing}`;

    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// --- 📊 Статистика ---
app.get("/stats", async (req, res) => {
  const guests = await db.collection("guests").find().toArray();
  if (!guests.length) return res.send("Пока нет данных 😅");

  let totalComing = 0, totalNotComing = 0, countYes = 0, countWithSpouse = 0;

  guests.forEach(g => {
    if (g.option === "Әрине, келемін") { totalComing += 1; countYes++; }
    else if (g.option === "Жұбайыммен келемін") { totalComing += 2; countWithSpouse++; }
    else if (g.option === "Өкінішке орай, келе алмаймын") totalNotComing++;
  });

  res.send(`
📊 RSVP статистика:<br>
✅ Келемін: ${countYes}<br>
💑 Жұбайыммен келемін: ${countWithSpouse}<br>
🙁 Келе алмаймын: ${totalNotComing}<br>
👥 Жалпы келетін адам саны: ${totalComing}<br>
Барлығы жауап бергендер: ${guests.length} адам
`);
});

// --- 🧾 Админ-панель ---
app.get("/guests", async (req, res) => {
  const password = req.query.p;
  if (password !== ADMIN_PASSWORD)
    return res.send(`<h3>🔒 Құпия сөз қажет</h3>`);

  const guests = await db.collection("guests").find().toArray();
  const list = guests.map((g, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${g.name} ${g.surname}</td>
      <td>${g.spouseName ? g.spouseName + " " + g.spouseSurname : "-"}</td>
      <td>${g.option}</td>
      <td><a href="/delete/${g._id}?p=${password}" style="color:red">❌</a></td>
    </tr>`).join("");

  res.send(`
    <h2>📋 Барлық қонақтар</h2>
    <table border="1" cellpadding="6">
      <tr><th>#</th><th>Аты-жөні</th><th>Жұбайы</th><th>Таңдауы</th><th>❌</th></tr>
      ${list}
    </table>
    <a href="/restore?p=${password}">🗂 Архив</a>
  `);
});

// --- 🗑 Удаление ---
app.get("/delete/:id", async (req, res) => {
  const password = req.query.p;
  if (password !== ADMIN_PASSWORD) return res.status(403).send("Құпия сөз қате 😅");

  const id = req.params.id;
  const guest = await db.collection("guests").findOne({ _id: new ObjectId(id) });

  if (guest) {
    await db.collection("archive").insertOne(guest);
    await db.collection("guests").deleteOne({ _id: new ObjectId(id) });
  }

  res.redirect(`/guests?p=${password}`);
});

// --- ♻ Восстановление ---
app.get("/restore", async (req, res) => {
  const password = req.query.p;
  if (password !== ADMIN_PASSWORD) return res.status(403).send("Құпия сөз қате 😅");

  const archive = await db.collection("archive").find().toArray();
  if (!archive.length) return res.send("Архив бос 😅");

  const list = archive.map((g, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${g.name} ${g.surname}</td>
      <td>${g.spouseName ? g.spouseName + " " + g.spouseSurname : "-"}</td>
      <td>${g.option}</td>
      <td>
        <a href="/restore-item/${g._id}?p=${password}" style="color:green">♻</a>
        <a href="/delete-permanent/${g._id}?p=${password}" style="color:red">🗑</a>
      </td>
    </tr>`).join("");

  res.send(`
    <h2>🗂 Архив (жойылғандар)</h2>
    <table border="1" cellpadding="6">
      <tr><th>#</th><th>Аты-жөні</th><th>Жұбайы</th><th>Таңдауы</th><th>♻ / 🗑</th></tr>
      ${list}
    </table>
    <a href="/guests?p=${password}">⬅ Қайту</a>
  `);
});

// --- ♻ Восстановить ---
app.get("/restore-item/:id", async (req, res) => {
  const id = req.params.id;
  const password = req.query.p;
  if (password !== ADMIN_PASSWORD) return res.status(403).send("Құпия сөз қате 😅");

  const guest = await db.collection("archive").findOne({ _id: new ObjectId(id) });
  if (guest) {
    await db.collection("guests").insertOne(guest);
    await db.collection("archive").deleteOne({ _id: new ObjectId(id) });
  }
  res.redirect(`/restore?p=${password}`);
});

// --- 🗑 Удалить навсегда ---
app.get("/delete-permanent/:id", async (req, res) => {
  const id = req.params.id;
  const password = req.query.p;
  if (password !== ADMIN_PASSWORD) return res.status(403).send("Құпия сөз қате 😅");

  await db.collection("archive").deleteOne({ _id: new ObjectId(id) });
  res.redirect(`/restore?p=${password}`);
});

const PORT = process.env.PORT || 3000;
connectDB().then(database => {
  db = database;
  app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
});
