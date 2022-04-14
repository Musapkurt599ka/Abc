const { MessageEmbed } = require("discord.js");
const Dayjs = require("dayjs");
const Duration = require("dayjs/plugin/duration");
const Mongoose = require("mongoose");
const Axios = require("axios");
const Ms = require("ms");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
} = require("@discordjs/voice");

require("dayjs/locale/tr");

Dayjs.extend(Duration);
Dayjs.locale("tr");

const { RamazanGuild } = require("./model");
const City = process.env.CITY_NAME.split(", ");

const Bot = global.bot;

function Login() {
  try {
    Mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      autoIndex: false,
      connectTimeoutMS: 10000,
      family: 4,
      noDelay: true,
      maxPoolSize: 10,
    })
      .then(() => {
        console.log("Mongoose başarıyla bağlandı.");

        Bot.login(process.env.TOKEN)
          .then(() => console.log(`${Bot.user.tag} çevrimiçi.`))
          .catch((err) => console.log("" + err));
      })
      .catch((err) => console.log("" + err));

    Mongoose.connection.on("disconnected", () => {
      console.log("Mongoose bağlantısı kesildi.");
    });
  } catch (err) {
    console.log("" + err);
  }
}

function TimeSave(data, dates) {
  Axios({
    method: "get",
    url: `https://api.collectapi.com/pray/all?data.city=${data}`,
    headers: {
      Authorization: `apikey ${process.env.API_KEY}`,
    },
    responseType: "json",
  })
    .then(async (Response) => {
      DataSave(
        data,
        Response.data.result[4].saat,
        Response.data.result[0].saat,
        dates
      );
    })
    .catch((err) => {
      console.log("" + err);
    });
}

async function DataSave(name, iftar, sahur, dates) {
  await RamazanGuild.updateOne(
    { cityName: name },
    {
      $set: {
        iftarTime: iftar,
        sahurTime: sahur,
        dates: dates,
      },
    },
    { upsert: true }
  );
}

async function SendTime(message, args) {
  const RamazanData = await RamazanGuild.findOne({ cityName: args });

  if (RamazanData) {
    message.reply({
      embeds: [Embed(Content(EndTime(RamazanData.iftarTime), args), message)],
    });
  } else {
    const Dates = new Date();
    Axios({
      method: "get",
      url: `https://api.collectapi.com/pray/all?data.city=${args}`,
      headers: {
        Authorization: `apikey ${process.env.API_KEY}`,
      },
      responseType: "json",
    })
      .then(async (Response) => {
        DataSave(
          args,
          Response.data.result[4].saat,
          Response.data.result[0].saat,
          Dates.getDate()
        );

        message.reply({
          embeds: [
            Embed(
              Content(EndTime(Response.data.result[4].saat), args),
              message
            ),
          ],
        });
      })
      .catch(() => {
        message.reply({
          embeds: [Embed(`Böyle bir şehir ismi bulunamadı.`, message)],
        });
      });
  }
}

function Embed(content, message) {
  const Guild = Bot.guilds.cache.get(process.env.GUILD_ID);

  const Embed = new MessageEmbed()
    .setAuthor({
      name: message.length > 0 ? message.guild.name : Guild.name,
      iconURL:
        message > 0
          ? message.guild.iconURL({ dynamic: true })
          : Guild.iconURL({ dynamic: true }),
    })
    .setColor("RANDOM")
    .setDescription(content);
  if (message)
    Embed.setFooter({
      text: `${message.author.username} tarafından istendi.`,
      iconURL: message.author.avatarURL({ dynamic: true }),
    }).setTimestamp();

  return Embed;
}

function EndTime(time) {
  const Dates = new Date();

  let one =
    Ms(`${time.substring(0, 2)}h`) + Ms(`${time.substring(3, 5)}m`) + Ms(`0s`);

  let two =
    Ms(`${Dates.getHours()}h`) +
    Ms(`${Dates.getMinutes()}m`) +
    Ms(`${Dates.getSeconds()}s`);

  let three = Ms(`3h`) + Ms(`0m`) + Ms(`0s`);

  return Number(one - two - three);
}

function Content(time, args) {
  var iftarMsg =
    time < 0
      ? `${args.replace(/\b\w/g, (l) =>
          l.toUpperCase()
        )} iftar saati geçmiş Allah kabul etsin.`
      : `${args.replace(/\b\w/g, (l) =>
          l.toUpperCase()
        )} iftar saatine ${Dayjs.duration(time)
          .format(`H [saat] m [dakika] s [saniye]`)
          .replace(/\b0 saat\b/, "")
          .replace(/\b0 dakika\b/, "")
          .replace(/\b0 saniye\b/, "")} kalmış. 🕌`;

  return iftarMsg;
}

async function Activity() {
  setInterval(async () => {
    const RamazanData = await RamazanGuild.find();
    const Map = RamazanData.map((data) => data);

    const Random = Map[Math.floor(Math.random() * Map.length)];

    Bot.user.setActivity(Content(EndTime(Random.iftarTime), Random.cityName), {
      type: "PLAYING",
    });
  }, 1000 * 15);
}

async function Control() {
  const RamazanData = await RamazanGuild.find();

  if (RamazanData.length >= 0) {
    MapSave();
  }

  setInterval(() => {
    ramazanAlarm(Bot);
  }, 1000 * 3);

  setInterval(() => {
    if (RamazanData) {
      RamazanData.map(async (data) => {
        await RamazanGuild.deleteOne({ cityName: data.cityName });
      });

      setTimeout(() => {
        MapSave();
      }, 1000 * 3);
    } else {
      MapSave();
    }
  }, 1000 * 60 * 60 * 4);
}

function MapSave() {
  City.map(async (Data, Index) => {
    setTimeout(() => {
      const Dates = new Date();

      TimeSave(Data, Dates);
    }, Index * 5000);
  });
}

function ramazanAlarm() {
  const Guild = Bot.guilds.cache.get(process.env.GUILD_ID);
  const VoiceChannel = Guild.channels.cache.get(process.env.VOICE_CHANNEL);
  const TextChannel = Guild.channels.cache.get(process.env.ALARM_CHANNEL);

  if (Guild && VoiceChannel && TextChannel) {
    const Time = new Date();
    const DateNow = `0${Time.getHours()}:${Time.getMinutes()}`;

    const user = Guild.members.cache.get(Bot.user.id);

    if (!user.voice.channelId) {
      City.map(async (x) => {
        const Data = await RamazanGuild.findOne({ cityName: x });

        if (Data) {
          if (DateNow === Data.iftarTime) {
            const player = createAudioPlayer();
            const resource = createAudioResource("./src/sound/ezan.mp3");

            player.play(resource);

            const con = joinVoiceChannel({
              channelId: VoiceChannel.id,
              guildId: VoiceChannel.guild.id,
              adapterCreator: VoiceChannel.guild.voiceAdapterCreator,
            });

            const sub = con.subscribe(player);

            TextChannel.send({
              content: "@everyone | @here",
              embeds: [
                Embed(
                  `Eveeettt \`${Data.iftarTime}\` oldu ve **${x}** adlı şehirin iftar vakti!`,
                  ""
                ),
              ],
            });

            if (sub) {
              setTimeout(() => sub.unsubscribe, 1000 * 15);
            }
          }
        } else {
          return;
        }
      });
    }
  }
}

module.exports = {
  Login,
  SendTime,
  Activity,
  Control,
  Embed,
};
