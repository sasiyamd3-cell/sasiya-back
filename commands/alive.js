// Command: alive
// Auto-extracted from sakura.js switch-case during commandLoader refactor.
module.exports = {
  name: 'alive',
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

      const uptimeSec = Math.floor(process.uptime());
      const hh = Math.floor(uptimeSec / 3600);
      const mm = Math.floor((uptimeSec % 3600) / 60);
      const ss = uptimeSec % 60;

      let runtimeStr = '';
      if (hh > 0) runtimeStr += `${hh} hour${hh > 1 ? 's' : ''}, `;
      if (mm > 0) runtimeStr += `${mm} minute${mm > 1 ? 's' : ''}, `;
      runtimeStr += `${ss} second${ss !== 1 ? 's' : ''}`;

      const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

      const aliveCaption =
        `🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ʜᴇʟʟᴏ ♡⸝⸝> ̫ <⸝⸝♡* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n` +
        `┊ ┊ ✫ ˚♡ ⋆｡❀\n` +
        `┊ ☪︎⋆\n\n` +
        `> 🌿 *ᴠᴇʀsɪᴏɴ :* ${config.BOT_VERSION || 'V5'}\n` +
        `> 💫 *ᴍᴇᴍᴏʀʏ :* ${memMB}MB\n` +
        `> ⏳ *ʀᴜɴᴛɪᴍᴇ :* ${runtimeStr}\n` +
        `> 🌐 *ʜᴏsᴛ :* Railway\n\n` +
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
        react: { text: '🐽', key: msg.key }
      });

      try {
        if (String(logo).startsWith('http')) {
          await socket.sendMessage(sender, {
            image: { url: logo },
            caption: aliveCaption,
            contextInfo: channelContext
          }, { quoted: msg });
        } else {
          try {
            const buf = fs.readFileSync(logo);
            await socket.sendMessage(sender, {
              image: buf,
              caption: aliveCaption,
              contextInfo: channelContext
            }, { quoted: msg });
          } catch (_e) {
            await socket.sendMessage(sender, {
              image: { url: config.IMAGE_PATH },
              caption: aliveCaption,
              contextInfo: channelContext
            }, { quoted: msg });
          }
        }
      } catch (e) {
        await socket.sendMessage(sender, {
          text: aliveCaption,
          contextInfo: channelContext
        }, { quoted: msg });
      }

  }
};
