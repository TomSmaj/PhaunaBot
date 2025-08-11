import * as cal from "./calendarService.js";
import { bot, reply } from "./telegramService.js";
const telegramChatIdList = process.env.ACCEPTED_TELEGRAM_CHAT_IDS.split(",");

/**
 * Sends a usage-format error message to the given Telegram chat
 * when a request does not match the expected command format.
 *
 * @function returnError
 * @param {number|string} chatId - Telegram chat ID to send the error message to
 * @param {string} messageType - The command type (e.g., "/list-events")
 * @returns {void}
 * @sideeffect Sends a Telegram message to the specified chat
 */
function returnError(chatId, messageType) {
  if (messageType === "/listEvents")
    reply(
      chatId,
      "Error! a list-events message should be in the format: /listEvents, NUMBER_OF_EVENTS"
    );
}

/**
 * Formats an array of Google Calendar events into a bullet-pointed list string.
 * Each entry is formatted as: `• M/D/YYYY h:mm am/pm: Summary`
 *
 * @function formatEventListItems
 * @param {Array<Object>} items - Google Calendar events array
 * @param {string} items[].summary - Event summary/title
 * @param {Object} items[].start - Event start object (with `dateTime` or `date`)
 * @returns {string} Multi-line bullet list string
 * @throws {Error} If `items` is not an array
 */
function formatEventListItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("Expected an array of items");
  }

  return items
    .map((item) => {
      const summary = item.summary?.trim() || "No title";
      const startValue = item.start?.dateTime || item.start?.date || null;

      let formattedStart = "No start date";
      if (startValue) {
        const date = new Date(startValue);
        const month = date.getMonth() + 1; // Months are zero-based
        const day = date.getDate();
        const year = date.getFullYear();

        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "pm" : "am";
        hours = hours % 12 || 12; // Convert to 12-hour format

        formattedStart = `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
      }
      return `• ${summary} - ${formattedStart}`;
    })
    .join("\n");
}

/**
 * Handles the `/listEvents` command by fetching the specified number of events
 * from Google Calendar and sending them to the Telegram chat.
 *
 * @async
 * @function handleListEvents
 * @param {number|string} chatId - Telegram chat ID
 * @param {string[]} args - Command arguments (expected: ["/listEvents", "NUM"])
 * @returns {Promise<void>}
 * @sideeffect Sends a formatted events list to the Telegram chat
 */
async function handleListEvents(chatId, args) {
  const [messageType, eventNum] = args;
  if (args.length !== 2) {
    returnError(chatId, messageType);
    return;
  }
  const calData = await cal.listEvents(eventNum);
  reply(chatId, formatEventListItems(calData.items));
  //returnError(chatId, "/listEvents");
}

/**
 * Splits a comma-separated string into trimmed argument segments.
 *
 * @function parseArgs
 * @param {string} text - Command text from Telegram message
 * @returns {string[]} Array of trimmed command arguments
 */
function parseArgs(text) {
  return text.split(",").map((s) => s.trim());
}

/**
 * Telegram bot "message" event listener.
 * Checks chat ID authorization, parses commands, and routes to appropriate handlers.
 *
 * @event bot#message
 * @param {Object} msg - Telegram message object
 * @param {Object} msg.chat - Chat object
 * @param {number} msg.chat.id - Chat ID
 * @param {string} msg.text - Message text
 */
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  if (!telegramChatIdList.includes(chatId.toString())) {
    reply(chatId, "Access Denied");
  } else {
    const args = parseArgs(msg.text);
    const messageType = args[0];
    if (messageType === "/start") {
      console.log(msg);
      reply(chatId, "Hi I'm PhaunaBot!");
    } else if (messageType === "/listEvents") {
      handleListEvents(chatId, args);
    } else {
      reply(chatId, "Command not recognized");
    }
  }
});

/**
 * Telegram bot "polling_error" event listener.
 * Logs polling errors to the console.
 *
 * @event bot#polling_error
 * @param {Error} error - Error object with `code` and `message`
 */
bot.on("polling_error", (error) => {
  console.log(`[polling_error] ${error.code}: ${error.message}`);
});
