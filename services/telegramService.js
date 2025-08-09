import TelegramBot from "node-telegram-bot-api";

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const telegramChatIdList = process.env.ACCEPTED_TELEGRAM_CHAT_IDS.split(",");

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  if (!telegramChatIdList.includes(chatId.toString())) {
    bot.sendMessage(chatId, "Access Denied");
  } else {
    if (messageText === "/start") {
      console.log(msg);
      bot.sendMessage(chatId, "Hi I'm PhaunaBot!");
    } else {
      bot.sendMessage(chatId, "Neat!");
    }
  }
});

export { bot };
