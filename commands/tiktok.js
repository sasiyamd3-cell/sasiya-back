// Command: tiktok
// Auto-extracted from sakura.js switch-case during commandLoader refactor.
module.exports = {
  name: 'tiktok',
  aliases: [],
  async execute(ctx) {
    const {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT, resolveReplyJid, downloadQuotedMedia,
      getSriLankaTimestamp, formatMessage, fs, path, os
    } = ctx;

      const axios = require('axios');

      const sanitized = (number || '').replace(/[^0-9]/g, '');
      const cfg = sessionConfig; // reused from top of handler (was: extra Mongo query per command)
      const botName = cfg.botName || BOT_NAME_FANCY;

      await socket.sendMessage(sender, {
        react: { text: '🖥️', key: msg.key }
      });

      if (!q) return reply("Please give me a TikTok video URL.");

      await socket.sendMessage(sender, { text: `\n\n✰${botName}✰ 𝚃𝙸𝙺𝚃𝙾𝙺 𝚅𝙸𝙳𝙴𝙾 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙸𝙽𝙶.....` });

      await socket.sendMessage(sender, {
        react: { text: '⤵', key: msg.key }
      });

      const apiUrl = `https://www.movanest.xyz/v2/tiktok?url=${encodeURIComponent(q)}`;
      const response = await axios.get(apiUrl, { timeout: 30000 });
      const data = response.data;

      if (!data.status || !data.results) return reply("❌ Failed to fetch TikTok video!");

      const title = data.results.title || 'TikTok Video';
      const dlsd = data.results.no_watermark || null;
      const dlaudio = data.results.music || null;

      const vvvv = await socket.sendMessage(sender, {
        video: { url: dlsd },
        caption: `\n❍ 𝚃𝙸𝙺𝚃𝙾𝙺 𝚅𝙸𝙳𝙴𝙾 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳\n  ❯❯❯❯❯❯❯❯❯❯❯❮❮❮❮❮❮❮❮❮❮❮\n\n📝 ${title}\n\n* 𝙾𝚃𝙷𝙴𝚁 𝚀𝚄𝙻𝙸𝚃𝚈 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳📥\n\n❍ 1┊ ❮ *𝙽𝙾 𝚆𝙰𝚃𝙴𝚁𝙼𝙰𝚁𝙺 𝚅𝙸𝙳𝙴𝙾* ❯\n❍ 2┊ ❮ *𝙰𝚄𝙳𝙸𝙾 𝙼𝙿3* ❯\n❍ 3┊ ❮ *𝙳𝙾𝙲𝚄𝙼𝙴𝙽𝚃* ❯\n❍ 4┊ ❮ *𝚅𝙾𝙸𝙲𝙴 𝚃𝚈𝙿𝙴* ❯\n\n* \`📩 Reply To Number\`\n\n*${botName}*`
      }, { quoted: msg });

      const tiktokListener = async (msgUpdate) => {
        const reply2 = msgUpdate.messages[0];
        if (!reply2.message || !reply2.message.extendedTextMessage) return;

        const selectedOption = reply2.message.extendedTextMessage.text.trim();
        if (reply2.message.extendedTextMessage.contextInfo?.stanzaId !== vvvv.key.id) return;

        socket.ev.off('messages.upsert', tiktokListener);

        await socket.sendMessage(sender, { react: { text: '⬇️', key: reply2.key } });

        switch (selectedOption) {
          case "1":
            await socket.sendMessage(sender, { video: { url: dlsd }, caption: `> Downloaded No Watermark ✅` }, { quoted: msg });
            break;
          case "2":
            await socket.sendMessage(sender, { audio: { url: dlaudio }, mimetype: "audio/mpeg", fileName: `tiktok_audio.mp3`, caption: `> Downloaded in Audio Quality 🎵` }, { quoted: msg });
            break;
          case "3":
            await socket.sendMessage(sender, { document: { url: dlsd }, mimetype: "video/mp4", fileName: `tiktok_video.mp4`, caption: `> Downloaded as Document 📄` }, { quoted: msg });
            break;
          case "4":
            await socket.sendMessage(sender, { audio: { url: dlaudio }, mimetype: "audio/mp4", ptt: true }, { quoted: msg });
            break;
          default:
            reply("Invalid choice. Please reply with a valid number (1-4).");
            return;
        }

        await socket.sendMessage(sender, { react: { text: '⬆️', key: reply2.key } });
      };

      socket.ev.on('messages.upsert', tiktokListener);

      setTimeout(() => {
        socket.ev.off('messages.upsert', tiktokListener);
      }, 60000);

  }
};
