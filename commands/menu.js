// Command: menu (aliases help, allmenu)
// Auto-extracted and updated with correct Group Manage and AI System sub-menus.
// Updated: Pairing site link added beautifully at the bottom of menu
module.exports = {
  name: 'menu',
  aliases: ['help', 'allmenu'],
  async execute(ctx) {
    const {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT, resolveReplyJid, downloadQuotedMedia,
      getSriLankaTimestamp, formatMessage, fs, path, os
    } = ctx;

      const sanitized = (number || '').replace(/[^0-9]/g, '');
      const cfg = sessionConfig || {};
      const botName = cfg.botName || BOT_NAME_FANCY;
      const logo    = cfg.logo    || config.IMAGE_PATH;

      // 🔗 Pairing Site Link
      const PAIRING_SITE = '/miyora-mini.site';

      const channelContext = {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: NEWSLETTER_CONTEXT?.forwardedNewsletterMessageInfo?.newsletterJid || '',
          newsletterName: botName,
          serverMessageId: 999,
        }
      };

      const menuCaption =
        `🌸⃝⃘̉̉̉̉̉̉🧚‍♀️ *${botName} 𝐌𝐄𝐍𝐔* 🧚‍♀️🌸⃝⃘̉̉̉̉̉̉\n\n` +
        `┊ ┊ ✫ ˚♡ ⋆｡❀\n` +
        `┊ ☪︎⋆\n\n` +
        `> 💌 *ᴡᴇʟᴄᴏᴍᴇ ᴅᴀʀʟɪɴɢ, ᴘɪᴄᴋ ᴀ ᴄᴀᴛᴇɢᴏʀʏ~*\n\n` +
        `❍ 1┊ ❮ *📋 ᴍᴀɪɴ ᴍᴇɴᴜ* ❯\n` +
        `❍ 2┊ ❮ *📥 ᴅᴏᴡɴʟᴏᴀᴅ ᴍᴇɴᴜ* ❯\n` +
        `❍ 3┊ ❮ *👑 ᴏᴡɴᴇʀ ᴍᴇɴᴜ* ❯\n` +
        `❍ 4┊ ❮ *👥 ɢʀᴏᴜᴘ ᴍᴀɴᴀɢᴇ ᴍᴇɴᴜ* ❯\n` +
        `❍ 5┊ ❮ *🤖 ᴀɪ sʏsᴛᴇᴍ* ❯\n` +
        `❍ 6┊ ❮ *🌙 ᴏᴛʜᴇʀ ᴍᴇɴᴜ* ❯\n\n` +
        `* \`📩 Reply To Number (1-6)\`\n\n` +
        `╭─────────────────╮\n` +
        `   🔗 *ᴘᴀɪʀɪɴɢ ꜱɪᴛᴇ* 🔗\n` +
        `╰─────────────────╯\n` +
        `   ➥ ${PAIRING_SITE}\n\n` +
        `🧚‍♀️ *©ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*\n\n` +
        `*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`;

      try {
        await socket.sendMessage(sender, {
          react: { text: '🌸', key: msg.key }
        });
      } catch (e) {}

      let menuMsg;
      try {
        if (String(logo).startsWith('http')) {
          menuMsg = await socket.sendMessage(sender, {
            image: { url: logo },
            caption: menuCaption,
            contextInfo: channelContext
          }, { quoted: msg });
        } else {
          try {
            const buf = fs.readFileSync(logo);
            menuMsg = await socket.sendMessage(sender, {
              image: buf,
              caption: menuCaption,
              contextInfo: channelContext
            }, { quoted: msg });
          } catch (_e) {
            menuMsg = await socket.sendMessage(sender, {
              image: { url: config.IMAGE_PATH },
              caption: menuCaption,
              contextInfo: channelContext
            }, { quoted: msg });
          }
        }
      } catch (e) {
        menuMsg = await socket.sendMessage(sender, {
          text: menuCaption,
          contextInfo: channelContext
        }, { quoted: msg });
      }

      const subMenus = {
        '1': {
          title: '📋 ᴍᴀɪɴ ᴍᴇɴᴜ',
          body:
            `❍ *${prefix}menu* ┊ Show this cute menu\n` +
            `❍ *${prefix}alive* ┊ Check bot status\n` +
            `❍ *${prefix}ping* ┊ Check bot speed`
        },
        '2': {
          title: '📥 ᴅᴏᴡɴʟᴏᴀᴅ ᴍᴇɴᴜ',
          body:
            `❍ *${prefix}song* ┊ Download a YouTube song\n` +
            `❍ *${prefix}movie* ┊ Download Sinhala sub movie\n` +
            `❍ *${prefix}cartoon* ┊ Download Sinhala cartoon\n` +
            `❍ *${prefix}anime* ┊ Download anime\n` +
            `❍ *${prefix}tiktok* ┊ Download TikTok video\n` +
            `❍ *${prefix}fb* ┊ Download Facebook video\n` +
            `❍ *${prefix}ig* ┊ Download Instagram media`
        },
        '3': {
          title: '👑 ᴏᴡɴᴇʀ ᴍᴇɴᴜ',
          body:
            `❍ *${prefix}owner* ┊ Get owner contact card`
        },
        '4': {
          title: '👥 ɢʀᴏᴜᴘ ᴍᴀɴᴀɢᴇ ᴍᴇɴᴜ',
          body:
            `❍ *${prefix}grup open* 🔓 ┊ Open group for everyone\n` +
            `❍ *${prefix}grup close* 🔒 ┊ Close group for admins\n` +
            `❍ *${prefix}grup name* ✏️ ┊ Change group name\n` +
            `❍ *${prefix}grup desc* 📝 ┊ Change group description\n` +
            `❍ *${prefix}grup lock* 📌 ┊ Lock group settings\n` +
            `❍ *${prefix}grup unlock* 🔓 ┊ Unlock group settings\n` +
            `❍ *${prefix}grup add* ➕ ┊ Add a member by number\n` +
            `❍ *${prefix}grup kick* 👢 ┊ Remove quoted/mentioned user\n` +
            `❍ *${prefix}grup promote* 👑 ┊ Promote user to admin\n` +
            `❍ *${prefix}grup demote* 🔻 ┊ Demote admin from user\n` +
            `❍ *${prefix}grup tagall* 🏷️ ┊ Tag all group members\n` +
            `❍ *${prefix}grup antilink* 🛡️ ┊ Toggle auto-delete links\n` +
            `❍ *${prefix}grup antistatus* 🛡️ ┊ Toggle status/promo links`
        },
        '5': {
          title: '🤖 ᴀɪ sʏsᴛᴇᴍ',
          body:
            `❍ *${prefix}ai* ┊ Chat with AI assistant\n` +
            `❍ *${prefix}gpt* ┊ Ask from ChatGPT AI\n` +
            `❍ *${prefix}gemini* ┊ Ask from Google Gemini AI\n` +
            `❍ *${prefix}imagine* ┊ Generate AI image\n` +
            `📌 *Example:* ${prefix}ai What is quantum physics?`
        },
        '6': {
          title: '🌙 ᴏᴛʜᴇʀ ᴍᴇɴᴜ',
          body:
            `❍ *${prefix}vv* ┊ Unlock view-once media\n` +
            `❍ *${prefix}send* ┊ Send media by url/reply\n` +
            `❍ *${prefix}getpp* ┊ Get a user's profile picture`
        }
      };

      const menuListener = async (msgUpdate) => {
        const reply2 = msgUpdate.messages[0];
        if (!reply2 || !reply2.message) return;

        const isReplyToMenu = reply2.message?.extendedTextMessage?.contextInfo?.stanzaId === menuMsg.key.id;
        const isSame = resolveReplyJid(reply2) === sender;
        if (!isReplyToMenu || !isSame) return;

        const text = (reply2.message?.conversation || reply2.message?.extendedTextMessage?.text || '').trim();
        if (!['1', '2', '3', '4', '5', '6'].includes(text)) return;

        socket.ev.off('messages.upsert', menuListener);

        try {
          await socket.sendMessage(sender, { react: { text: '✨', key: reply2.key } });
        } catch (e) {}

        const chosen = subMenus[text];

        const subCaption =
          `🌸⃝⃘̉̉̉̉̉̉🧚‍♀️ *${chosen.title}* 🧚‍♀️🌸⃝⃘̉̉̉̉̉̉\n\n` +
          `┊ ┊ ✫ ˚♡ ⋆｡❀\n\n` +
          `${chosen.body}\n\n` +
          `╭─────────────────╮\n` +
          `   🔗 *ᴘᴀɪʀɪɴɢ ꜱɪᴛᴇ* 🔗\n` +
          `╰─────────────────╯\n` +
          `   ➥ ${PAIRING_SITE}\n\n` +
          `🧚‍♀️ *©ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*\n\n` +
          `*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`;

        try {
          if (String(logo).startsWith('http')) {
            await socket.sendMessage(sender, {
              image: { url: logo },
              caption: subCaption,
              contextInfo: channelContext
            }, { quoted: reply2 });
          } else {
            try {
              const buf = fs.readFileSync(logo);
              await socket.sendMessage(sender, {
                image: buf,
                caption: subCaption,
                contextInfo: channelContext
              }, { quoted: reply2 });
            } catch (_e) {
              await socket.sendMessage(sender, {
                image: { url: config.IMAGE_PATH },
                caption: subCaption,
                contextInfo: channelContext
              }, { quoted: reply2 });
            }
          }
        } catch (e) {
          await socket.sendMessage(sender, {
            text: subCaption,
            contextInfo: channelContext
          }, { quoted: reply2 });
        }
      };

      socket.ev.on('messages.upsert', menuListener);

      setTimeout(() => {
        try {
          socket.ev.off('messages.upsert', menuListener);
        } catch (e) {}
      }, 60000);

  }
};  
