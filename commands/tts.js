// Command: tts (alias: texttospeech)
module.exports = {
  name: 'tts',
  aliases: ['texttospeech', 'voice'],
  async execute(ctx) {
    const { socket, msg, sender, args, reply, sessionConfig, BOT_NAME_FANCY, NEWSLETTER_CONTEXT } = ctx;
    const axios = require('axios');
    const botName = sessionConfig?.botName || BOT_NAME_FANCY;

    const text = args.join(" ");
    if (!text) {
      return reply(`꒰ᵎ 🎙️ *Text To Speech* ᵎ꒱\n\n⚠️ Please provide text to convert!\n\n📌 *Usage:* .tts Hello Machan\n\n*${botName}*`);
    }

    await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

    try {
      // Using Google TTS API endpoint
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=si&client=tw-ob`;

      await socket.sendMessage(sender, {
        audio: { url: ttsUrl },
        mimetype: 'audio/mp4',
        ptt: true, // Send as Voice Note (PTT)
        contextInfo: {
          forwardingScore: 1, isForwarded: true,
          forwardedNewsletterMessageInfo: { newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid, newsletterName: botName, serverMessageId: 999 }
        }
      }, { quoted: msg });
      await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (e) {
      return reply(`❌ Error generating voice note!`);
    }
  }
};
