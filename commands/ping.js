// Command: ping
// Auto-extracted from sakura.js switch-case during commandLoader refactor.
module.exports = {
  name: 'ping',
  aliases: [],
  async execute(ctx) {
    const {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT, resolveReplyJid, downloadQuotedMedia,
      getSriLankaTimestamp, formatMessage, fs, path, os
    } = ctx;

      const sanitized = (number || '').replace(/[^0-9]/g, '');
      const cfg = sessionConfig; // reused from top of handler (was: extra Mongo query per command)
      const botName = cfg.botName || BOT_NAME_FANCY;
      const logo    = cfg.logo    || config.IMAGE_PATH;

      const pongMessages = [
        "🏓 *Pong! Right Back At Ya~* 💖",
        "💫 *Signal Received, Cutie~* 🌸",
        "🎀 *Pong! I Heard You~* ✨",
        "🌸 *Aww You Called Me?* 💌",
        "⚡ *Zap! I'm Right Here~* 🌟",
        "🍓 *Pong! Miss Me?* 💫",
        "🌙 *Hey Hey~ I'm Here!* 🌸",
        "💖 *Pong! Always Here For You~* ✨",
        "🎵 *Beep Boop~ Online!* 🤖",
        "🌺 *Pong! Catch Me If You Can~* 💨",
        "✨ *Oh You Pinged Me? Cute~* 🎀",
        "🍡 *Pong Pong~ Here I Am!* 🌸",
      ];

      const randomPong = pongMessages[Math.floor(Math.random() * pongMessages.length)];

      const start = new Date().getTime();
      await new Promise(r => setTimeout(r, 1));
      const end = new Date().getTime();
      const ping = end - start;

      const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

      const uptimeSec = Math.floor(process.uptime());
      const hh = Math.floor(uptimeSec / 3600);
      const mm = Math.floor((uptimeSec % 3600) / 60);
      const ss = uptimeSec % 60;

      let runtimeStr = '';
      if (hh > 0) runtimeStr += `${hh} hour${hh > 1 ? 's' : ''}, `;
      if (mm > 0) runtimeStr += `${mm} minute${mm > 1 ? 's' : ''}, `;
      runtimeStr += `${ss} second${ss !== 1 ? 's' : ''}`;

      const speedTag = ping < 200 ? '🚀 Super Fast!' : ping < 500 ? '⚡ Pretty Fast~' : '🐢 A lil Slow uwu';

      const pingCaption =
        `🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ ${randomPong} 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n` +
        `┊ ┊ ✫ ˚♡ ⋆｡❀\n` +
        `┊ ☪︎⋆\n\n` +
        `> ⚡ *ᴘɪɴɢ :* ${ping}ms | ${speedTag}\n` +
        `> 💫 *ᴍᴇᴍᴏʀʏ :* ${memMB}MB\n` +
        `> ⏳ *ʀᴜɴᴛɪᴍᴇ :* ${runtimeStr}\n` +
        `> 🕐 *ᴛɪᴍᴇ :* ${getSriLankaTimestamp()}\n\n` +
        `🧚‍♀️ *©ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*\n\n` +
        `*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`;

      const channelContext = {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid,
          newsletterName: botName,
          serverMessageId: 999,
        }
      };

      await socket.sendMessage(sender, {
        react: { text: '🌷', key: msg.key }
      });

      try {
        if (String(logo).startsWith('http')) {
          await socket.sendMessage(sender, {
            image: { url: logo },
            caption: pingCaption,
            contextInfo: channelContext
          }, { quoted: msg });
        } else {
          try {
            const buf = fs.readFileSync(logo);
            await socket.sendMessage(sender, {
              image: buf,
              caption: pingCaption,
              contextInfo: channelContext
            }, { quoted: msg });
          } catch (_e) {
            await socket.sendMessage(sender, {
              image: { url: config.IMAGE_PATH },
              caption: pingCaption,
              contextInfo: channelContext
            }, { quoted: msg });
          }
        }
      } catch (e) {
        await socket.sendMessage(sender, {
          text: pingCaption,
          contextInfo: channelContext
        }, { quoted: msg });
      }

  }
};
