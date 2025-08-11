import TelegramBot from "node-telegram-bot-api";

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

export function reply(chatId, text) {
  return bot.sendMessage(chatId, text);
}

export { bot };
