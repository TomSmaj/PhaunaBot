import express from "express";
import TelegramBot from "node-telegram-bot-api";

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const telegramChatIdList = process.env.ACCEPTED_TELEGRAM_CHAT_IDS.split(",");

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  if (!telegramChatIdList.includes(chatId.toString())) {
    bot.sendMessage(
      chatId,
      '{\\"error":true,\\"status\\":500,\\"message\\":\\"Internal Server Error\\"}'
    );
  } else {
    if (messageText === "/start") {
      console.log(msg);
      bot.sendMessage(chatId, "Hi I'm PhaunaBot!");
    } else {
      bot.sendMessage(chatId, "Neat!");
    }
  }
});

const app = express();
app.listen(3002, () => console.log("PhaunaBot running on port 3002"));
