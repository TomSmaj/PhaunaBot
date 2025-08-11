import express from "express";
// import { bot } from "./services/telegramService.js";
// import { loadSavedCredentialsIfExist } from "./services/calendarService.js";
import "./services/telegramService.js";
import "./services/commandRouter.js";
import calendarAuthRouter from "./services/calendarService.js";

const app = express();
app.use("/auth/google", calendarAuthRouter);
app.listen(3002, () => console.log("PhaunaBot running on port 3002"));

// loadSavedCredentialsIfExist();
