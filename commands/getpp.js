// Command: getpp (aliases: getdp)
// Auto-extracted from sakura.js switch-case during commandLoader refactor.
module.exports = {
  name: 'getpp',
  aliases: ['getdp'],
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
        react: { text: '🖼️', key: msg.key }
      });

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const mentioned = contextInfo?.mentionedJid;
      const quotedParticipant = contextInfo?.participant;

      let targetJid;
      if (args[0]) {
        targetJid = `${args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net`;
      } else if (mentioned && mentioned.length) {
        targetJid = mentioned[0];
      } else if (quotedParticipant) {
        targetJid = quotedParticipant;
      } else {
        targetJid = sender;
      }

      if (!targetJid || targetJid === '@s.whatsapp.net') {
        return reply(`🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ɴᴏ ᴛᴀʀɢᴇᴛ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n⚠️ Reply to, mention, or give a number to fetch a profile picture!\n\n📌 *Usage:* ${prefix}getpp <number>\n📌 *Example:* ${prefix}getpp 947xxxxxxx`);
      }

      const ppUrl = await socket.profilePictureUrl(targetJid, 'image').catch(() => null);

      if (!ppUrl) {
        return reply(`🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ɴᴏ ᴅᴘ ꜰᴏᴜɴᴅ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n⚠️ No profile picture found for that user!`);
      }

      const targetNumber = targetJid.split('@')[0];

      const ppCaption =
        `🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ᴘʀᴏꜰɪʟᴇ ᴘɪᴄᴛᴜʀᴇ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n` +
        `📱 *ᴜsᴇʀ* ➤ @${targetNumber}\n\n` +
        `*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`;

      await socket.sendMessage(sender, {
        image: { url: ppUrl },
        caption: ppCaption,
        contextInfo: {
          mentionedJid: [targetJid],
          forwardingScore: 1,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid,
            newsletterName: botName,
            serverMessageId: 999,
          }
        }
      }, { quoted: msg });

      await socket.sendMessage(sender, {
        react: { text: '✅', key: msg.key }
      });

  }
};
