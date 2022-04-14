require("dotenv").config();

const { Client } = require("discord.js");
const Bot = (global.bot = new Client({
  intents: ["GUILDS", "GUILD_MESSAGES"],
}));

const {
  Login,
  SendTime,
  Activity,
  Control,
  Embed,
} = require("./src/functions");

Bot.on("ready", async () => {
  Activity();

  Control();
});

Bot.on("messageCreate", async (message) => {
  let Prefix = message.content.toLowerCase().startsWith(process.env.PREFIX);

  if (!Prefix) return;
  let Args = message.content.split(" ").slice(1);
  let Command = message.content.split(" ")[0].slice(process.env.PREFIX.length);

  if (Command === "iftar") {
    if (!Args[0]) {
      Embed(
        "**Heyy!** dostum bir **şehir** ismi belirtmen gerekiyor.",
        message
      );
    } else {
      SendTime(message, Args[0].replace("İ", "i").toLowerCase());
    }
  }
});

Login(Bot);
