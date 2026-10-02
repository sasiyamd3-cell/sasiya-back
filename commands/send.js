// Command: send
// Auto-extracted from sakura.js switch-case during commandLoader refactor.
module.exports = {
  name: 'send',
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

      await socket.sendMessage(sender, {
        react: { text: '⤵️', key: msg.key }
      });

      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg) return reply(`🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ʀᴇᴘʟʏ ᴛᴏ ᴀ sᴛᴀᴛᴜs* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n❌ Please reply to a status message!`);

      const qTypeMap = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', stickerMessage: 'sticker' };
      const foundKey = Object.keys(qTypeMap).find(t => quotedMsg[t]);

      if (!foundKey) return reply(`🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ᴜɴsᴜᴘᴘᴏʀᴛᴇᴅ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n❌ This message type is not supported!`);

      const messageType = qTypeMap[foundKey];
      const mediaMessage = quotedMsg[foundKey];
      const caption = mediaMessage.caption || '';

      await socket.sendMessage(sender, { text: `🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ sᴛᴀᴛᴜs* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n⏬ Please wait...` });

      await socket.sendMessage(sender, {
        react: { text: '⤴️', key: msg.key }
      });

      // uses the bot's own downloadQuotedMedia() helper (built on the already-imported
      // downloadContentFromMessage from the 'baileys' package) instead of pulling in
      // '@whiskeysockets/baileys' separately, which is a different package than the
      // one this bot runs on and would crash with a "module not found" error.
      let downloaded;
      try {
        downloaded = await downloadQuotedMedia(quotedMsg);
      } catch (downloadError) {
        return reply(`🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ᴅᴏᴡɴʟᴏᴀᴅ ꜰᴀɪʟᴇᴅ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n❌ Status might have expired or been deleted!`);
      }

      if (!downloaded || !downloaded.buffer || downloaded.buffer.length === 0) return reply(`🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ᴇᴍᴘᴛʏ ꜰɪʟᴇ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n❌ Downloaded file is empty!`);

      const buffer = downloaded.buffer;
      const fileSizeKB = Math.round(buffer.length / 1024);
      const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
      const sizeText = fileSizeKB > 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;

      const statusCaption = `🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *sᴛᴀᴛᴜs sᴀᴠᴇᴅ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n📝 *ᴄᴀᴘᴛɪᴏɴ* ➤ ${caption || 'No caption'}\n📏 *sɪᴢᴇ* ➤ ${sizeText}\n⏰ *ᴛɪᴍᴇ* ➤ ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}\n\n*${botName}* 🖤`;

      switch (messageType) {
        case 'image':
          await socket.sendMessage(sender, { image: buffer, caption: statusCaption, mimetype: 'image/jpeg' }, { quoted: msg });
          break;
        case 'video':
          await socket.sendMessage(sender, { video: buffer, caption: statusCaption, mimetype: 'video/mp4', gifPlayback: mediaMessage.gifPlayback || false }, { quoted: msg });
          break;
        case 'audio':
          await socket.sendMessage(sender, { audio: buffer, mimetype: 'audio/mpeg', ptt: mediaMessage.ptt || false }, { quoted: msg });
          await socket.sendMessage(sender, { text: `🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ᴀᴜᴅɪᴏ sᴀᴠᴇᴅ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n📏 *sɪᴢᴇ* ➤ ${sizeText}\n\n*${botName}* 🖤` }, { quoted: msg });
          break;
        case 'sticker':
          await socket.sendMessage(sender, { sticker: buffer }, { quoted: msg });
          await socket.sendMessage(sender, { text: `🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *sᴛɪᴄᴋᴇʀ sᴀᴠᴇᴅ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n📏 *sɪᴢᴇ* ➤ ${sizeText}\n\n*${botName}* 🖤` }, { quoted: msg });
          break;
      }

      await socket.sendMessage(sender, {
        react: { text: '✅', key: msg.key }
      });

  }
};
