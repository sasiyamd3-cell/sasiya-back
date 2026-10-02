// Command: image (aliases: img, googleimage)
module.exports = {
  name: 'image',
  aliases: ['img', 'googleimage'],
  async execute(ctx) {
    const { socket, msg, sender, args, reply, sessionConfig, BOT_NAME_FANCY, NEWSLETTER_CONTEXT } = ctx;
    const axios = require('axios');
    const botName = sessionConfig?.botName || BOT_NAME_FANCY;

    const query = args.join(" ");
    if (!query) {
      return reply(`꒰ᵎ 🖼️ *Image Search* ᵎ꒱\n\n⚠️ What image do you want to search?\n\n📌 *Usage:* .image <search query>\n\n*${botName}*`);
    }

    await socket.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

    try {
      const { data } = await axios.get(`https://www.movanest.xyz/v2/image?query=${encodeURIComponent(query)}`, { timeout: 15000 });
      const imageUrl = data?.result?.[0] || data?.data?.[0] || data?.[0];

      if (!imageUrl) return reply(`❌ No images found for *${query}*!`);

      await socket.sendMessage(sender, {
        image: { url: imageUrl },
        caption: `꒰ᵎ 🖼️ *Google Image Search* ᵎ꒱\n\n🔍 *Query:* ${query}\n\n*${botName}*`,
        contextInfo: {
          forwardingScore: 1, isForwarded: true,
          forwardedNewsletterMessageInfo: { newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid, newsletterName: botName, serverMessageId: 999 }
        }
      }, { quoted: msg });
      await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (e) {
      return reply(`❌ Error fetching image!`);
    }
  }
};
