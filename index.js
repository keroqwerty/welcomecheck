"use strict";

require("dotenv").config();

const express = require("express");
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActivityType
} = require("discord.js");
const {
  joinVoiceChannel,
  getVoiceConnection,
  entersState,
  VoiceConnectionStatus
} = require("@discordjs/voice");

/* =========================
   ENV
========================= */
const TOKEN = String(process.env.TOKEN || "").trim();
const PREFIX = String(process.env.PREFIX || ".").trim() || ".";
const WELCOME_CHANNEL_ID = String(process.env.WELCOME_CHANNEL_ID || "").trim();
const AUTO_JOIN_VOICE = String(process.env.AUTO_JOIN_VOICE || "false").toLowerCase() === "true";
const VOICE_CHANNEL_ID = String(process.env.VOICE_CHANNEL_ID || "").trim();
const STREAM_URL = String(process.env.STREAM_URL || "https://www.twitch.tv/discord").trim();
const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

/* =========================
   STARTUP LOGS
========================= */
console.log("===== ENV CHECK =====");
console.log("TOKEN var mı:", TOKEN ? "Evet" : "Hayır");
console.log("PREFIX:", PREFIX || "Yok");
console.log("WELCOME_CHANNEL_ID:", WELCOME_CHANNEL_ID || "Yok");
console.log("AUTO_JOIN_VOICE:", AUTO_JOIN_VOICE);
console.log("VOICE_CHANNEL_ID:", VOICE_CHANNEL_ID || "Yok");
console.log("STREAM_URL:", STREAM_URL || "Yok");
console.log("PORT:", PORT);
console.log("=====================");

if (!TOKEN) {
  console.error("HATA: TOKEN eksik.");
  process.exit(1);
}

/* =========================
   CLIENT
========================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

/* =========================
   EXPRESS
========================= */
const app = express();

app.get("/", (req, res) => {
  res.status(200).send("Bot aktif.");
});

app.listen(PORT, HOST, () => {
  console.log(`Web server aktif. http://${HOST}:${PORT}`);
});

/* =========================
   HELPERS
========================= */
function formatDate(date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Istanbul"
  }).format(date);
}

function getAccountAge(date) {
  const now = Date.now();
  const diffMs = now - date.getTime();

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} yıl önce`;
  if (months > 0) return `${months} ay önce`;
  return `${days} gün önce`;
}

function getWelcomeChannel(guild) {
  if (!WELCOME_CHANNEL_ID) return null;
  const channel = guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return null;
  if (channel.type !== ChannelType.GuildText) return null;
  return channel;
}

async function tryAutoJoinVoice() {
  if (!AUTO_JOIN_VOICE || !VOICE_CHANNEL_ID) return;

  const channel = client.channels.cache.get(VOICE_CHANNEL_ID);
  if (!channel) {
    console.log("Ses kanalı bulunamadı. VOICE_CHANNEL_ID yanlış olabilir.");
    return;
  }

  if (channel.type !== ChannelType.GuildVoice) {
    console.log("VOICE_CHANNEL_ID bir ses kanalı değil.");
    return;
  }

  try {
    const existing = getVoiceConnection(channel.guild.id);
    if (existing) {
      console.log("Bot zaten ses kanalına bağlı.");
      return;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    console.log(`Ses kanalına bağlanıldı: ${channel.name}`);
  } catch (error) {
    console.error("Ses kanalına bağlanırken hata:", error);
  }
}

async function sendJoinEmbed(member) {
  const channel = getWelcomeChannel(member.guild);
  if (!channel) return;

  const user = member.user;

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setAuthor({
      name: `${user.tag} sunucuya katıldı`,
      iconURL: user.displayAvatarURL({ dynamic: true })
    })
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
    .setTitle("🎉 Yeni Üye Girişi")
    .setDescription(`${member} sunucuya hoş geldi.`)
    .addFields(
      {
        name: "👤 Kullanıcı",
        value: `\`${user.tag}\`\nID: \`${user.id}\``,
        inline: true
      },
      {
        name: "📅 Hesap Oluşturulma",
        value: `${formatDate(user.createdAt)}\n(${getAccountAge(user.createdAt)})`,
        inline: true
      },
      {
        name: "📥 Sunucuya Katılma",
        value: `${formatDate(new Date())}`,
        inline: false
      },
      {
        name: "📊 Sunucu Üye Sayısı",
        value: `\`${member.guild.memberCount}\``,
        inline: true
      },
      {
        name: "🤖 Bot mu?",
        value: user.bot ? "Evet" : "Hayır",
        inline: true
      }
    )
    .setFooter({
      text: `${member.guild.name} • Hoş geldin`
    })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch((err) => {
    console.error("Join embed gönderme hatası:", err);
  });
}

