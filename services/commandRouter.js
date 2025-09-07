import * as cal from "./calendarService.js";
import { bot, reply } from "./telegramService.js";
const telegramChatIdList = process.env.ACCEPTED_TELEGRAM_CHAT_IDS.split(",");
import messageText from "../utils/messages.json" with { type : 'json' };
const defaultEventNum = "5";

function sendInstructions(chatId, messageType) {
  const helpMessageText = messageText.help;
  const strippedMessageType =  messageType.substring(1);
  if(strippedMessageType in helpMessageText){
    reply(chatId, helpMessageText[strippedMessageType])
  }
  else{
    returnError(chatId, messageType);
  }
}

/**
 * Sends a usage-format error message to the given Telegram chat
 * when a request does not match the expected command format.
 *
 * @function returnError
 * @param {number|string} chatId - Telegram chat ID to send the error message to
 * @param {string} messageType - The command type (e.g., "/listevents")
 * @returns {void}
 * @sideeffect Sends a Telegram message to the specified chat
 */
function returnError(chatId, messageType) {
  reply(chatId, "Oops! something went wrong.");
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
      const endValue = item.end?.dateTime || item.end?.date || null;

      console.log(startValue);
      console.log(endValue);

      let formattedStart = "No start date";
      if (startValue) {
        const date = new Date(startValue);
        console.log(date);
        const month = date.getMonth() + 1; // Months are zero-based
        const day = date.getDate();
        const year = date.getFullYear();

        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "pm" : "am";
        hours = hours % 12 || 12; // Convert to 12-hour format
        console.log(hours);
        formattedStart = `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
      }
      let formattedEnd = "No end date";
      if (endValue) {
        const date = new Date(endValue);
        const month = date.getMonth() + 1; // Months are zero-based
        const day = date.getDate();
        const year = date.getFullYear();

        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "pm" : "am";
        hours = hours % 12 || 12; // Convert to 12-hour format

        formattedEnd = `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
      }
      // if start and end date are on different days, include both in printed response
      if(formattedStart.substring(0,10) !== formattedEnd.substring(0,10)){
        return `• ${summary}: ${formattedStart.substring(0,10)} - ${formattedEnd.substring(0,10)}`;
      }
      return `• ${summary}: ${formattedStart}`;
    })
    .join("\n");
}

/**
 * Combines a date string and time string into an ISO 8601 timestamp with offset.
 *
 * @param {string} dateStr - Date string in M/D/YYYY format (e.g., "8/15/2025")
 * @param {string} timeStr - Time string in h:mm AM/PM format (e.g., "7:00 PM")
 * @param {number} [offset=-5] - Timezone offset in hours (default is -5 for CST/CDT)
 * @returns {string} ISO timestamp in the format YYYY-MM-DDTHH:mm:ss±HH:MM
 *
 * @example
 * formatDateTime("8/15/2025", "7:00 PM");
 * // "2025-08-15T19:00:00-05:00"
 */
