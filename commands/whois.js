// ============================================================
// COMMAND: whois
// MEZUKA MD V5 - command/whois.js
// ============================================================

module.exports = {
    name: "whois",
    aliases: ["domaininfo"],
    async execute(ctx) {
    const {
      socket,
      msg,
      from,
      sender,
      isOwner,
      isGroup,
      reply,
      quoted,
      q,
      args,
      body,
      pushname,
      botNumber,
      ownerNumber,
      readEnvSync,
      adhiqmini,
      GQCAP,
      prefix,
      runtime,
      os
    } = ctx;

const axios = require('axios');

    const WHOIS_IMG = 'https://files.catbox.moe/khre7u.jpg';

    const contextInfo = {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363424190766692@newsletter',
            newsletterName: "sakuraxd",
            serverMessageId: 999,
        }
    };

    try {

        await socket.sendMessage(sender, {
          react: { text: '🔍', key: msg.key }
        });

        if (!q) return reply(`🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ᴘʟᴇᴀꜱᴇ ɢɪᴠᴇ ᴍᴇ ᴀ ᴅᴏᴍᴀɪɴ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\nExample: .whois google.com`);

        let domain = q.trim().replace(/^https?:\/\//i, '');

        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return reply(`🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ɪɴᴠᴀʟɪᴅ ᴅᴏᴍᴀɪɴ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n❌ Please provide a valid domain name!`);

        await socket.sendMessage(from, { text: `🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ᴡʜᴏɪꜱ ꜰᴇᴛᴄʜɪɴɢ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n🌐 ${domain}` });
        await socket.sendMessage(sender, {
          react: { text: '⏳', key: msg.key }
        });

        const res = await axios.get(`https://discardapi.dpdns.org/api/tools/whois?apikey=guru&domain=${encodeURIComponent(domain)}`, { timeout: 10000 });

        if (!res.data?.status || !res.data.result?.domain) return reply(`🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ꜰᴀɪʟᴇᴅ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n❌ Could not fetch WHOIS information!`);

        const { domain: dom, registrar, registrant, technical } = res.data.result;

        const caption = `🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ᴡʜᴏɪꜱ ɪɴꜰᴏ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n` +
                `🌐 *ᴅᴏᴍᴀɪɴ* ➤ ${dom.domain}\n` +
                `📛 *ɴᴀᴍᴇ* ➤ ${dom.name}\n` +
                `🔖 *ᴇxᴛᴇɴꜱɪᴏɴ* ➤ .${dom.extension}\n` +
                `🖥️ *ᴡʜᴏɪꜱ ꜱᴇʀᴠᴇʀ* ➤ ${dom.whois_server}\n` +
                `📊 *ꜱᴛᴀᴛᴜꜱ* ➤ ${dom.status.join(', ')}\n` +
                `🔗 *ɴᴀᴍᴇ ꜱᴇʀᴠᴇʀꜱ* ➤ ${dom.name_servers.join(', ')}\n` +
                `📅 *ᴄʀᴇᴀᴛᴇᴅ* ➤ ${dom.created_date_in_time}\n` +
                `🔄 *ᴜᴘᴅᴀᴛᴇᴅ* ➤ ${dom.updated_date_in_time}\n` +
                `⏳ *ᴇxᴘɪʀᴇꜱ* ➤ ${dom.expiration_date_in_time}\n\n` +
                `🏢 *ʀᴇɢɪꜱᴛʀᴀʀ* ➤ ${registrar.name}\n` +
                `📞 *ᴘʜᴏɴᴇ* ➤ ${registrar.phone}\n` +
                `📧 *ᴇᴍᴀɪʟ* ➤ ${registrar.email}\n` +
                `🔗 *ᴡᴇʙꜱɪᴛᴇ* ➤ ${registrar.referral_url}\n\n` +
                `👤 *ʀᴇɢɪꜱᴛʀᴀɴᴛ* ➤ ${registrant.organization || 'N/A'}\n` +
                `🌍 *ᴄᴏᴜɴᴛʀʏ* ➤ ${registrant.country || 'N/A'}\n` +
                `📧 *ʀᴇɢ ᴇᴍᴀɪʟ* ➤ ${registrant.email || 'N/A'}\n\n` +
                `⚙️ *ᴛᴇᴄʜ ᴇᴍᴀɪʟ* ➤ ${technical.email || 'N/A'}\n\n` +
                `${GQCAP}`;

        await socket.sendMessage(from, {
            image: { url: WHOIS_IMG },
            caption: caption,
            contextInfo: contextInfo
        }, { quoted: adhiqmini });

        await socket.sendMessage(sender, {
          react: { text: '✅', key: msg.key }
        });

    } catch (e) {
        if (e.code === 'ECONNABORTED') {
            reply(`🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ᴛɪᴍᴇᴏᴜᴛ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n❌ Request timed out. API may be slow!`);
        } else {
            reply(`🌹⃝⃘̉̉̉̉̉̉🧚‍♀️ *ᴇʀʀᴏʀ* 🧚‍♀️🌹⃝⃘̉̉̉̉̉̉\n\n❌ ${e.message}`);
        }
    }

    }
};

