import express from "express";
import TelegramBot from "node-telegram-bot-api";

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  if (messageText === "/start") {
    bot.sendMessage(chatId, "Hi I'm PhaunaBot!");
  } else {
    bot.sendMessage(chatId, "Hey cool!");
  }
});

const app = express();
app.listen(3002, () => console.log("PhaunaBot running on port 3000"));