function formatAddEventTime(dateStr, timeStr, offset = -5) {
  // Normalize spacing so "7:00PM" -> "7:00 PM"
  const normalizedTime = timeStr.replace(/(am|pm)$/i, " $1").trim();

  // Parse date parts
  const [month, day, year] = dateStr.split("/").map((p) => parseInt(p, 10));

  // Parse time parts
  let [time, meridiem] = normalizedTime.split(/\s+/);
  let [hours, minutes] = time.split(":").map((p) => parseInt(p, 10));

  meridiem = meridiem.toUpperCase();

  if (meridiem === "PM" && hours !== 12) {
    hours += 12;
  }
  if (meridiem === "AM" && hours === 12) {
    hours = 0;
  }

  // Format offset
  const offsetHours = Math.floor(Math.abs(offset));
  const offsetMinutes = Math.abs((offset % 1) * 60);
  const sign = offset >= 0 ? "+" : "-";
  const tz = `${sign}${String(offsetHours).padStart(2, "0")}:${String(
    offsetMinutes
  ).padStart(2, "0")}`;

  // Build final string
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:00${tz}`;
}

/**
 * Handles the `/listevents` command by fetching the specified number of events
 * from Google Calendar and sending them to the Telegram chat.
 *
 * @async
 * @function handleListEvents
 * @param {number|string} chatId - Telegram chat ID
 * @param {string[]} args - Command arguments (expected: ["/listevents", "NUM"])
 * @returns {Promise<void>}
 * @sideeffect Sends a formatted events list to the Telegram chat
 */
async function handleListEvents(chatId, args) {
  const messageType = args[0];
  try {
    let [, eventNum] = args;

    if (eventNum === undefined) {
      eventNum = defaultEventNum;
    }
    const calData = await cal.listEvents(eventNum);
    reply(chatId, formatEventListItems(calData.items));
  } catch (error) {
    console.log(error);
    returnError(chatId, messageType);
  }
}

async function handleAddEventSpan(chatId, args) {
  const messageType = args[0];
  const defaultTime = "12:00 PM";
  try {
    if (args.length !== 4) {
      returnError(chatId, messageType);
      return;
    }
    const [, summary, startTime, endTime] = args;
    const startDateFormatted = formatAddEventTime(startTime, defaultTime);
    const endDateFormatted = formatAddEventTime(endTime, defaultTime);
    const calData = await cal.addEvent(
      summary,
      startDateFormatted,
      endDateFormatted
    );
    if (calData.status === "confirmed") reply(chatId, "event confirmed");
  } catch {
    returnError(chatId, messageType);
  }
}

// e.g. of add event request
// /addevent "Valhalla Show" 8/15/2025 10:00 pm 11:00 pm
async function handleAddEvent(chatId, args) {
  const messageType = args[0];
  try {
    if (args.length !== 5) {
      returnError(chatId, messageType);
      return;
    }
    const [, summary, date, start, end] = args;
    const startTime = formatAddEventTime(date, start);
    const endTime = formatAddEventTime(date, end);
    const calData = await cal.addEvent(summary, startTime, endTime);
    if (calData.status === "confirmed") reply(chatId, "event confirmed");
    else reply(chatId, "error");
  } catch {
    returnError(chatId, messageType);
  }
}

/**
 * Normalize “smart quotes” and odd whitespace to plain quotes/spaces.
 * - “ ” → "
 * - ‘ ’ → '
 * - Non-breaking spaces → regular spaces
 */
function normalizeInput(text) {
  return text
    .replace(/[\u201C\u201D]/g, '"') // curly double → "
    .replace(/[\u2018\u2019]/g, "'") // curly single → '
    .replace(/\u00A0/g, " "); // non-breaking space → space
}

/**
 * Splits a command string into arguments.
 * - Respects quoted strings (single '...' or double "..." quotes).
 * - Keeps "AM/PM" together with the preceding time (e.g., "7:00 AM").
 *
 * @param {string} text - Input text to parse
 * @returns {string[]} Array of parsed arguments
 * @example
 * parseCommand("listEvents 5 'Band Practice' 7:00 AM");
 * // ["listEvents", "5", "Band Practice", "7:00 AM"]
 */
function parseArgs(text) {
  let normText = normalizeInput(text);
  //return text.split(",").map((s) => s.trim());
  const regex = /"([^"]*)"|'([^']*)'|(\S+\s(?:AM|PM|am|pm))|(\S+)/g;
  const args = [];
  let match;

  while ((match = regex.exec(normText)) !== null) {
    if (match[1]) {
      // Double-quoted text
      args.push(match[1]);
    } else if (match[2]) {
      // Single-quoted text
      args.push(match[2]);
    } else if (match[3]) {
      // Time with AM/PM
      args.push(match[3]);
    } else if (match[4]) {
      // Regular token
      args.push(match[4]);
    }
  }

  return args;
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
    console.log(msg);
    reply(chatId, "Access Denied");
  } else {
    const args = parseArgs(msg.text);
    // console.log(args);
    const messageType = args[0];
    if (args.length === 2 && args[1] === "?") {
      sendInstructions(chatId, messageType);
    } else if (messageType === "/start") {
      reply(chatId, "Hi I'm PhaunaBot!");
    } else if (messageType === "/listevents") {
      handleListEvents(chatId, args);
    } else if (messageType === "/addevent") {
      handleAddEvent(chatId, args);
    } else if (messageType === "/addeventspan") {
      handleAddEventSpan(chatId, args);
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
