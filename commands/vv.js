// Command: vv
// Auto-extracted from sakura.js switch-case during commandLoader refactor.
module.exports = {
  name: 'vv',
  aliases: [],
  async execute(ctx) {
    const {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT, resolveReplyJid, downloadQuotedMedia,
      getSriLankaTimestamp, formatMessage, os
    } = ctx;

      const fs = require("fs");
      const path = require("path");
      const Crypto = require("crypto");

      await socket.sendMessage(sender, {
        react: { text: '🖨️', key: msg.key }
      });

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo
        || msg.message?.imageMessage?.contextInfo
        || msg.message?.videoMessage?.contextInfo;
      const quotedMessage = contextInfo?.quotedMessage;

      if (!quotedMessage) {
        return reply("⚠️ Please quote a ViewOnce image or video!");
      }

      // unwrap the ViewOnce wrapper (viewOnceMessage / viewOnceMessageV2 / viewOnceMessageV2Extension)
      const quoted =
        quotedMessage.viewOnceMessageV2?.message ||
        quotedMessage.viewOnceMessageV2Extension?.message ||
        quotedMessage.viewOnceMessage?.message ||
        quotedMessage;

      const sanitized = (number || '').replace(/[^0-9]/g, '');
      const cfg = sessionConfig; // reused from top of handler (was: extra Mongo query per command)
      const botName = cfg.botName || BOT_NAME_FANCY;

      const downloaded = await downloadQuotedMedia(quoted);
      if (!downloaded || !downloaded.buffer) {
        return reply("⚠️ Failed to download the media. Please try again.");
      }

      const { buffer: mediaBuffer, mime, caption: cap } = downloaded;

      const rawTs = msg.messageTimestamp;
      const sentDate = new Date((rawTs ? Number(rawTs) : Date.now() / 1000) * 1000);
      const sentStr = sentDate.toLocaleString("en-US", {
        timeZone: "Asia/Colombo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });

      let mediaType = '';
      if ((mime || '').startsWith("image")) {
        mediaType = "jpg";
      } else if ((mime || '').startsWith("video")) {
        mediaType = "mp4";
      } else {
        mediaType = "mp3";
      }

      const tempFileName = `${sanitized}_${Crypto.randomBytes(8).toString('hex')}.${mediaType}`;
      const tempFilePath = path.join(__dirname, 'temp', tempFileName);

      const bytes = mediaBuffer.length;
      let sizeStr = '';
      if (bytes < 1024) {
        sizeStr = `${bytes} B`;
      } else if (bytes < 1024 * 1024) {
        sizeStr = `${(bytes / 1024).toFixed(2)} KB`;
      } else {
        sizeStr = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      }

      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(tempFilePath, mediaBuffer);

      if (!fs.existsSync(tempFilePath)) {
        return reply("⚠️ Media file could not be found after download.");
      }

      const finalCaption =
        (cap ? cap + "\n\n" : "") +
        `📦 *Size :* ${sizeStr}\n` +
        `🕐 *Sent :* ${sentStr}\n\n` +
        `✨ *Powered by* *${botName}* 🐾`;

      const channelContext = {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid,
          newsletterName: botName,
          serverMessageId: 999,
        }
      };

      try {
        if (mediaType === "jpg") {
          await socket.sendMessage(sender, {
            image: { url: tempFilePath },
            caption: finalCaption,
            contextInfo: channelContext
          }, { quoted: msg });

        } else if (mediaType === "mp4") {
          await socket.sendMessage(sender, {
            video: { url: tempFilePath },
            caption: finalCaption,
            mimetype: "video/mp4",
            contextInfo: channelContext
          }, { quoted: msg });

        } else {
          await socket.sendMessage(sender, {
            audio: { url: tempFilePath },
            mimetype: "audio/mp4",
            ptt: true,
            contextInfo: channelContext
          }, { quoted: msg });
        }
      } finally {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }

  }
};
