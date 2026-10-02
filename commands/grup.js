// Command: grup (aliases: group, gc, groupmanagement)
// Group Management & Security Commands (All-in-one)
module.exports = {
  name: 'grup',
  aliases: ['group', 'gc', 'groupmanagement'],
  async execute(ctx) {
    const {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT
    } = ctx;

    const cfg = sessionConfig;
    const botName = cfg?.botName || BOT_NAME_FANCY || 'Black Cat';

    const chatJid = msg.key.remoteJid;
    if (!chatJid.endsWith('@g.us')) {
      return reply(`꒰ᵎ 👥 *Group Management* ᵎ꒱

❌ This command can only be used inside WhatsApp Groups!

　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
    }

    try {
      const action = (args[0] || '').toLowerCase();
      const parameter = args.slice(1).join(" ").trim();
      
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;
      const targetUser = quotedMsg?.participant || quotedMsg?.mentionedJid?.[0];

      global.db = global.db || { groups: {} };
      global.db.groups[chatJid] = global.db.groups[chatJid] || { antilink: false, antistatus: false };

      // මෙතැනදී action එකක් නැත්නම් හෝ වැරදි action එකක් දීලා තිබුණොත් මෙනුව පෙන්වන ලෙස සකස් කර ඇත
      if (!action || !['open', 'close', 'name', 'desc', 'lock', 'unlock', 'add', 'kick', 'remove', 'promote', 'demote', 'tagall', 'antilink', 'antistatus'].includes(action)) {
        return reply(`꒰ᵎ 👥 *Group Management Menu* ᵎ꒱

✨ *Available Group Commands:*

  ➜ *${prefix}grup open* 🔓 (Open group for everyone)
  ➜ *${prefix}grup close* 🔒 (Close group for admins only)
  ➜ *${prefix}grup name <new_name>* ✏️ (Change group name)
  ➜ *${prefix}grup desc <new_desc>* 📝 (Change group description)
  ➜ *${prefix}grup lock* 📌 (Lock group settings)
  ➜ *${prefix}grup unlock* 🔓 (Unlock group settings)
  ➜ *${prefix}grup add <number>* ➕ (Add a member)
  ➜ *${prefix}grup kick @user* 👢 (Remove a member)
  ➜ *${prefix}grup promote @user* 👑 (Promote to admin)
  ➜ *${prefix}grup demote @user* 🔻 (Demote from admin)
  ➜ *${prefix}grup tagall <message>* 🏷️ (Tag all members)
  ➜ *${prefix}grup antilink <on/off>* 🛡️ (Auto-delete group links)
  ➜ *${prefix}grup antistatus <on/off>* 🛡️ (Auto-delete status/promo links)

　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
      }

      await socket.sendMessage(chatJid, {
        react: { text: '⚡', key: msg.key }
      });

      switch (action) {
        case 'open':
          await socket.groupSettingUpdate(chatJid, 'not_announcement');
          await reply(`꒰ᵎ 👥 *Group Management* ᵎ꒱\n\n🔓 Group opened successfully! Everyone can send messages now.\n\n*${botName}* 🖤`);
          break;

        case 'close':
          await socket.groupSettingUpdate(chatJid, 'announcement');
          await reply(`꒰ᵎ 👥 *Group Management* ᵎ꒱\n\n🔒 Group closed! Only admins can send messages now.\n\n*${botName}* 🖤`);
          break;

        case 'name':
          if (!parameter) {
            return reply(`⚠️ Please provide a new group name!\n📌 *Example:* ${prefix}grup name Black Cat Bot Official`);
          }
          await socket.groupUpdateSubject(chatJid, parameter);
          await reply(`꒰ᵎ 👥 *Group Management* ᵎ꒱\n\n✏️ Group subject updated to:\n📌 *${parameter}*\n\n*${botName}* 🖤`);
          break;

        case 'desc':
          if (!parameter) {
            return reply(`⚠️ Please provide a new description!\n📌 *Example:* ${prefix}grup desc Welcome everyone!`);
          }
          await socket.groupUpdateDescription(chatJid, parameter);
          await reply(`꒰ᵎ 👥 *Group Management* ᵎ꒱\n\n📝 Group description updated successfully!\n\n*${botName}* 🖤`);
          break;

        case 'lock':
          await socket.groupSettingUpdate(chatJid, 'locked');
          await reply(`꒰ᵎ 👥 *Group Management* ᵎ꒱\n\n📌 Group settings locked successfully!\n\n*${botName}* 🖤`);
          break;

        case 'unlock':
          await socket.groupSettingUpdate(chatJid, 'unlocked');
          await reply(`꒰ᵎ 👥 *Group Management* ᵎ꒱\n\n🔓 Group settings unlocked successfully!\n\n*${botName}* 🖤`);
          break;

        case 'add':
          let userToAdd = parameter.replace(/[^0-9]/g, '');
          if (!userToAdd) {
            return reply(`⚠️ Please provide a valid phone number!\n📌 *Example:* ${prefix}grup add 94771234567`);
          }
          const targetJid = userToAdd + '@s.whatsapp.net';
          try {
            await socket.groupParticipantsUpdate(chatJid, [targetJid], 'add');
            await reply(`꒰ᵎ 👥 *Group Management* ᵎ꒱\n\n➕ Member added successfully!\n\n*${botName}* 🖤`);
          } catch (err) {
            await reply(`❌ Failed to add member! (Check their privacy settings)`);
          }
          break;

        case 'kick':
        case 'remove':
          if (!targetUser) {
            return reply(`⚠️ Please reply to or mention the user you want to remove!`);
          }
          await socket.groupParticipantsUpdate(chatJid, [targetUser], 'remove');
          await reply(`꒰ᵎ 👥 *Group Management* ᵎ꒱\n\n👢 Member removed successfully!\n\n*${botName}* 🖤`);
          break;

        case 'promote':
          if (!targetUser) {
            return reply(`⚠️ Please reply to or mention the user you want to promote!`);
          }
          await socket.groupParticipantsUpdate(chatJid, [targetUser], 'promote');
          await reply(`꒰ᵎ 👥 *Group Management* ᵎ꒱\n\n👑 User is now an *Admin*!\n\n*${botName}* 🖤`);
          break;

        case 'demote':
          if (!targetUser) {
            return reply(`⚠️ Please reply to or mention the user you want to demote!`);
          }
          await socket.groupParticipantsUpdate(chatJid, [targetUser], 'demote');
          await reply(`꒰ᵎ 👥 *Group Management* ᵎ꒱\n\n🔻 Admin rights removed from the user!\n\n*${botName}* 🖤`);
          break;

        case 'tagall':
          const groupMetadata = await socket.groupMetadata(chatJid);
          const participants = groupMetadata.participants;
          let textMsg = parameter || 'Attention everyone!';
          let mentionList = [];
          
          let responseText = `꒰ᵎ 🏷️ *Tag All Members* ᵎ꒱\n\n💬 *Message:* ${textMsg}\n\n`;
          for (let mem of participants) {
            responseText += `‎@${mem.id.split('@')[0]}\n`;
            mentionList.push(mem.id);
          }
          responseText += `\n　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚\n*${botName}* 🖤`;

          await socket.sendMessage(chatJid, {
            text: responseText,
            mentions: mentionList
          }, { quoted: msg });
          break;

        case 'antilink':
          if (parameter === 'on') {
            global.db.groups[chatJid].antilink = true;
            await reply(`꒰ᵎ 🛡️ *Anti-Link* ᵎ꒱\n\n✅ Anti-Link protection is now *ENABLED*!\n\n*${botName}* 🖤`);
          } else if (parameter === 'off') {
            global.db.groups[chatJid].antilink = false;
            await reply(`꒰ᵎ 🛡️ *Anti-Link* ᵎ꒱\n\n❌ Anti-Link protection is now *DISABLED*.\n\n*${botName}* 🖤`);
          } else {
            await reply(`⚠️ Please specify 'on' or 'off'!\n📌 *Example:* ${prefix}grup antilink on`);
          }
          break;

        case 'antistatus':
          if (parameter === 'on') {
            global.db.groups[chatJid].antistatus = true;
            await reply(`꒰ᵎ 🛡️ *Anti-Status / Promo* ᵎ꒱\n\n✅ Anti-Status protection is now *ENABLED*!\n\n*${botName}* 🖤`);
          } else if (parameter === 'off') {
            global.db.groups[chatJid].antistatus = false;
            await reply(`꒰ᵎ 🛡️ *Anti-Status / Promo* ᵎ꒱\n\n❌ Anti-Status protection is now *DISABLED*.\n\n*${botName}* 🖤`);
          } else {
            await reply(`⚠️ Please specify 'on' or 'off'!\n📌 *Example:* ${prefix}grup antistatus on`);
          }
          break;
      }

      await socket.sendMessage(chatJid, {
        react: { text: '✅', key: msg.key }
      });

    } catch (err) {
      console.log('[grup] Error:', err);
      await reply(`꒰ᵎ ❌ *Error* ᵎ꒱\n\n⚠️ An error occurred while executing the command. Make sure the bot has admin permissions.\n\n*${botName}* 🖤`);
    }

  },

  async handleIncomingMessage(ctx) {
    const { socket, msg } = ctx;
    const chatJid = msg.key.remoteJid;

    if (!chatJid || !chatJid.endsWith('@g.us')) return;
    if (msg.key.fromMe) return;

    const groupSettings = global.db?.groups?.[chatJid];
    if (!groupSettings) return;

    const messageText = (
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      ''
    ).toLowerCase();

    if (groupSettings.antilink && (messageText.includes('chat.whatsapp.com') || messageText.includes('t.me/'))) {
      try {
        await socket.sendMessage(chatJid, { delete: msg.key });
        await socket.sendMessage(chatJid, { 
          text: `⚠️ *Anti-Link Protection*\n\n❌ Links are not allowed in this group!` 
        });
      } catch (e) {}
    }

    if (groupSettings.antistatus && (messageText.includes('wa.me/') || messageText.includes('status/') || messageText.includes('subscribe'))) {
      try {
        await socket.sendMessage(chatJid, { delete: msg.key });
        await socket.sendMessage(chatJid, { 
          text: `⚠️ *Anti-Status Protection*\n\n❌ External status and promo links are restricted here!` 
        });
      } catch (e) {}
    }
  }
};
