// Command: pcgame (aliases: game, pcgdl, playgame)
// Auto-extracted and structured like your fb.js/movie.js style.
module.exports = {
  name: 'pcgame',
  aliases: ['game', 'pcgdl', 'playgame'],
  async execute(ctx) {
    const {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT, resolveReplyJid, downloadQuotedMedia,
      getSriLankaTimestamp, formatMessage, fs, path, os
    } = ctx;

      const axios = require('axios');

      const sanitized = (number || '').replace(/[^0-9]/g, '');
      const cfg = sessionConfig; 
      const botName = cfg.botName || BOT_NAME_FANCY;

      const gameQuery = args.join(" ").trim();
      if (!gameQuery) {
        return reply(`꒰ᵎ 🎮 *PC Game Downloader* ᵎ꒱

    ⚠️ අම්මෝ මචං, ගේම් එකේ නමක් දෙන්න අමතක වෙලා!

    📌 *Usage:* ${prefix}pcgame <game name>
    📌 *Example:* ${prefix}pcgame GTA V

      ˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      await socket.sendMessage(sender, {
        react: { text: '🎮', key: msg.key }
      });

      const apiKey = 'key_c03461a36ebeedc181b2890a4987c6fd';

      let gameData;
      try {
        const res = await axios.get(
          `https://mr-thinuzz-api-build.vercel.app/api/pcgame/search?query=${encodeURIComponent(gameQuery)}&apiKey=${apiKey}`,
          { timeout: 20000 }
        );
        gameData = res.data?.data || res.data?.results || res.data;
      } catch (e) {
        console.log('[pcgame] API error:', e.message);
      }

      const game = Array.isArray(gameData) ? gameData[0] : gameData;

      if (!game) {
        return reply(`꒰ᵎ 🎮 *PC Game Downloader* ᵎ꒱

    ❌ මචං *${gameQuery}* නමින් කිසිම PC ගේම් එකක් හම්බ වුණේ නැහැ! වෙන නමකින් ට්‍රයි කරලා බලපන්.

      ˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      const title = game.title || game.name || 'PC Game';
      const size = game.size || 'Unknown Size';
      const thumbnail = game.image || game.poster || cfg.logo || config.IMAGE_PATH;
      const downloadLink = game.link || game.downloadUrl || game.url;

      if (!downloadLink) {
        return reply(`꒰ᵎ 🎮 *PC Game Downloader* ᵎ꒱

    ❌ මේ ගේම් එකට ඩවුන්ලෝඩ් ලින්ක් එකක් හොයාගන්න බැරි වුණා බං!

      ˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      const caption = `꒰ᵎ 🎮 *PC Game Downloader* ᵎ꒱

    🖥️ *Game Title* ➜ ${title}
    📦 *Size* ➜ ${size}

    ✨ *Download link is ready!*

    🔗 පහත ලින්ක් එක ක්ලික් කරලා හෝ කොපි කරලා ගේම් එක බාගන්න මචං.

      ˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    > 💬 *Powered by Sasiya Ayya* 🚀`;

      await socket.sendMessage(sender, {
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

      // ඩවුන්ලෝඩ් ලින්ක් එක කොපි කරගන්න ලේසි වෙන්න වෙනම මැසේජ් එකක් ලෙස යැවීම
      await socket.sendMessage(sender, {
        text: `꒰ᵎ 📥 *Direct Download Link* ᵎ꒱

🎮 *${title}*
🔗 ${downloadLink}

      ˚₊‧꒰ა 🌸 ໒꒱‧₊˚
*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`
      }, { quoted: msg });

      await socket.sendMessage(sender, {
        react: { text: '✅', key: msg.key }
      });

  }
};
