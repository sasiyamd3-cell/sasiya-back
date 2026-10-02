// Command: quote (alias: inspiring)
module.exports = {
  name: 'quote',
  aliases: ['inspiring', 'quotetalk'],
  async execute(ctx) {
    const { socket, msg, sender, reply, sessionConfig, BOT_NAME_FANCY, NEWSLETTER_CONTEXT } = ctx;
    const axios = require('axios');
    const botName = sessionConfig?.botName || BOT_NAME_FANCY;

    await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

    try {
      const { data } = await axios.get('https://api.quotable.io/random', { timeout: 10000 });
      const quoteText = data?.content;
      const author = data?.author;

      if (!quoteText) return reply(`❌ Failed to fetch quote!`);

      await socket.sendMessage(sender, {
        text: `꒰ᵎ 💡 *Inspiring Quote* ᵎ꒱\n\n> "${quoteText}"\n\n— *${author}*\n\n*${botName}*`,
        contextInfo: {
          forwardingScore: 1, isForwarded: true,
          forwardedNewsletterMessageInfo: { newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid, newsletterName: botName, serverMessageId: 999 }
        }
      }, { quoted: msg });
      await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (e) {
      return reply(`❌ Error fetching quote!`);
    }
  }
};