async function sendLeaveEmbed(member) {
  const channel = getWelcomeChannel(member.guild);
  if (!channel) return;

  const user = member.user;

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setAuthor({
      name: `${user.tag} sunucudan ayrıldı`,
      iconURL: user.displayAvatarURL({ dynamic: true })
    })
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
    .setTitle("📤 Üye Ayrılışı")
    .setDescription(`**${user.tag}** sunucudan çıktı.`)
    .addFields(
      {
        name: "👤 Kullanıcı",
        value: `\`${user.tag}\`\nID: \`${user.id}\``,
        inline: true
      },
      {
        name: "📅 Hesap Oluşturulma",
        value: `${formatDate(user.createdAt)}\n(${getAccountAge(user.createdAt)})`,
        inline: true
      },
      {
        name: "📉 Kalan Üye Sayısı",
        value: `\`${member.guild.memberCount}\``,
        inline: true
      },
      {
        name: "🤖 Bot mu?",
        value: user.bot ? "Evet" : "Hayır",
        inline: true
      }
    )
    .setFooter({
      text: `${member.guild.name} • Görüşürüz`
    })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch((err) => {
    console.error("Leave embed gönderme hatası:", err);
  });
}

/* =========================
   EVENTS
========================= */
client.once("ready", async () => {
  console.log(`${client.user.tag} olarak giriş yapıldı.`);

  client.user.setPresence({
    activities: [
      {
        name: "#Welcome kanalını selamlıyor!",
        type: ActivityType.Streaming,
        url: STREAM_URL
      }
    ],
    status: "online"
  });

  await tryAutoJoinVoice();
});

client.on("guildMemberAdd", async (member) => {
  await sendJoinEmbed(member);
});

client.on("guildMemberRemove", async (member) => {
  await sendLeaveEmbed(member);
});

client.on("voiceStateUpdate", async () => {
  if (!AUTO_JOIN_VOICE || !VOICE_CHANNEL_ID) return;

  const targetChannel = client.channels.cache.get(VOICE_CHANNEL_ID);
  if (!targetChannel || targetChannel.type !== ChannelType.GuildVoice) return;

  const connection = getVoiceConnection(targetChannel.guild.id);
  if (!connection) {
    await tryAutoJoinVoice();
  }
});

client.on("messageCreate", async (message) => {
  try {
    if (!message.guild || message.author.bot) return;
    if (!message.content.toLowerCase().startsWith(PREFIX.toLowerCase())) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = (args.shift() || "").toLowerCase();

    if (command === "lock") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return message.reply("Bu komutu kullanmak için **Kanalları Yönet** yetkin olmalı.");
      }

      const channel = message.channel;
      if (!channel || channel.type !== ChannelType.GuildText) {
        return message.reply("Bu komut sadece yazı kanalında kullanılabilir.");
      }

      await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false
      });

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle("🔒 Kanal Kilitlendi")
        .setDescription(`${channel} başarıyla kilitlendi.`)
        .addFields({
          name: "Yetkili",
          value: `${message.author}`,
          inline: true
        })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    if (command === "unlock") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return message.reply("Bu komutu kullanmak için **Kanalları Yönet** yetkin olmalı.");
      }

      const channel = message.channel;
      if (!channel || channel.type !== ChannelType.GuildText) {
        return message.reply("Bu komut sadece yazı kanalında kullanılabilir.");
      }

      await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: true
      });

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("🔓 Kanal Açıldı")
        .setDescription(`${channel} başarıyla açıldı.`)
        .addFields({
          name: "Yetkili",
          value: `${message.author}`,
          inline: true
        })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error("messageCreate hata:", error);
  }
});

client.on("error", (err) => {
  console.error("Client error:", err);
});

client.on("warn", (info) => {
  console.warn("Client warn:", info);
});

client.on("shardError", (error) => {
  console.error("Shard error:", error);
});

client.on("invalidated", () => {
  console.error("Bot oturumu invalid oldu. Token resetlenmiş olabilir.");
});

/* =========================
   PROCESS ERRORS
========================= */
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("exit", (code) => {
  console.log("Process exit code:", code);
});

/* =========================
   LOGIN
========================= */
(async () => {
  try {
    console.log("Discord login deneniyor...");
    await client.login(TOKEN);
    console.log("Discord login başarılı.");
  } catch (err) {
    console.error("Discord login hatası:", err);
  }
})();
