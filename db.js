// db.js
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);
let db;

export async function connectDB() {
  try {
    await client.connect();
    db = client.db("event-invite"); // имя базы
    console.log("✅ Подключено к MongoDB Atlas");
    return db;
  } catch (err) {
    console.error("❌ Ошибка подключения к MongoDB:", err);
  }
}

export function getDB() {
  return db;
}
