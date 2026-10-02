// Command: mediafire (aliases: mfire, mf)
module.exports = {
  name: 'mediafire',
  aliases: ['mfire', 'mf'],
  async execute(ctx) {
    const { socket, msg, sender, args, reply, sessionConfig, BOT_NAME_FANCY, NEWSLETTER_CONTEXT } = ctx;
    const axios = require('axios');
    const botName = sessionConfig?.botName || BOT_NAME_FANCY;

    const url = args[0];
    if (!url || !url.includes('mediafire.com')) {
      return reply(`꒰ᵎ 📦 *MediaFire Downloader* ᵎ꒱\n\n⚠️ Please provide a valid MediaFire link!\n\n📌 *Usage:* .mediafire <url>\n\n*${botName}*`);
    }

    await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

    try {
      const { data } = await axios.get(`https://www.movanest.xyz/v2/mediafire?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const fileInfo = data?.result || data?.data;
      
      if (!fileInfo || !fileInfo.link) return reply(`❌ Failed to extract file link!`);

      await socket.sendMessage(sender, {
        document: { url: fileInfo.link },
        mimetype: fileInfo.mimetype || 'application/octet-stream',
        fileName: fileInfo.name || 'downloaded_file.zip',
        caption: `꒰ᵎ 📦 *MediaFire Download Complete* ᵎ꒱\n\n📁 *File:* ${fileInfo.name}\n📊 *Size:* ${fileInfo.size}\n\n*${botName}*`,
        contextInfo: {
          forwardingScore: 1, isForwarded: true,
          forwardedNewsletterMessageInfo: { newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid, newsletterName: botName, serverMessageId: 999 }
        }
      }, { quoted: msg });
      await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (e) {
      return reply(`❌ Error processing MediaFire link!`);
    }
  }
};
