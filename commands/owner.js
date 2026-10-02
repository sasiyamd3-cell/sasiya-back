// Command: owner
// Owner menu + owner utilities
// MIYORA MD

module.exports = {
  name: 'owner',
  aliases: ['ownermenu'],

  async execute(ctx) {
    const {
      socket,
      msg,
      sender,
      from,
      args,
      q,
      reply,
      sessionConfig,
      prefix,
      config,
      BOT_NAME_FANCY,
      resolveReplyJid
    } = ctx;

    const cfg = sessionConfig || {};

    const botName = cfg.botName || BOT_NAME_FANCY || '𝐌𝐈𝐘𝐎𝐑𝐀 𝐌𝐃';
    const logo = cfg.logo || config.IMAGE_PATH;

    const ownerName =
      cfg.ownerName ||
      config.OWNER_NAME ||
      'SASIND';

    const ownerNumber =
      String(
        cfg.ownerNumber ||
        config.OWNER_NUMBER ||
        '94767475809'
      ).replace(/[^0-9]/g, '');

    // =========================================================
    // 👑 OWNER MENU
    // =========================================================

    const menu = `
🌸⃝⃘̉̉̉̉̉̉🧚‍♀️ *👑 ᴏᴡɴᴇʀ ᴍᴇɴᴜ* 🧚‍♀️🌸⃝⃘̉̉̉̉̉̉

┊ ┊ ✫ ˚♡ ⋆｡❀

❍ 👑 ᴏᴡɴᴇʀ ᴄᴏɴᴛʀᴏʟ
❍ *${prefix}owner* ┊ Owner contact
❍ *${prefix}restart* ┊ Restart bot
❍ *${prefix}shutdown* ┊ Stop bot
❍ *${prefix}update* ┊ Update bot

❍ 🛠️ ʙᴏᴛ ᴛᴏᴏʟꜱ
❍ *${prefix}broadcast* ┊ Broadcast message
❍ *${prefix}bc* ┊ Broadcast message
❍ *${prefix}block* ┊ Block user
❍ *${prefix}unblock* ┊ Unblock user

❍ 📊 ʙᴏᴛ ɪɴꜰᴏ
❍ *${prefix}status* ┊ Bot status
❍ *${prefix}runtime* ┊ Bot uptime
❍ *${prefix}system* ┊ System information
❍ *${prefix}speed* ┊ Response speed

┊ ┊ ✫ ˚♡ ⋆｡❀

🧚‍♀️ ©ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐁𝐥𝐚𝐜𝐤 𝐂ᴀᴛ 𝐎ꜰᴄ

*𝐌𝐈𝐘𝐎𝐑𝐀 𝐌𝐃* 🖤 | *𝐁ʟᴀᴄ𝐤 𝐂ᴀᴛ 𝐎ꜰᴄ*
`;

    // =========================================================
    // 👑 OWNER CONTACT
    // =========================================================

    const ownerMessage = `
••━━━━〔 🖤 ${botName} 〕━━━━••

╭━━━━〔 👑 𝐎𝐖𝐍𝐄𝐑 〕━━━━╮
┃
┃ 🖤 *𝐍𝐚𝐦𝐞*     : ${ownerName}
┃ 👑 *𝐑𝐨𝐥𝐞*     : 𝐎𝐰𝐧𝐞𝐫
┃ 📞 *𝐍𝐮𝐦𝐛𝐞𝐫*  : ${ownerNumber}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯

> © ${ownerName}
`;

    // =========================================================
    // 📌 SUB COMMAND
    // =========================================================

    const subCommand = String(args?.[0] || '').toLowerCase();

    // ---------------------------------------------------------
    // .owner contact
    // ---------------------------------------------------------

    if (
      subCommand === 'contact' ||
      subCommand === 'number' ||
      subCommand === 'info'
    ) {
      return sendOwnerContact();
    }

    // ---------------------------------------------------------
    // Default = Owner Menu
    // ---------------------------------------------------------

    if (!subCommand) {
      await sendImage(menu);
      return;
    }

    // =========================================================
    // 🔐 OWNER CHECK
    // =========================================================

    const senderNumber = String(sender || '')
      .replace(/[^0-9]/g, '');

    const cleanOwner = ownerNumber.replace(/[^0-9]/g, '');

    const isOwner =
      senderNumber.endsWith(cleanOwner) ||
      cleanOwner.endsWith(senderNumber);

    if (!isOwner) {
      return reply(
        `❌ *Owner Only!*\n\n` +
        `මෙම command එක භාවිතා කළ හැක්කේ bot owner හට පමණි.`
      );
    }

    // =========================================================
    // 🔄 RESTART
    // =========================================================

    if (subCommand === 'restart') {

      await reply(
        `🔄 *${botName} Restarting...*\n\n` +
        `⏳ Please wait...`
      );

      setTimeout(() => {
        process.exit(0);
      }, 1500);

      return;
    }

    // =========================================================
    // 🛑 SHUTDOWN
    // =========================================================

    if (subCommand === 'shutdown') {

      await reply(
        `🛑 *${botName} Shutdown*\n\n` +
        `Bot is shutting down...`
      );

      setTimeout(() => {
        process.exit(0);
      }, 1500);

      return;
    }

    // =========================================================
    // 🔄 UPDATE
    // =========================================================

    if (subCommand === 'update') {

      return reply(
        `🔄 *BOT UPDATE*\n\n` +
        `⚠️ Update command is available for the owner.\n\n` +
        `Use your hosting/deployment system to pull the latest code.`
      );
    }

    // =========================================================
    // 📊 STATUS
    // =========================================================

    if (subCommand === 'status') {

      const uptime = formatUptime(process.uptime());
      const memory = process.memoryUsage();

      const statusText =
        `🌸⃝⃘̉̉̉̉̉̉🧚‍♀️ *📊 ʙᴏᴛ ꜱᴛᴀᴛᴜꜱ* 🧚‍♀️🌸⃝⃘̉̉̉̉̉̉\n\n` +

        `❍ 🤖 *Bot* ┊ ${botName}\n` +
        `❍ 🟢 *Status* ┊ Online\n` +
        `❍ ⏱️ *Uptime* ┊ ${uptime}\n` +
        `❍ 💾 *Memory* ┊ ${formatBytes(memory.rss)}\n` +
        `❍ 🟢 *Node* ┊ ${process.version}\n\n` +

        `🧚‍♀️ ©ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐁𝐥𝐚𝐜𝐤 𝐂ᴀᴛ 𝐎ꜰᴄ`;

      return reply(statusText);
    }

    // =========================================================
    // ⏱️ RUNTIME
    // =========================================================

    if (subCommand === 'runtime') {

      return reply(
        `⏱️ *${botName} RUNTIME*\n\n` +
        `🟢 Online\n` +
        `⌛ ${formatUptime(process.uptime())}`
      );
    }

    // =========================================================
    // 💻 SYSTEM
    // =========================================================

    if (subCommand === 'system') {

      const os = require('os');

      const systemText =
        `🌸⃝⃘̉̉̉̉̉̉🧚‍♀️ *💻 ꜱʏꜱᴛᴇᴍ ɪɴꜰᴏ* 🧚‍♀️🌸⃝⃘̉̉̉̉̉̉\n\n` +

        `❍ 🖥️ *Platform* ┊ ${os.platform()}\n` +
        `❍ ⚙️ *Architecture* ┊ ${os.arch()}\n` +
        `❍ 🟢 *Node.js* ┊ ${process.version}\n` +
        `❍ 🧠 *CPU* ┊ ${os.cpus().length} Cores\n` +
        `❍ 💾 *RAM* ┊ ${formatBytes(os.totalmem())}\n` +
        `❍ 📦 *Free RAM* ┊ ${formatBytes(os.freemem())}\n` +
        `❍ ⏱️ *Runtime* ┊ ${formatUptime(process.uptime())}\n\n` +

        `*${botName}* 🖤`;

      return reply(systemText);
    }

    // =========================================================
    // ⚡ SPEED
    // =========================================================

    if (subCommand === 'speed') {

      const start = Date.now();

      const sent = await socket.sendMessage(
        sender,
        {
          text: `⚡ *Checking speed...*`
        },
        { quoted: msg }
      );

      const latency = Date.now() - start;

      await socket.sendMessage(
        sender,
        {
          text:
            `⚡ *${botName} SPEED*\n\n` +
            `🚀 Response: *${latency}ms*\n` +
            `🟢 Status: *Online*`
        },
        { quoted: sent }
      );

      return;
    }

    // =========================================================
    // 📢 BROADCAST
    // =========================================================

    if (
      subCommand === 'broadcast' ||
      subCommand === 'bc'
    ) {

      const message =
        q ||
        args.slice(1).join(' ').trim();

      if (!message) {
        return reply(
          `❌ *Broadcast message missing!*\n\n` +
          `📌 Example:\n` +
          `*${prefix}broadcast Hello everyone!*`
        );
      }

      return reply(
        `📢 *Broadcast Ready*\n\n` +
        `📝 Message:\n${message}\n\n` +
        `⚠️ Broadcast sending logic depends on your bot's group/database handler.`
      );
    }

    // =========================================================
    // 🚫 BLOCK
    // =========================================================

    if (subCommand === 'block') {

      let target = null;

      if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        target =
          msg.message.extendedTextMessage.contextInfo.participant;
      }

      if (!target && m?.quoted?.sender) {
        target = m.quoted.sender;
      }

      if (!target && m?.mentionedJid?.length) {
        target = m.mentionedJid[0];
      }

      if (!target && q) {
        const num = q.replace(/[^0-9]/g, '');

        if (num.length >= 8) {
          target = `${num}@s.whatsapp.net`;
        }
      }

      if (!target) {
        return reply(
          `❌ *User not found!*\n\n` +
          `Reply to a user's message or provide a number.`
        );
      }

      try {

        await socket.updateBlockStatus(
          target,
          'block'
        );

        return reply(
          `🚫 *User Blocked Successfully!*\n\n` +
          `👤 ${target.split('@')[0]}`
        );

      } catch (err) {

        return reply(
          `❌ *Block Failed!*\n\n${err.message}`
        );
      }
    }

    // =========================================================
    // ✅ UNBLOCK
    // =========================================================

    if (subCommand === 'unblock') {

      let target = null;

      if (q) {
        const num = q.replace(/[^0-9]/g, '');

        if (num.length >= 8) {
          target = `${num}@s.whatsapp.net`;
        }
      }

      if (!target) {
        return reply(
          `❌ *Provide a WhatsApp number!*\n\n` +
          `Example:\n` +
          `*${prefix}unblock 947xxxxxxxx*`
        );
      }

      try {

        await socket.updateBlockStatus(
          target,
          'unblock'
        );

        return reply(
          `✅ *User Unblocked Successfully!*\n\n` +
          `👤 ${target.split('@')[0]}`
        );

      } catch (err) {

        return reply(
          `❌ *Unblock Failed!*\n\n${err.message}`
        );
      }
    }

    // =========================================================
    // UNKNOWN OWNER COMMAND
    // =========================================================

    return reply(
      `❌ *Unknown Owner Command!*\n\n` +
      `Use *${prefix}owner* to view the owner menu.`
    );


    // =========================================================
    // 📸 SEND IMAGE FUNCTION
    // =========================================================

    async function sendImage(text) {

      try {

        if (String(logo).startsWith('http')) {

          await socket.sendMessage(
            sender,
            {
              image: { url: logo },
              caption: text,
              contextInfo: {
                mentionedJid: [sender],
                forwardingScore: 143,
                isForwarded: true
              }
            },
            { quoted: msg }
          );

          return;
        }

        const fs = require('fs');

        try {

          const buffer = fs.readFileSync(logo);

          await socket.sendMessage(
            sender,
            {
              image: buffer,
              caption: text,
              contextInfo: {
                mentionedJid: [sender],
                forwardingScore: 143,
                isForwarded: true
              }
            },
            { quoted: msg }
          );

        } catch {

          await socket.sendMessage(
            sender,
            {
              image: { url: config.IMAGE_PATH },
              caption: text
            },
            { quoted: msg }
          );
        }

      } catch {

        await socket.sendMessage(
          sender,
          {
            text
          },
          { quoted: msg }
        );
      }
    }


    // =========================================================
    // 👑 SEND OWNER CONTACT
    // =========================================================

    async function sendOwnerContact() {

      await sendImage(ownerMessage);

      const contacts = [
        {
          displayName: ownerName,
          vcard:
            `BEGIN:VCARD\n` +
            `VERSION:3.0\n` +
            `FN:${ownerName}\n` +
            `ORG:${botName};\n` +
            `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n` +
            `END:VCARD`
        }
      ];

      await socket.sendMessage(
        sender,
        {
          contacts: {
            displayName: `👑 ${botName} - Owner`,
            contacts
          }
        },
        { quoted: msg }
      );
    }


    // =========================================================
    // ⏱️ FORMAT UPTIME
    // =========================================================

    function formatUptime(seconds) {

      seconds = Math.floor(seconds);

      const days = Math.floor(seconds / 86400);

      seconds %= 86400;

      const hours = Math.floor(seconds / 3600);

      seconds %= 3600;

      const minutes = Math.floor(seconds / 60);

      const secs = seconds % 60;

      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    }


    // =========================================================
    // 💾 FORMAT BYTES
    // =========================================================

    function formatBytes(bytes) {

      if (!bytes) return '0 B';

      const units = [
        'B',
        'KB',
        'MB',
        'GB',
        'TB'
      ];

      const index =
        Math.floor(
          Math.log(bytes) /
          Math.log(1024)
        );

      return (
        parseFloat(
          (bytes / Math.pow(1024, index))
            .toFixed(2)
        ) +
        ' ' +
        units[index]
      );
    }
  }
};
