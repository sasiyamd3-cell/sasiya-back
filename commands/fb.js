// Command: fb (aliases: fbdl, facebook, fbd)
// Auto-extracted from sakura.js switch-case during commandLoader refactor.
module.exports = {
  name: 'fb',
  aliases: ['fbdl', 'facebook', 'fbd'],
  async execute(ctx) {
    const {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT, resolveReplyJid, downloadQuotedMedia,
      getSriLankaTimestamp, formatMessage, fs, path, os
    } = ctx;

      const axios = require('axios');

      const sanitized = (number || '').replace(/[^0-9]/g, '');
      const cfg = sessionConfig; // reused from top of handler (was: extra Mongo query per command)
      const botName = cfg.botName || BOT_NAME_FANCY;

      const url = args[0];
      if (!url) {
        return reply(`꒰ᵎ 🎬 *FB Downloader* ᵎ꒱

    ⚠️ Please provide a Facebook link!

    📌 *Usage:* ${prefix}fb <url>
    📌 *Example:* ${prefix}fb https://fb.watch/xxx

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      if (!url.includes('facebook.com') && !url.includes('fb.watch')) {
        return reply(`꒰ᵎ 🎬 *FB Downloader* ᵎ꒱

    ❌ Please provide a valid Facebook link!

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      await socket.sendMessage(sender, {
        react: { text: '⏳', key: msg.key }
      });

      const { data } = await axios.get(
        `https://www.movanest.xyz/v2/fbdown?url=${encodeURIComponent(url)}`,
        { timeout: 15000 }
      );

      if (!data.status || !data.results || !data.results.length) {
        return reply(`꒰ᵎ 🎬 *FB Downloader* ᵎ꒱

    ❌ Failed to fetch video info!

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      const video = data.results[0];
      const title = video.title || 'Facebook Video';
      const thumbnail = cfg.logo || config.IMAGE_PATH;
      const duration = video.duration || 'Unknown';
      const sdLink = video.normalQualityLink;
      const hdLink = video.hdQualityLink || sdLink;

      if (!sdLink && !hdLink) {
        return reply(`꒰ᵎ 🎬 *FB Downloader* ᵎ꒱

    ❌ No download links found!

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      const caption = `꒰ᵎ 🎬 *FB Downloader* ᵎ꒱

    🎥 *Title* ➜ ${title}
    ⏱️ *Duration* ➜ ${duration}

    ✨ *Select your quality!*

    　1️⃣ ➜ SD Quality
    　2️⃣ ➜ HD Quality

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    > 💬 *Reply 1 or 2* 👆`;

      const sentMsg = await socket.sendMessage(sender, {
        image: { url: thumbnail },
        caption: caption,
        contextInfo: {
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

      const collected = await new Promise((resolve) => {
        const listener = ({ messages }) => {
          for (const m2 of messages) {
            const isReply = m2.message?.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;
            const text = (m2.message?.conversation || m2.message?.extendedTextMessage?.text || '').trim();
            const isValid = ['1', '2'].includes(text);
            const isSame = resolveReplyJid(m2) === sender;

            if (isReply && isValid && isSame) {
              clearTimeout(timeout);
              socket.ev.off('messages.upsert', listener);
              resolve(m2);
            }
          }
        };

        const timeout = setTimeout(() => {
          socket.ev.off('messages.upsert', listener);
          resolve(null);
        }, 60000);

        socket.ev.on('messages.upsert', listener);
      });

      if (!collected) {
        return socket.sendMessage(sender, {
          text: `꒰ᵎ ⏰ *Time Out* ᵎ꒱

    ⌛ 60 seconds expired!

    > Please use *${prefix}fb* command again 🌸

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`
        }, { quoted: sentMsg });
      }

      const choice = (collected.message?.conversation || collected.message?.extendedTextMessage?.text || '').trim();
      const downloadLink = choice === '2' ? hdLink : sdLink;
      const qualityLabel = choice === '2' ? 'HD 🎯' : 'SD 📱';

      await socket.sendMessage(sender, {
        text: `꒰ᵎ 📥 *Downloading* ᵎ꒱

    ⏳ Downloading *${qualityLabel}* video...
    🎥 *${title}*

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚`
      }, { quoted: collected });

      await socket.sendMessage(sender, {
        video: { url: downloadLink },
        caption: `꒰ᵎ 🎬 *FB Downloader* ᵎ꒱

    ✅ *Download Complete!*

    🎥 *Title* ➜ ${title}
    📊 *Quality* ➜ ${qualityLabel}
    ⏱️ *Duration* ➜ ${duration}

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`,
        contextInfo: {
          forwardingScore: 1,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid,
            newsletterName: botName,
            serverMessageId: 999,
          }
        }
      }, { quoted: collected });

      await socket.sendMessage(sender, {
        react: { text: '🎬', key: msg.key }
      });

  }
};
