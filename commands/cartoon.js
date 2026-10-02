// Command: cartoon (aliases: ct, sinhala)
// Auto-extracted from sakura.js switch-case during commandLoader refactor.
module.exports = {
  name: 'cartoon',
  aliases: ['ct', 'sinhala'],
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

      const CARTOON_API = "https://cartoon-scrap.vercel.app";
      const LIST_BANNER = cfg.logo || config.IMAGE_PATH;
      const NEWSLETTER = {
        newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid,
        newsletterName: botName,
        serverMessageId: 143
      };

      const res = await axios.get(`${CARTOON_API}/api/new?limit=10`, { timeout: 30000 });
      if (!res.data.success) return reply("❌ Failed to load cartoon list!");

      const cartoons = res.data.data.slice(0, 10);

      let listText = `🎬 *${botName}*\n\n`;
      listText += `📺 *Latest Sinhala Cartoons - Top 10*\n`;
      listText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      cartoons.forEach((c, i) => {
        listText += `*${i + 1}. ${c.title}*\n`;
      });
      listText += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      listText += `_Reply with a number (1-10) to select_ ⬆️`;

      const sentMsg = await socket.sendMessage(sender, {
        image: { url: LIST_BANNER },
        caption: listText,
        contextInfo: {
          forwardingScore: 1000,
          isForwarded: true,
          forwardedNewsletterMessageInfo: NEWSLETTER
        }
      }, { quoted: msg });

      const messageID = sentMsg.key.id;

      global.cartoonSessions = global.cartoonSessions || {};
      global.cartoonSessions[messageID] = {
        cartoons,
        from: sender,
        expiry: Date.now() + 5 * 60 * 1000
      };

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
            if (isNaN(num) || num < 1 || num > 10) {
              await socket.sendMessage(sender, {
                text: `❌ Invalid! Reply with a number between 1 and 10.`
              }, { quoted: replyMsg });
              continue;
            }

            const session = global.cartoonSessions[messageID];
            if (!session) {
              await socket.sendMessage(sender, {
                text: `❌ Session expired! Use *${prefix}cartoon* again.`
              }, { quoted: replyMsg });
              socket.ev.off('messages.upsert', replyListener);
              return;
            }

            const selected = session.cartoons[num - 1];
            socket.ev.off('messages.upsert', replyListener);
            delete global.cartoonSessions[messageID];

            await socket.sendMessage(sender, {
              text: `🔍 *Loading details...*\n\n*${selected.title}*\n\nPlease wait...`
            }, { quoted: replyMsg });

            const detailRes = await axios.get(`${CARTOON_API}/api/details?id=${selected.id}`, { timeout: 30000 });
            if (!detailRes.data.success) {
              return await socket.sendMessage(sender, {
                text: `❌ Failed to load details!`
              }, { quoted: replyMsg });
            }

            const cartoon = detailRes.data.data;
            const directLink = cartoon.download_links.find(l => l.type === 'direct');
            const telegramLink = cartoon.download_links.find(l => l.type === 'telegram');

            const detailText =
              `🎬 *${botName}*\n\n` +
              `📌 *${cartoon.title}*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n\n` +
              `📖 *Story:*\n${cartoon.description?.substring(0, 300)}${cartoon.description?.length > 300 ? '...' : ''}\n\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `📥 *Select a download option:*\n\n` +
              `*1 - 📄 Direct Download (MP4 File)*\n` +
              `*2 - 📱 Telegram Bot Link*\n\n` +
              `_Reply with 1 or 2_ ⬆️`;

            const detailMsg = await socket.sendMessage(sender, {
              image: { url: cartoon.banner },
              caption: detailText,
              contextInfo: {
                forwardingScore: 1000,
                isForwarded: true,
                forwardedNewsletterMessageInfo: NEWSLETTER
              }
            }, { quoted: replyMsg });

            const detailMsgID = detailMsg.key.id;

            global.cartoonDownloads = global.cartoonDownloads || {};
            global.cartoonDownloads[detailMsgID] = {
              cartoon,
              directLink,
              telegramLink,
              from: sender,
              expiry: Date.now() + 5 * 60 * 1000
            };

            const downloadListener = async (upsert2) => {
              try {
                for (const dlMsg of (upsert2?.messages || [])) {
                  if (!dlMsg?.message) continue;
                  if (resolveReplyJid(dlMsg) !== sender) continue;

                  const dlQuotedId = dlMsg.message?.extendedTextMessage?.contextInfo?.stanzaId;
                  if (dlQuotedId !== detailMsgID) continue;

                  const dlChoice = (
                    dlMsg.message?.extendedTextMessage?.text ||
                    dlMsg.message?.conversation || ''
                  ).trim();

                  if (!['1', '2'].includes(dlChoice)) {
                    await socket.sendMessage(sender, {
                      text: `❌ Invalid! Reply with *1* or *2* only.`
                    }, { quoted: dlMsg });
                    continue;
                  }

                  const dlData = global.cartoonDownloads[detailMsgID];
                  if (!dlData) {
                    await socket.sendMessage(sender, {
                      text: `❌ Session expired! Use *${prefix}cartoon* again.`
                    }, { quoted: dlMsg });
                    socket.ev.off('messages.upsert', downloadListener);
                    return;
                  }

                  socket.ev.off('messages.upsert', downloadListener);
                  delete global.cartoonDownloads[detailMsgID];

                  if (dlChoice === '2') {
                    const tgLink = dlData.telegramLink?.direct_url || dlData.cartoon.link;
                    await socket.sendMessage(sender, {
                      text:
                        `📱 *Telegram Download Link*\n\n` +
                        `🎬 *${dlData.cartoon.title}*\n\n` +
                        `🔗 ${tgLink}\n\n` +
                        `_Click the link and download from the bot!_`,
                      contextInfo: {
                        forwardingScore: 1000,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: NEWSLETTER
                      }
                    }, { quoted: dlMsg });

                  } else {
                    if (!dlData.directLink) {
                      return await socket.sendMessage(sender, {
                        text: `❌ Direct download link not available!\nTry option *2* (Telegram) instead.`
                      }, { quoted: dlMsg });
                    }

                    await socket.sendMessage(sender, {
                      text: `⬇️ *Sending file...*\n\n🎬 *${dlData.cartoon.title}*\n\nPlease wait...`
                    }, { quoted: dlMsg });

                    await socket.sendMessage(sender, {
                      document: { url: dlData.directLink.direct_url },
                      mimetype: 'video/mp4',
                      fileName: `${dlData.cartoon.title}.mp4`,
                      caption:
                        `🎬 *${dlData.cartoon.title}*\n\n` +
                        `_Powered by ${botName}_ 🖤`,
                      contextInfo: {
                        forwardingScore: 1000,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: NEWSLETTER
                      }
                    }, { quoted: dlMsg });

                    await socket.sendMessage(sender, {
                      react: { text: '✅', key: msg.key }
                    });
                  }
                }
              } catch (err) {
                console.error('Cartoon download error:', err);
                await socket.sendMessage(sender, {
                  text: `❌ Download failed!\n\n${err.message}\n\nTry option *2* (Telegram) instead.`
                });
              }
            };

            socket.ev.on('messages.upsert', downloadListener);
            setTimeout(() => {
              socket.ev.off('messages.upsert', downloadListener);
              delete global.cartoonDownloads?.[detailMsgID];
            }, 5 * 60 * 1000);
          }
        } catch (err) {
          console.error('Cartoon selection error:', err);
          await socket.sendMessage(sender, { text: `❌ Error: ${err.message}` });
        }
      };

      socket.ev.on('messages.upsert', replyListener);
      setTimeout(() => {
        socket.ev.off('messages.upsert', replyListener);
        delete global.cartoonSessions?.[messageID];
      }, 5 * 60 * 1000);

  }
};
