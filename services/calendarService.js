import fs from "fs";
import path from "path";
import process from "process";
import { google } from "googleapis";
import express from "express";

const router = express.Router();
const timezone_const = "America/Chicago";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "google_credentials.json");

let oAuth2Client;

/**
 * GET /redirect (/auth/google/redirect)
 * Handles the OAuth 2.0 redirect from Google after consent.
 * Extracts the authorization code, exchanges it for tokens, sets the OAuth2 client
 * credentials, and persists the token to disk at TOKEN_PATH.
 *
 * @route GET /redirect
 * @param {express.Request} req - Express request; expects `req.query.code` (string)
 * @param {express.Response} res - Express response; sends a simple completion message
 * @sideeffect Writes the token JSON to TOKEN_PATH
 */
router.get("/redirect", (req, res) => {
  const code = req.query.code;
  oAuth2Client.getToken(code, (err, token) => {
    if (err) return console.error("Error retrieving access token", err);
    oAuth2Client.setCredentials(token);
    // Store the token to disk for later program executions
    fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
      if (err) return console.error(err);
      console.log("Token stored to", TOKEN_PATH);
    });
  });
  res.send("complete");
});

/**
 * GET /start (/auth/google/start)
 * Begins the Google OAuth 2.0 flow by reading local credentials, creating an OAuth client,
 * generating a consent URL, and redirecting the browser to Google.
 *
 * @route GET /start
 * @param {express.Request} _req - Express request (unused)
 * @param {express.Response} res - Express response; redirects to Google consent screen
 * @returns {Promise<void>}
 * @throws If credentials cannot be loaded from CREDENTIALS_PATH
 */
router.get("/start", async (req, res) => {
  oAuth2Client = await loadCredentials();
  /*const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });*/
  const authUrl = await getAccessToken();
  res.redirect(authUrl);
});

/**
 * Reads Google OAuth client credentials from CREDENTIALS_PATH and
 * constructs an OAuth2 client.
 *
 * @function loadCredentials
 * @returns {Promise<import("google-auth-library").OAuth2Client>} OAuth2 client instance
 * @throws If the credentials file is missing or malformed
 */
async function loadCredentials() {
  const content = await fs.promises.readFile(CREDENTIALS_PATH, "utf8");
  const { client_secret, client_id, redirect_uris } = JSON.parse(content).web;
  let auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  return auth;
}

/**
 * Loads previously saved OAuth tokens from TOKEN_PATH.
 *
 * @function loadSavedToken
 * @returns {Promise<object>} Parsed token JSON (e.g., { access_token, refresh_token, expiry_date, ... })
 * @throws If TOKEN_PATH does not exist or cannot be parsed
 */
async function loadSavedToken() {
  const token = await fs.promises.readFile(TOKEN_PATH, "utf8");
  return JSON.parse(token);
}

/**
 * Generates and logs the Google OAuth consent URL to the console.
 * Useful when no saved token exists and manual authorization is required.
 *
 * @function getAccessToken
 * @sideeffect Logs the consent URL to stdout
 * @returns {void}
 */
async function getAccessToken() {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  return authUrl;
}

/**
 * Returns a ready-to-use OAuth2 client. Uses a cached client if available.
 * Otherwise, reads credentials from disk, attempts to load saved tokens, and sets them.
 * If no saved tokens are found, it logs the authorization URL to obtain user consent.
 *
 * @function getOAuthClient
 * @async
 * @returns {Promise<import("google-auth-library").OAuth2Client>} Authorized OAuth2 client
 * @throws If credentials cannot be loaded or token reading fails unexpectedly
 */
export async function getOAuthClient() {
  if (oAuth2Client) return oAuth2Client;

  oAuth2Client = await loadCredentials();
  const saved = await loadSavedToken();

  if (saved) {
    oAuth2Client.setCredentials(saved);
  } else {
    getAccessToken();
  }
  return oAuth2Client;
}

/**
 * Creates and returns a Google Calendar API client authorized with the current OAuth2 client.
 *
 * @function getCalendar
 * @async
 * @returns {Promise<import("googleapis").calendar_v3.Calendar>} Google Calendar v3 client
 * @throws If the OAuth client cannot be initialized
 */
export async function getCalendar() {
  const auth = await getOAuthClient();
  return google.calendar({ version: "v3", auth });
}

/**
 * Lists upcoming events from the user's primary Google Calendar starting from "now".
 *
 * @function listEvents
 * @async
 * @param {number} num - Maximum number of events to return
 * @returns {Promise<import("googleapis").calendar_v3.Schema$Events>} Events response data
 * @example
 * const { items } = await listEvents(10);
 * items.forEach(e => console.log(e.summary, e.start));
 */
export async function listEvents(num) {
  const calendar = await getCalendar();
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: num,
    singleEvents: true,
    orderBy: "startTime",
  });
  return res.data;
}

export async function addEvent(summary, start, end) {
  const calendar = await getCalendar();
  const event = {
    summary: summary,
    start: {
      dateTime: start,
      timezone: timezone_const,
    },
    end: {
      dateTime: end,
      timezone: timezone_const,
    },
  };
  const res = await calendar.events.insert({
    calendarId: "primary",
    resource: event,
  });
  return res.data;
}

export default router;
