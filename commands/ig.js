// Command: ig
// Auto-extracted from sakura.js switch-case during commandLoader refactor.
module.exports = {
  name: 'ig',
  aliases: [],
  async execute(ctx) {
    const {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT, resolveReplyJid, downloadQuotedMedia,
      getSriLankaTimestamp, formatMessage, os
    } = ctx;

      const axios = require('axios');
      const fs = require('fs');
      const path = require('path');

      const sanitized = (number || '').replace(/[^0-9]/g, '');
      const cfg = sessionConfig; // reused from top of handler (was: extra Mongo query per command)
      const botName = cfg.botName || BOT_NAME_FANCY;

      await socket.sendMessage(sender, {
        react: { text: '⬇️', key: msg.key }
      });

      const igUrl = q;
      if (!igUrl || !igUrl.includes("instagram.com")) {
        return reply("❌ Please provide an Instagram link!\n\n*Usage:* .ig <Instagram URL>\n*Example:* .ig https://instagram.com/reel/...");
      }

      const apiUrl = `https://api-aswin-sparky.koyeb.app/api/downloader/igdl?url=${encodeURIComponent(igUrl)}`;
      const response = await axios.get(apiUrl, { maxRedirects: 5, timeout: 30000 });

      if (!response.data?.status || !response.data.data?.length) {
        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        return reply("❌ Failed to fetch media. Invalid link or private content.");
      }

      const media = response.data.data[0];
      const { type, thumbnail, url: videoUrl } = media;

      await socket.sendMessage(sender, {
        react: { text: '⤴️', key: msg.key }
      });

      let caption = `📸 *INSTAGRAM DOWNLOADER*\n\n`;
      caption += `📹 *Type:* ${type.toUpperCase()}\n\n`;
      caption += `━━━━━━━━━━━━━━━━━\n\n`;
      caption += `📌 *Select Download Option:*\n\n`;
      caption += `1️⃣ - 🎬 Video\n`;
      caption += `2️⃣ - 📄 Document\n\n`;
      caption += `Reply with a number (1-2)\n\n`;
      caption += `> ©${botName} ʙʏ 𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ`;

      const optionsMsg = await socket.sendMessage(
        sender,
        {
          image: { url: thumbnail },
          caption: caption,
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid,
              newsletterName: botName,
              serverMessageId: 143
            }
          }
        },
        { quoted: msg }
      );

      global.igDownloads = global.igDownloads || {};
      global.igDownloads[sender] = {
        videoUrl,
        thumbnail,
        type,
        messageId: optionsMsg.key.id,
        timestamp: Date.now(),
        waiting: true
      };

      const numberListener = async (update) => {
        try {
          const newMsg = update?.messages?.[0];
          if (!newMsg?.message) return;
          if (resolveReplyJid(newMsg) !== sender) return;

          const igData = global.igDownloads[sender];
          if (!igData || !igData.waiting) return;

          const userReply =
            newMsg.message?.conversation ||
            newMsg.message?.extendedTextMessage?.text || '';

          const choice = userReply.trim();
          if (!['1', '2'].includes(choice)) return;

          igData.waiting = false;
          socket.ev.off('messages.upsert', numberListener);

          let downloadType = choice === '1' ? 'video' : 'document';

          await socket.sendMessage(sender, {
            text: `⬇️ *Downloading ${downloadType.toUpperCase()}...*\n\n⏳ Please wait...`
          }, { quoted: newMsg });

          const tempDir = path.join(__dirname, 'temp');
          if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

          const unique = Date.now();

          const fileResponse = await axios.get(igData.videoUrl, {
            responseType: 'arraybuffer',
            timeout: 60000
          });

          const fileSize = (fileResponse.data.length / 1024 / 1024).toFixed(2);
          const filePath = path.join(tempDir, `ig_${unique}.mp4`);
          fs.writeFileSync(filePath, fileResponse.data);

          const fileCaption = `📸 *INSTAGRAM VIDEO*\n\n📦 Size: ${fileSize} MB\n\n> ©${botName} ʙʏ 𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ`;

          const contextInfo = {
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid,
              newsletterName: botName,
              serverMessageId: 143
            }
          };

          try {
            if (downloadType === 'video') {
              await socket.sendMessage(sender, {
                video: fs.readFileSync(filePath),
                caption: fileCaption,
                contextInfo
              }, { quoted: newMsg });
            } else {
              await socket.sendMessage(sender, {
                document: fs.readFileSync(filePath),
                mimetype: 'video/mp4',
                fileName: `Instagram_${unique}.mp4`,
                caption: fileCaption,
                contextInfo
              }, { quoted: newMsg });
            }
          } finally {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }

          await socket.sendMessage(sender, { react: { text: '✅', key: newMsg.key } });
          delete global.igDownloads[sender];

        } catch (err) {
          await socket.sendMessage(sender, { text: `❌ Download Error!\n\n${err.message}` });
          delete global.igDownloads[sender];
        }
      };

      socket.ev.on('messages.upsert', numberListener);

      setTimeout(() => {
        if (global.igDownloads[sender]?.waiting) {
          socket.ev.off('messages.upsert', numberListener);
          delete global.igDownloads[sender];
        }
      }, 5 * 60 * 1000);

  }
};
