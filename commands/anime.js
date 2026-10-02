// Command: anime (aliases: animeclub, ani)
// Auto-extracted from sakura.js switch-case during commandLoader refactor.
module.exports = {
  name: 'anime',
  aliases: ['animeclub', 'ani'],
  async execute(ctx) {
    const {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT, resolveReplyJid, downloadQuotedMedia,
      getSriLankaTimestamp, formatMessage, fs, path, os
    } = ctx;

      const axios = require('axios');

      const cfg = sessionConfig;
      const botName = cfg.botName || BOT_NAME_FANCY;

      if (!q || q.trim() === '') {
        return reply(`❌ *Please provide an anime/movie name!*\n\nExample: *${prefix}anime Chainsaw Man*`);
      }

      const ANIME_API = "https://anime-123-d0698a5e061a.herokuapp.com";
      const FALLBACK_BANNER = cfg.logo || config.IMAGE_PATH;
      const NEWSLETTER = {
        newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid,
        newsletterName: botName,
        serverMessageId: 143
      };

      const EPISODES_PER_PAGE = 10;

      // ---------- helper: send a server/link list for a movie OR a single episode ----------
      async function sendServerList({ contextUrl, title, poster, quotedMsg, extraInfo }) {
        const { data: dreclink } = await axios.get(
          `${ANIME_API}/api/dreclink?url=${encodeURIComponent(contextUrl)}`,
          { timeout: 60000 }
        );

        const servers = dreclink?.servers || [];
        if (!servers.length) {
          await socket.sendMessage(sender, {
            text: `❌ *${title}*\n\nNo download/watch links found. Please try again later.`
          }, { quoted: quotedMsg });
          return null;
        }

        let text = `🎬 *${botName}*\n\n📌 *${title}*\n`;
        if (extraInfo) text += extraInfo;
        text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        text += `📥 *Select a server to get the link:*\n\n`;
        servers.forEach((s, i) => {
          text += `*${i + 1} -* 🌐 ${s.server}\n`;
        });
        text += `\n_Reply with the number_ ⬆️`;

        const sentMsg = await socket.sendMessage(sender, {
          image: { url: poster || FALLBACK_BANNER },
          caption: text,
          contextInfo: {
            forwardingScore: 1000,
            isForwarded: true,
            forwardedNewsletterMessageInfo: NEWSLETTER
          }
        }, { quoted: quotedMsg });

        return { sentMsg, servers };
      }

      // ---------- helper: attach a listener that waits for a server number reply, then SENDS THE FILE ----------
      function attachServerListener(msgId, servers, title) {
        global.animeServerSessions = global.animeServerSessions || {};
        global.animeServerSessions[msgId] = { servers, title, from: sender, expiry: Date.now() + 5 * 60 * 1000 };

        const BLOCKED_HOSTS = ['cdn.sinhalasub.net', 'filespayouts.com', 'ddl.sinhalasub.net'];

        const listener = async (upsert) => {
          try {
            for (const m of (upsert?.messages || [])) {
              if (!m?.message) continue;
              if (resolveReplyJid(m) !== sender) continue;

              const quotedId = m.message?.extendedTextMessage?.contextInfo?.stanzaId;
              if (quotedId !== msgId) continue;

              const text = (
                m.message?.extendedTextMessage?.text ||
                m.message?.conversation || ''
              ).trim();

              const session = global.animeServerSessions[msgId];
              if (!session) {
                await socket.sendMessage(sender, { text: `❌ Session expired! Use *${prefix}anime* again.` }, { quoted: m });
                socket.ev.off('messages.upsert', listener);
                return;
              }

              const num = parseInt(text);
              if (isNaN(num) || num < 1 || num > session.servers.length) {
                await socket.sendMessage(sender, {
                  text: `❌ Invalid! Reply with a number between 1 and ${session.servers.length}.`
                }, { quoted: m });
                continue;
              }

              socket.ev.off('messages.upsert', listener);
              delete global.animeServerSessions[msgId];

              const chosen = session.servers[num - 1];
              const host = (chosen.host || chosen.server || '').toLowerCase();

              if (BLOCKED_HOSTS.some(b => host.includes(b))) {
                await socket.sendMessage(sender, {
                  text: `❌ *${session.title}*\n\nThis server's link can't be sent as a direct file.\n\n🔗 *Link:* ${chosen.link}\n\n_Open the link above in your browser to watch/download._`
                }, { quoted: m });
                continue;
              }

              await socket.sendMessage(sender, {
                text: `⬇️ *Sending file...*\n\n🎬 *${session.title}*\n🌐 *Server:* ${chosen.server}\n\nPlease wait, this may take a moment...`
              }, { quoted: m });

              const safeFileName = `${session.title.replace(/[\\/:*?"<>|]/g, '')}.mp4`;
              const doneCaption =
                `🎬 *${session.title}*\n` +
                `🌐 *Server:* ${chosen.server}\n\n` +
                `_Powered by ${botName}_ 🖤`;

              try {
                await socket.sendMessage(sender, {
                  document: { url: chosen.link },
                  mimetype: 'video/mp4',
                  fileName: safeFileName,
                  caption: doneCaption,
                  contextInfo: {
                    forwardingScore: 1000,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: NEWSLETTER
                  }
                }, { quoted: m });

                await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
              } catch (sendErr) {
                console.error('Anime file send error:', sendErr);
                await socket.sendMessage(sender, {
                  text: `❌ Something went wrong while sending the file!\n\n${sendErr.message}\n\n🔗 *Direct link:* ${chosen.link}\n\nPlease try a different server.`
                }, { quoted: m });
              }
            }
          } catch (err) {
            console.error('Anime server select error:', err);
            await socket.sendMessage(sender, { text: `❌ Error: ${err.message}` });
          }
        };

        socket.ev.on('messages.upsert', listener);
        setTimeout(() => {
          socket.ev.off('messages.upsert', listener);
          delete global.animeServerSessions?.[msgId];
        }, 5 * 60 * 1000);
      }

      // ---------- helper: send one page of episodes (tvshow) + attach listener ----------
      async function sendEpisodePage({ allEpisodes, offset, tvTitle, poster, quotedMsg }) {
        const page = allEpisodes.slice(offset, offset + EPISODES_PER_PAGE);
        const hasMore = offset + EPISODES_PER_PAGE < allEpisodes.length;

        let text = `🎬 *${botName}*\n\n📺 *${tvTitle}*\n`;
        text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        page.forEach((ep, i) => {
          text += `*${i + 1}.* S${ep.season} E${ep.episodeNumber} - ${ep.episodeTitle}\n`;
        });
        text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        text += `_Reply with a number (1-${page.length}) to get that episode's links_\n`;
        if (hasMore) {
          text += `_Reply *0* to see the next ${Math.min(EPISODES_PER_PAGE, allEpisodes.length - offset - EPISODES_PER_PAGE)} episodes_ ⬆️`;
        } else {
          text += `_This is the last page - no more episodes_ ⬆️`;
        }

        const sentMsg = await socket.sendMessage(sender, {
          image: { url: poster || FALLBACK_BANNER },
          caption: text,
          contextInfo: {
            forwardingScore: 1000,
            isForwarded: true,
            forwardedNewsletterMessageInfo: NEWSLETTER
          }
        }, { quoted: quotedMsg });

        const msgId = sentMsg.key.id;

        global.animeEpisodeSessions = global.animeEpisodeSessions || {};
        global.animeEpisodeSessions[msgId] = {
          allEpisodes, offset, tvTitle, poster, from: sender, expiry: Date.now() + 5 * 60 * 1000
        };

        const listener = async (upsert) => {
          try {
            for (const m of (upsert?.messages || [])) {
              if (!m?.message) continue;
              if (resolveReplyJid(m) !== sender) continue;

              const quotedId = m.message?.extendedTextMessage?.contextInfo?.stanzaId;
              if (quotedId !== msgId) continue;

              const replyText = (
                m.message?.extendedTextMessage?.text ||
                m.message?.conversation || ''
              ).trim();

              const session = global.animeEpisodeSessions[msgId];
              if (!session) {
                await socket.sendMessage(sender, { text: `❌ Session expired! Use *${prefix}anime* again.` }, { quoted: m });
                socket.ev.off('messages.upsert', listener);
                return;
              }

              const choice = parseInt(replyText);

              // "0" -> next page
              if (choice === 0) {
                const nextOffset = session.offset + EPISODES_PER_PAGE;
                if (nextOffset >= session.allEpisodes.length) {
                  await socket.sendMessage(sender, {
                    text: `❌ No more episodes, this is already the last page.`
                  }, { quoted: m });
                  continue;
                }
                socket.ev.off('messages.upsert', listener);
                delete global.animeEpisodeSessions[msgId];
                await sendEpisodePage({
                  allEpisodes: session.allEpisodes,
                  offset: nextOffset,
                  tvTitle: session.tvTitle,
                  poster: session.poster,
                  quotedMsg: m
                });
                return;
              }

              const pageEpisodes = session.allEpisodes.slice(session.offset, session.offset + EPISODES_PER_PAGE);
              if (isNaN(choice) || choice < 1 || choice > pageEpisodes.length) {
                await socket.sendMessage(sender, {
                  text: `❌ Invalid! Reply with a number between 1 and ${pageEpisodes.length}, or 0 for the next page.`
                }, { quoted: m });
                continue;
              }

              socket.ev.off('messages.upsert', listener);
              delete global.animeEpisodeSessions[msgId];

              const ep = pageEpisodes[choice - 1];
              await socket.sendMessage(sender, {
                text: `🔍 *Loading links...*\n\n*S${ep.season} E${ep.episodeNumber} - ${ep.episodeTitle}*\n\nPlease wait...`
              }, { quoted: m });

              try {
                const result = await sendServerList({
                  contextUrl: ep.episodeUrl,
                  title: `${session.tvTitle} - S${ep.season}E${ep.episodeNumber} - ${ep.episodeTitle}`,
                  poster: session.poster,
                  quotedMsg: m
                });
                if (result) attachServerListener(result.sentMsg.key.id, result.servers, session.tvTitle);
              } catch (err) {
                console.error('Anime episode link error:', err);
                await socket.sendMessage(sender, { text: `❌ Error: ${err.message}` }, { quoted: m });
              }
            }
          } catch (err) {
            console.error('Anime episode page error:', err);
            await socket.sendMessage(sender, { text: `❌ Error: ${err.message}` });
          }
        };

        socket.ev.on('messages.upsert', listener);
        setTimeout(() => {
          socket.ev.off('messages.upsert', listener);
          delete global.animeEpisodeSessions?.[msgId];
        }, 5 * 60 * 1000);
      }

      // ---------- main: search ----------
      const { data: searchRes } = await axios.get(
        `${ANIME_API}/api/name?q=${encodeURIComponent(q.trim())}`,
        { timeout: 30000 }
      );

      if (!searchRes?.count) {
        return reply(`❌ *"${q}"* not found!\n\nPlease try a different keyword.`);
      }

      const items = searchRes.results.slice(0, 10);

      let listText = `🎬 *${botName}*\n\n`;
      listText += `🔍 *Search Results:* ${q}\n`;
      listText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      items.forEach((it, i) => {
        const tag = it.type === 'movie' ? '🎞️ Movie' : '📺 TV';
        listText += `*${i + 1}.* ${it.title}\n     ${tag} | ${it.year || 'N/A'}\n`;
      });
      listText += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      listText += `_Reply with a number (1-${items.length}) to select_ ⬆️`;

      const listBanner = items[0]?.poster || FALLBACK_BANNER;

      const sentMsg = await socket.sendMessage(sender, {
        image: { url: listBanner },
        caption: listText,
        contextInfo: {
          forwardingScore: 1000,
          isForwarded: true,
          forwardedNewsletterMessageInfo: NEWSLETTER
        }
      }, { quoted: msg });

      const messageID = sentMsg.key.id;

      global.animeSessions = global.animeSessions || {};
      global.animeSessions[messageID] = { items, from: sender, expiry: Date.now() + 5 * 60 * 1000 };

      const replyListener = async (upsert) => {
        try {
          for (const replyMsg of (upsert?.messages || [])) {
            if (!replyMsg?.message) continue;
            if (resolveReplyJid(replyMsg) !== sender) continue;

            const quotedId = replyMsg.message?.extendedTextMessage?.contextInfo?.stanzaId;
            if (quotedId !== messageID) continue;

            const replyText = (
              replyMsg.message?.extendedTextMessage?.text ||
              replyMsg.message?.conversation || ''
            ).trim();

            const num = parseInt(replyText);
            const session = global.animeSessions[messageID];

            if (!session) {
              await socket.sendMessage(sender, {
                text: `❌ Session expired! Use *${prefix}anime* again.`
              }, { quoted: replyMsg });
              socket.ev.off('messages.upsert', replyListener);
              return;
            }

            if (isNaN(num) || num < 1 || num > session.items.length) {
              await socket.sendMessage(sender, {
                text: `❌ Invalid! Reply with a number between 1 and ${session.items.length}.`
              }, { quoted: replyMsg });
              continue;
            }

            const selected = session.items[num - 1];
            socket.ev.off('messages.upsert', replyListener);
            delete global.animeSessions[messageID];

            await socket.sendMessage(sender, {
              text: `🔍 *Loading details...*\n\n*${selected.title}*\n\nPlease wait...`
            }, { quoted: replyMsg });

            try {
              if (selected.type === 'movie') {
                // ---- MOVIE FLOW ----
                const { data: about } = await axios.get(
                  `${ANIME_API}/api/about?url=${encodeURIComponent(selected.url)}`,
                  { timeout: 30000 }
                );

                let extraInfo = '';
                if (about?.year) extraInfo += `📅 *Year:* ${about.year}\n`;
                if (about?.genres?.length) extraInfo += `🎭 *Genre:* ${about.genres.join(', ')}\n`;
                if (about?.rating) extraInfo += `⭐ *Rating:* ${about.rating}\n`;
                if (about?.synopsis) {
                  const desc = about.synopsis;
                  extraInfo += `📖 *About:*\n${desc.substring(0, 300)}${desc.length > 300 ? '...' : ''}\n`;
                }
                extraInfo += `\n`;

                const result = await sendServerList({
                  contextUrl: selected.url,
                  title: selected.title,
                  poster: about?.poster || selected.poster,
                  quotedMsg: replyMsg,
                  extraInfo
                });
                if (result) attachServerListener(result.sentMsg.key.id, result.servers, selected.title);

              } else {
                // ---- TVSHOW FLOW ----
                const { data: about } = await axios.get(
                  `${ANIME_API}/api/about?url=${encodeURIComponent(selected.url)}`,
                  { timeout: 30000 }
                );

                const allEpisodes = [];
                (about?.seasons || []).forEach((season) => {
                  season.episodes.forEach((ep) => {
                    allEpisodes.push({ season: season.season, ...ep });
                  });
                });

                if (!allEpisodes.length) {
                  await socket.sendMessage(sender, {
                    text: `❌ *${selected.title}*\n\nNo episodes found.`
                  }, { quoted: replyMsg });
                  continue;
                }

                await sendEpisodePage({
                  allEpisodes,
                  offset: 0,
                  tvTitle: selected.title,
                  poster: about?.poster || selected.poster,
                  quotedMsg: replyMsg
                });
              }
            } catch (err) {
              console.error('Anime selection error:', err);
              await socket.sendMessage(sender, { text: `❌ Error: ${err.message}` }, { quoted: replyMsg });
            }
          }
        } catch (err) {
          console.error('Anime search selection error:', err);
          await socket.sendMessage(sender, { text: `❌ Error: ${err.message}` });
        }
      };

      socket.ev.on('messages.upsert', replyListener);
      setTimeout(() => {
        socket.ev.off('messages.upsert', replyListener);
        delete global.animeSessions?.[messageID];
      }, 5 * 60 * 1000);

  }
};
