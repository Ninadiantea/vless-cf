require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { generateWorkerJs, deployToCloudflare } = require("./deployWorker");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Simpan session user (sebaiknya pakai DB, ini contoh simple)
let sessions = {};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🚀 Selamat datang di Bot Deploy Cloudflare Worker!\n\nKetik /deploy untuk mulai deploy otomatis.");
});

bot.onText(/\/deploy/, (msg) => {
  const chatId = msg.chat.id;
  sessions[chatId] = { step: "rootDomain" };
  bot.sendMessage(chatId, "🌍 Masukkan Root Domain (contoh: example.com):");
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  if (!sessions[chatId]) return;

  let session = sessions[chatId];
  if (msg.text.startsWith("/")) return; // skip command

  if (session.step === "rootDomain") {
    session.rootDomain = msg.text;
    session.step = "serviceName";
    bot.sendMessage(chatId, "🏷️ Masukkan Nama Worker (contoh: nautica):");
  } else if (session.step === "serviceName") {
    session.serviceName = msg.text;
    session.step = "apiKey";
    bot.sendMessage(chatId, "🔑 Masukkan Global API Key Cloudflare:");
  } else if (session.step === "apiKey") {
    session.apiKey = msg.text;
    session.step = "apiEmail";
    bot.sendMessage(chatId, "📧 Masukkan Email Cloudflare:");
  } else if (session.step === "apiEmail") {
    session.apiEmail = msg.text;
    session.step = "accountID";
    bot.sendMessage(chatId, "🆔 Masukkan Account ID Cloudflare:");
  } else if (session.step === "accountID") {
    session.accountID = msg.text;
    session.step = "zoneID";
    bot.sendMessage(chatId, "🌐 Masukkan Zone ID Cloudflare (atau ketik - jika tidak ada):");
  } else if (session.step === "zoneID") {
    session.zoneID = msg.text === "-" ? "" : msg.text;
    session.step = "apiToken";
    bot.sendMessage(chatId, "🛡️ Masukkan API Token (scoped to Workers):");
  } else if (session.step === "apiToken") {
    session.apiToken = msg.text;
    // Proses deploy
    bot.sendMessage(chatId, "⏳ Meng-generate & upload _worker.js ke Cloudflare Worker...");
    const workerCode = generateWorkerJs({
      rootDomain: session.rootDomain,
      serviceName: session.serviceName,
      apiKey: session.apiKey,
      apiEmail: session.apiEmail,
      accountID: session.accountID,
      zoneID: session.zoneID,
    });
    const result = await deployToCloudflare({
      accountID: session.accountID,
      serviceName: session.serviceName,
      apiToken: session.apiToken,
      workerCode,
    });
    if (result.success) {
      bot.sendMessage(chatId, `✅ Deploy sukses!\n\nCek di: https://${session.serviceName}.${session.rootDomain}.workers.dev`);
    } else {
      bot.sendMessage(chatId, `❌ Deploy gagal!\n\nError: ${JSON.stringify(result.error)}`);
    }
    delete sessions[chatId];
  }
});
