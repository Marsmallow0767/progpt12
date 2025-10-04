// === ProGPT (ChatGPT benzeri, oturumsuz) ===
import express from "express";
import session from "express-session";
import fetch from "node-fetch";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";
import FileStore from "session-file-store";

dotenv.config();
const app = express();
const upload = multer({ dest: "uploads/" });
const FileStoreSession = FileStore(session);

// === Ayarlar ===
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === Session ===
app.use(
  session({
    store: new FileStoreSession({ path: "./sessions" }),
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: true,
  })
);

// === Yardımcı Fonksiyonlar ===
function createNewChat(req, title = "Yeni Sohbet") {
  if (!req.session.chats) req.session.chats = [];
  const id = Date.now().toString();
  req.session.chats.push({ id, title, messages: [] });
  req.session.activeChat = id;
}

function getActiveChat(req) {
  if (!req.session.chats || req.session.chats.length === 0) {
    createNewChat(req);
  }
  return req.session.chats.find(c => c.id === req.session.activeChat);
}

// === Ana sayfa ===
app.get("/", (req, res) => {
  if (!req.session.chats) createNewChat(req);
  const chats = req.session.chats;
  const activeChat = getActiveChat(req);
  res.render("index", { chats, activeChat });
});

// === Yeni sohbet oluştur ===
app.post("/new-chat", (req, res) => {
  const title = req.body.title?.trim() || `Sohbet ${req.session.chats?.length + 1 || 1}`;
  createNewChat(req, title);
  res.redirect("/");
});

// === Sohbet mesaj gönder ===
app.post("/chat", async (req, res) => {
  const message = req.body.message?.trim();
  if (!message) return res.status(400).json({ error: "Boş mesaj gönderilemez." });

  const chat = getActiveChat(req);
  chat.messages.push({ role: "user", content: message });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: chat.messages,
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Bir hata oluştu.";
    chat.messages.push({ role: "assistant", content: reply });

    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Sunucu hatası!" });
  }
});

// === Sohbet seçme ===
app.get("/chat/:id", (req, res) => {
  const chat = req.session.chats?.find(c => c.id === req.params.id);
  if (chat) req.session.activeChat = chat.id;
  res.redirect("/");
});

// === Görsel oluşturma ===
app.post("/image/generate", async (req, res) => {
  const prompt = req.body.prompt?.trim();
  if (!prompt) return res.status(400).json({ error: "Prompt boş olamaz." });

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
      }),
    });

    const data = await response.json();
    const url = data.data?.[0]?.url;
    if (url) res.json({ url });
    else res.status(500).json({ error: "Görsel oluşturulamadı." });
  } catch (err) {
    console.error("Image error:", err);
    res.status(500).json({ error: "Sunucu hatası!" });
  }
});

// === Görsel yükleme ===
app.post("/image/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Dosya yüklenmedi." });
  res.json({ filePath: req.file.path });
});

// === Sunucu ===
app.listen(5000, () => console.log("🚀 Çalışıyor: http://localhost:5000"));

