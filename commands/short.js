// Command: short (aliases: tinyurl, shorturl)
module.exports = {
  name: 'short',
  aliases: ['tinyurl', 'shorturl'],
  async execute(ctx) {
    const { socket, msg, sender, args, reply, sessionConfig, BOT_NAME_FANCY, NEWSLETTER_CONTEXT } = ctx;
    const axios = require('axios');
    const botName = sessionConfig?.botName || BOT_NAME_FANCY;

    const url = args[0];
    if (!url || !url.startsWith('http')) {
      return reply(`꒰ᵎ 🔗 *URL Shortener* ᵎ꒱\n\n⚠️ Please provide a valid URL!\n\n📌 *Usage:* .short <url>\n\n*${botName}*`);
    }

    await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

    try {
      const { data } = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 10000 });
      
      if (!data) return reply(`❌ Failed to shorten URL!`);

      await socket.sendMessage(sender, {
        text: `꒰ᵎ 🔗 *URL Shortened* ᵎ꒱\n\n📌 *Original:* ${url}\n✨ *Shortened:* ${data}\n\n*${botName}*`,
        contextInfo: {
          forwardingScore: 1, isForwarded: true,
          forwardedNewsletterMessageInfo: { newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid, newsletterName: botName, serverMessageId: 999 }
        }
      }, { quoted: msg });
      await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (e) {
      return reply(`❌ Error processing URL!`);
    }
  }
};
