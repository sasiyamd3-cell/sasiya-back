// Command: movie (aliases: cinesubz, film, mv)
// CineSubz Movie Downloader using Mr Ransara API
module.exports = {
  name: 'movie',
  aliases: ['cinesubz', 'film', 'mv'],
  async execute(ctx) {
    const {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT, resolveReplyJid
    } = ctx;

    const axios = require('axios');

    const sanitized = (number || '').replace(/[^0-9]/g, '');
    const cfg = sessionConfig;
    const botName = cfg?.botName || BOT_NAME_FANCY || 'Black Cat';

    // ඔයා දුන් නිවැරදි API Key එක සහ Base URL එක
    const API_KEY = 'key_c03461a36ebeedc181b2890a4987c6fd';
    const searchQuery = args.join(" ").trim();

    if (!searchQuery) {
      return reply(`꒰ᵎ 🎬 *Movie Downloader* ᵎ꒱

⚠️ Please provide a movie name!

📌 *Usage:* ${prefix}movie <movie name>
📌 *Example:* ${prefix}movie PAW Patrol

　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
    }

    await socket.sendMessage(sender, {
      react: { text: '🔍', key: msg.key }
    });

    try {
      // 1. ඔයා දුන් සර්ච් API එක හරහා ෆිල්ම් එක සර්ච් කිරීම
      const searchUrl = `https://mr-thinuzz-api-build.vercel.app/api/cinesubz/search?query=${encodeURIComponent(searchQuery)}&apiKey=${API_KEY}`;
      const searchRes = await axios.get(searchUrl, { timeout: 30000 });
      const searchData = searchRes.data;

      // API එකෙන් ලැබෙන රිසල්ට් එක ලබා ගැනීම (ඔබේ API structure එකට අනුව)
      const results = searchData?.results || searchData?.data || searchData;
      if (!results || (Array.isArray(results) && results.length === 0)) {
        return reply(`꒰ᵎ 🎬 *Movie Downloader* ᵎ꒱

❌ No movies found for *${searchQuery}*!

　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      // පළමු ෆිල්ම් එකේ ලින්ක් එක (URL) ලබා ගැනීම
      const firstMovie = Array.isArray(results) ? results[0] : results;
      const moviePageUrl = firstMovie.link || firstMovie.url;
      const thumbUrl = firstMovie.image || firstMovie.poster || config.IMAGE_PATH;

      if (!moviePageUrl) {
        return reply(`❌ Error: Movie link not found in API response!`);
      }

      // 2. එම ෆිල්ම් එකේ ඩවුන්ලෝඩ් ලින්ක් සහ විස්තර ලබා ගැනීම
      const detailUrl = `https://mr-thinuzz-api-build.vercel.app/api/cinesubz/movie?url=${encodeURIComponent(moviePageUrl)}&apiKey=${API_KEY}`;
      const detailRes = await axios.get(detailUrl, { timeout: 30000 });
      const responseData = detailRes.data;

      // ඔයා එවපු JSON ස්වරූපයට අනුව (data -> title, size, downloadUrls)
      const movieInfo = responseData?.data || responseData;
      const movieTitle = movieInfo?.title || searchQuery;
      const fileSize = movieInfo?.size || 'Unknown Size';
      const downloadUrls = movieInfo?.downloadUrls || [];

      if (!downloadUrls.length) {
        return reply(`꒰ᵎ 🎬 *Movie Downloader* ᵎ꒱

❌ Download links not available for this movie!

　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      // Pixeldrain හෝ Direct MP4 ලින්ක් එක තෝරා ගැනීම (පළමු ලින්ක් එක)
      const directDownloadUrl = downloadUrls[0].url;

      const caption = `꒰ᵎ 🎬 *CineSubz Movie Downloader* ᵎ꒱

🎥 *Title* ➜ ${movieTitle}
📦 *Size* ➜ ${fileSize}

✨ *Select your sending format!*

　1️⃣ ➜ 🎥 Video File (Direct Stream)
　2️⃣ ➜ 📄 Document File (HQ Download)

　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
> 💬 *Reply 1 or 2* 👆`;

      let sentMsg;
      try {
        sentMsg = await socket.sendMessage(sender, {
          image: { url: thumbUrl },
          caption,
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
      } catch (e) {
        sentMsg = await socket.sendMessage(sender, {
          text: caption,
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
      }

      await socket.sendMessage(sender, {
        react: { text: '✅', key: msg.key }
      });

      // පරිශීලකයාගෙන් අංකයක් (1 හෝ 2) ලැබෙන තෙක් බලා සිටීම
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
          text: `꒰ᵎ ⏰ *Time Out* ᵎ꒱\n\n⌛ 60 seconds expired!\n\n*${botName}* 🖤`
        }, { quoted: sentMsg });
      }

      const choice = (collected.message?.conversation || collected.message?.extendedTextMessage?.text || '').trim();
      const formatLabel = choice === '1' ? 'Video File 🎥' : 'Document File 📄';

      await socket.sendMessage(sender, {
        text: `꒰ᵎ 📥 *Downloading Movie* ᵎ꒱\n\n⏳ Processing *${formatLabel}*...\n🎬 *${movieTitle}*\n\n　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚`
      }, { quoted: collected });

      const nlCtx = {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid,
          newsletterName: botName,
          serverMessageId: 999,
        }
      };

      if (choice === '1') {
        // Video එකක් ලෙස යැවීම
        await socket.sendMessage(sender, {
          video: { url: directDownloadUrl },
          mimetype: 'video/mp4',
          caption: `🎬 *${movieTitle}*\n📦 *Size:* ${fileSize}\n\n*${botName}* 🖤`,
          contextInfo: nlCtx
        }, { quoted: collected });

      } else if (choice === '2') {
        // Document (MP4 file) එකක් ලෙස යැවීම
        await socket.sendMessage(sender, {
          document: { url: directDownloadUrl },
          mimetype: 'video/mp4',
          fileName: movieTitle,
          caption: `🎬 *${movieTitle}*\n📦 *Size:* ${fileSize}\n\n*${botName}* 🖤`,
          contextInfo: nlCtx
        }, { quoted: collected });
      }

      await socket.sendMessage(sender, {
        react: { text: '🎬', key: msg.key }
      });

    } catch (err) {
      console.log('[movie] Error:', err.message);
      await reply(`꒰ᵎ ❌ *Error* ᵎ꒱\n\n⚠️ Failed to fetch movie details from API!\n\n*${botName}* 🖤`);
    }

  }
};
