// Command: song (aliases: music, ytmp3, yt)
// Auto-extracted from sakura.js switch-case during commandLoader refactor.
module.exports = {
  name: 'song',
  aliases: ['music', 'ytmp3', 'yt'],
  async execute(ctx) {
    const {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT, resolveReplyJid, downloadQuotedMedia,
      getSriLankaTimestamp, formatMessage, os
    } = ctx;

      const yts    = require('yt-search');
      const axios  = require('axios');
      const ffmpeg = require('fluent-ffmpeg');
      const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
      const path   = require('path');
      const osModule = require('os');
      const fs     = require('fs');
      const crypto = require('crypto');

      ffmpeg.setFfmpegPath(ffmpegInstaller.path);

      const sanitized = (number || '').replace(/[^0-9]/g, '');
      const cfg = sessionConfig; // reused from top of handler (was: extra Mongo query per command)
      const botName = cfg.botName || BOT_NAME_FANCY;

      const YT_API = 'https://youtube-scrap-ecru.vercel.app';

      const songQuery = args.join(" ").trim();

      if (!songQuery) {
        return reply(`꒰ᵎ 🎵 *Song Downloader* ᵎ꒱

    ⚠️ Please provide a song name!

    📌 *Usage:* ${prefix}song <song name>
    📌 *Example:* ${prefix}song Shape of You

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      await socket.sendMessage(sender, {
        react: { text: '🔍', key: msg.key }
      });

      const search = await yts(songQuery);
      if (!search?.videos?.length) {
        return reply(`꒰ᵎ 🎵 *Song Downloader* ᵎ꒱

    ❌ No results found for *${songQuery}*!

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      const video    = search.videos[0];
      const sUrl     = video.url;
      const sMetadata = video;

      const videoId  = sUrl.split('v=')[1]?.split('&')[0] || sUrl.split('youtu.be/')[1]?.split('?')[0];
      const thumbUrl = videoId
        ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        : sMetadata.thumbnail;

      let sDownloadUrl = null;
      let sTitle       = sMetadata.title || 'Song';

      try {
        const apiResp = await axios.get(`${YT_API}/api/mp3?url=${encodeURIComponent(sUrl)}`, {
          timeout: 30000
        });
        if (apiResp.data?.status && apiResp.data?.url) {
          sDownloadUrl = apiResp.data.url;
          sTitle       = apiResp.data.title || sTitle;
        }
      } catch (e) {
        console.log('[song] API error:', e.message);
      }

      if (!sDownloadUrl) {
        return reply(`꒰ᵎ 🎵 *Song Downloader* ᵎ꒱

    ❌ Download failed! API unavailable.

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      const caption = `꒰ᵎ 🎵 *Song Downloader* ᵎ꒱

    🎶 *Title* ➜ ${sTitle}
    ⏱️ *Duration* ➜ ${sMetadata.timestamp || 'N/A'}
    👁️ *Views* ➜ ${sMetadata.views?.toLocaleString() || 'N/A'}
    🔗 *URL* ➜ ${sUrl}

    ✨ *Select your format!*

    　1️⃣ ➜ 🎵 MP3 File
    　2️⃣ ➜ 🎤 Voice Message
    　3️⃣ ➜ 📄 Document

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    > 💬 *Reply 1, 2 or 3* 👆`;

      const sentMsg = await socket.sendMessage(sender, {
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

      await socket.sendMessage(sender, {
        react: { text: '✅', key: msg.key }
      });

      const collected = await new Promise((resolve) => {
        const listener = ({ messages }) => {
          for (const m2 of messages) {
            const isReply  = m2.message?.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id;
            const text     = (m2.message?.conversation || m2.message?.extendedTextMessage?.text || '').trim();
            const isValid  = ['1', '2', '3'].includes(text);
            const isSame   = resolveReplyJid(m2) === sender;
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

    > Please use *${prefix}song* command again 🌸

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
    *${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`
        }, { quoted: sentMsg });
      }

      const choice      = (collected.message?.conversation || collected.message?.extendedTextMessage?.text || '').trim();
      const formatLabel = choice === '1' ? 'MP3 🎵' : choice === '2' ? 'Voice Message 🎤' : 'Document 📄';

      await socket.sendMessage(sender, {
        text: `꒰ᵎ 📥 *Downloading* ᵎ꒱

    ⏳ Processing *${formatLabel}*...
    🎶 *${sTitle}*

    　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚`
      }, { quoted: collected });

      const _id    = crypto.randomBytes(8).toString('hex');
      const tmpMp3  = path.join(osModule.tmpdir(), `song_${_id}.mp3`);
      const tmpTag  = path.join(osModule.tmpdir(), `tag_${_id}.mp3`);
      const tmpOpus = path.join(osModule.tmpdir(), `song_${_id}.opus`);
      const tmpOut  = path.join(osModule.tmpdir(), `song_out_${_id}.mp3`);

      try {
        const dlResp = await axios.get(sDownloadUrl, {
          responseType: 'stream',
          timeout: 120000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }).catch(() => null);

        if (!dlResp?.data) {
          return socket.sendMessage(sender, {
            text: `꒰ᵎ ❌ *Error* ᵎ꒱\n\n⚠️ Download failed!\n\n*${botName}* 🖤`
          }, { quoted: collected });
        }

        await new Promise((resolve, reject) => {
          const writer = fs.createWriteStream(tmpMp3);
          dlResp.data.pipe(writer);
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        try {
          const tagText  = `Powered by ${botName}`;
          const sTagUrl  = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(tagText)}&tl=en&client=tw-ob`;
          const tagResp  = await axios.get(sTagUrl, { responseType: 'stream' }).catch(() => null);
          if (tagResp) {
            await new Promise((resolve) => {
              const writer = fs.createWriteStream(tmpTag);
              tagResp.data.pipe(writer);
              writer.on('finish', resolve);
              writer.on('error', () => resolve());
            });
          }
        } catch (e) {}

        const mixWithWatermark = (inputFile, outputFile, format, codec) => {
          return new Promise((resolve, reject) => {
            let ff = ffmpeg(inputFile).noVideo();
            if (fs.existsSync(tmpTag)) {
              ff.input(tmpTag).complexFilter([
                '[1:a]adelay=1000|1000,volume=2.0[tag]',
                '[0:a][tag]amix=inputs=2:duration=first'
              ]);
            }
            ff.audioCodec(codec)
              .format(format)
              .on('end', resolve)
              .on('error', reject)
              .save(outputFile);
          });
        };

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
          await mixWithWatermark(tmpMp3, tmpOut, 'mp3', 'libmp3lame');
          const buf = fs.readFileSync(tmpOut);
          await socket.sendMessage(sender, {
            audio: buf,
            mimetype: 'audio/mpeg',
            fileName: `${sTitle}.mp3`,
            ptt: false,
            contextInfo: nlCtx
          }, { quoted: collected });

        } else if (choice === '2') {
          await mixWithWatermark(tmpMp3, tmpOpus, 'opus', 'libopus');
          const buf = fs.readFileSync(tmpOpus);
          await socket.sendMessage(sender, {
            audio: buf,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            contextInfo: nlCtx
          }, { quoted: collected });

        } else if (choice === '3') {
          await mixWithWatermark(tmpMp3, tmpOut, 'mp3', 'libmp3lame');
          const buf = fs.readFileSync(tmpOut);
          await socket.sendMessage(sender, {
            document: buf,
            mimetype: 'audio/mpeg',
            fileName: `${sTitle}.mp3`,
            contextInfo: nlCtx
          }, { quoted: collected });
        }

        await socket.sendMessage(sender, {
          react: { text: '🎵', key: msg.key }
        });

      } finally {
        [tmpMp3, tmpTag, tmpOpus, tmpOut].forEach(f => {
          try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {}
        });
      }

  }
};
