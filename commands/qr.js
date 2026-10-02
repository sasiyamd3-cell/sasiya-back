// Command: qr (alias: qrcode)
module.exports = {
  name: 'qr',
  aliases: ['qrcode'],
  async execute(ctx) {
    const { socket, msg, sender, args, reply, sessionConfig, BOT_NAME_FANCY, NEWSLETTER_CONTEXT } = ctx;
    const botName = sessionConfig?.botName || BOT_NAME_FANCY;

    const text = args.join(" ");
    if (!text) {
      return reply(`꒰ᵎ 🔲 *QR Code Generator* ᵎ꒱\n\n⚠️ Please provide text or a link!\n\n📌 *Usage:* .qr <text/link>\n\n*${botName}*`);
    }

    await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;

      await socket.sendMessage(sender, {
        image: { url: qrUrl },
        caption: `꒰ᵎ 🔲 *QR Code Generated* ᵎ꒱\n\n📌 *Data:* ${text}\n\n*${botName}*`,
        contextInfo: {
          forwardingScore: 1, isForwarded: true,
          forwardedNewsletterMessageInfo: { newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid, newsletterName: botName, serverMessageId: 999 }
        }
      }, { quoted: msg });
      await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (e) {
      return reply(`❌ Error generating QR code!`);
    }
  }
};
