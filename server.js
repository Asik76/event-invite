import express from "express";
import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "birthday-invite")));

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const DATA_FILE = "guests.json";
const ARCHIVE_FILE = "deleted.json";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Asik2025"; // 🔑 Пароль админа

// --- RSVP API ---
app.post("/rsvp-bot", async (req, res) => {
  try {
    const { name, surname, spouseName, spouseSurname, option } = req.body;

    let guests = fs.existsSync(DATA_FILE)
      ? JSON.parse(fs.readFileSync(DATA_FILE))
      : [];

    // Добавляем нового гостя
    guests.push({ name, surname, spouseName, spouseSurname, option });
    fs.writeFileSync(DATA_FILE, JSON.stringify(guests, null, 2));

    // Подсчёт количества человек
    let totalComing = 0;
    let totalNotComing = 0;
    guests.forEach(g => {
      if (g.option === "Әрине, келемін") totalComing += 1;
      else if (g.option === "Жұбайыммен келемін") totalComing += 2;
      else if (g.option === "Өкінішке орай, келе алмаймын") totalNotComing += 1;
    });

    // Текст для Telegram
    let text = `📩 Жаңа жауап:\n👤 ${name} ${surname}\n`;
    if (option === "Жұбайыммен келемін" && spouseName) {
      text += `💑 ${spouseName} ${spouseSurname}\n`;
    }

    text += option === "Өкінішке орай, келе алмаймын"
      ? `🙁 ${option}\n\n`
      : `✅ Таңдауы: ${option}\n\n`;

    text += `👥 Қонақтар саны: ${totalComing}\n🙁 Келе алмайтындар: ${totalNotComing}`;

    // Отправляем в Telegram
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
app.get("/stats", (req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.send("Пока нет данных 😅");

  const guests = JSON.parse(fs.readFileSync(DATA_FILE));
  let totalComing = 0, totalNotComing = 0, countYes = 0, countWithSpouse = 0;

  guests.forEach(g => {
    if (g.option === "Әрине, келемін") { totalComing += 1; countYes++; }
    else if (g.option === "Жұбайыммен келемін") { totalComing += 2; countWithSpouse++; }
    else if (g.option === "Өкінішке орай, келе алмаймын") { totalNotComing++; }
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

// --- 🧾 Админ-панель гостей ---
app.get("/guests", (req, res) => {
  const password = req.query.p;
  if (password !== ADMIN_PASSWORD) {
    return res.send(`
      <style>
        body { font-family: Arial; text-align:center; padding:50px; background:#fdf6e3 }
        input { padding:10px; font-size:16px; border-radius:8px; border:1px solid #ccc; }
        button { padding:10px 20px; background:#c48f00; border:none; color:white; border-radius:8px; cursor:pointer; }
      </style>
      <h2>🔒 Құпия сөз қажет</h2>
      <form method="get" action="/guests">
        <input type="password" name="p" placeholder="Құпия сөз енгізіңіз">
        <button type="submit">Кіру</button>
      </form>
    `);
  }

  if (!fs.existsSync(DATA_FILE)) return res.send("Пока нет гостей 😅");
  const guests = JSON.parse(fs.readFileSync(DATA_FILE));

  const list = guests.map((g, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${g.name} ${g.surname}</td>
      <td>${g.spouseName ? g.spouseName + " " + g.spouseSurname : "-"}</td>
      <td>${g.option}</td>
      <td><a href="/delete/${i}?p=${password}" class="delete-btn">❌</a></td>
    </tr>`).join("");

  res.send(`
    <style>
      body { font-family: Arial; background:#fafafa; color:#333; padding:20px; }
      h2 { color:#c48f00; }
      table { width:100%; border-collapse:collapse; background:white; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1); }
      th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; }
      th { background:#f3e2b3; color:#222; }
      tr:hover { background:#fff8e7; }
      .delete-btn { text-decoration:none; color:red; font-weight:bold; }
      .btn { background:#c48f00; color:white; padding:8px 16px; border-radius:6px; text-decoration:none; }
      .btn:hover { background:#a17300; }
      .top-bar { margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
      .bottom-bar { margin-top:30px; text-align:center; }
      @media (max-width:600px) {
        table, tr, td, th { font-size:12px; padding:8px; }
        .btn { padding:6px 12px; font-size:12px; }
      }
    </style>

    <div class="top-bar">
      <h2>📋 Барлық қонақтар</h2>
      <a href="/stats?p=${password}" class="btn">📊 Статистика</a>
    </div>

    <table>
      <tr><th>#</th><th>Аты-жөні</th><th>Жұбайы</th><th>Таңдауы</th><th>❌</th></tr>
      ${list}
    </table>

    <div class="bottom-bar">
      <a href="/restore?p=${password}" class="btn">🗂 Архив (жойылғандар)</a>
    </div>
  `);
});

// --- 🗑 Удаление ---
app.get("/delete/:id", (req, res) => {
  const password = req.query.p;
  if (password !== ADMIN_PASSWORD) return res.status(403).send("Құпия сөз қате 😅");

  const id = parseInt(req.params.id);
  if (!fs.existsSync(DATA_FILE)) return res.redirect(`/guests?p=${password}`);

  const guests = JSON.parse(fs.readFileSync(DATA_FILE));
  const deleted = guests.splice(id, 1)[0];
  fs.writeFileSync(DATA_FILE, JSON.stringify(guests, null, 2));

  let archive = fs.existsSync(ARCHIVE_FILE)
    ? JSON.parse(fs.readFileSync(ARCHIVE_FILE))
    : [];
  archive.push(deleted);
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archive, null, 2));

  res.redirect(`/guests?p=${password}`);
});

// --- ♻ Восстановление ---
app.get("/restore", (req, res) => {
  const password = req.query.p;
  if (password !== ADMIN_PASSWORD) return res.status(403).send("Құпия сөз қате 😅");

  if (!fs.existsSync(ARCHIVE_FILE)) return res.send("Архив бос 😅");
  const archive = JSON.parse(fs.readFileSync(ARCHIVE_FILE));

  const list = archive.map((g, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${g.name} ${g.surname}</td>
      <td>${g.spouseName ? g.spouseName + " " + g.spouseSurname : "-"}</td>
      <td>${g.option}</td>
      <td>
        <a href="/restore-item/${i}?p=${password}" class="restore-btn">♻</a>
        <a href="/delete-permanent/${i}?p=${password}" class="delete-btn">🗑</a>
      </td>
    </tr>`).join("");

  res.send(`
    <style>
      body { font-family: Arial; background:#fafafa; color:#333; padding:20px; }
      h2 { color:#c48f00; }
      table { width:100%; border-collapse:collapse; background:white; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.1); }
      th, td { padding:12px; border-bottom:1px solid #ddd; text-align:center; }
      th { background:#f3e2b3; color:#222; }
      .restore-btn { text-decoration:none; color:green; font-weight:bold; margin-right:5px; }
      .delete-btn { text-decoration:none; color:red; font-weight:bold; }
      .btn { background:#c48f00; color:white; padding:8px 16px; border-radius:6px; text-decoration:none; }
    </style>

    <h2>🗂 Архив (жойылғандар)</h2>
    <table>
      <tr><th>#</th><th>Аты-жөні</th><th>Жұбайы</th><th>Таңдауы</th><th>♻ / 🗑</th></tr>
      ${list}
    </table>
    <br>
    <a href="/guests?p=${password}" class="btn">⬅ Қайту</a>
  `);
});

// --- ♻ Восстановить конкретного ---
app.get("/restore-item/:id", (req, res) => {
  const password = req.query.p;
  if (password !== ADMIN_PASSWORD) return res.status(403).send("Құпия сөз қате 😅");

  const id = parseInt(req.params.id);
  if (!fs.existsSync(ARCHIVE_FILE)) return res.redirect(`/restore?p=${password}`);

  const archive = JSON.parse(fs.readFileSync(ARCHIVE_FILE));
  const restored = archive.splice(id, 1)[0];

  const guests = fs.existsSync(DATA_FILE)
    ? JSON.parse(fs.readFileSync(DATA_FILE))
    : [];

  guests.push(restored);
  fs.writeFileSync(DATA_FILE, JSON.stringify(guests, null, 2));
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archive, null, 2));

  res.redirect(`/restore?p=${password}`);
});

// --- 🗑 Удалить навсегда ---
app.get("/delete-permanent/:id", (req, res) => {
  const password = req.query.p;
  if (password !== ADMIN_PASSWORD) return res.status(403).send("Құпия сөз қате 😅");

  const id = parseInt(req.params.id);
  if (!fs.existsSync(ARCHIVE_FILE)) return res.redirect(`/restore?p=${password}`);

  const archive = JSON.parse(fs.readFileSync(ARCHIVE_FILE));
  archive.splice(id, 1);
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(archive, null, 2));

  res.redirect(`/restore?p=${password}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
