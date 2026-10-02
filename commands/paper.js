// Command: paper (aliases: pdf, paperdownload, document)
module.exports = {
  name: 'paper',
  aliases: ['pdf', 'paperdownload', 'document'],
  async execute(ctx) {
    const {
      socket, msg, sender, from, command, args, q, reply,
      sessionConfig, number, prefix, config, BOT_NAME_FANCY,
      NEWSLETTER_CONTEXT, resolveReplyJid
    } = ctx;

    const axios  = require('axios');
    const path   = require('path');
    const osModule = require('os');
    const fs     = require('fs');
    const crypto = require('crypto');

    const cfg = sessionConfig;
    const botName = cfg?.botName || BOT_NAME_FANCY || 'Black Cat';

    const paperQuery = args.join(" ").trim();

    if (!paperQuery) {
      return reply(`꒰ᵎ 📄 *Paper Downloader* ᵎ꒱

⚠️ Please provide a paper or research topic!

📌 *Usage:* ${prefix}paper <topic or title>
📌 *Example:* ${prefix}paper Artificial Intelligence in Healthcare

　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
    }

    await socket.sendMessage(sender, {
      react: { text: '🔍', key: msg.key }
    });

    let paperData = null;

    try {
      // arXiv API එක හරහා Research Papers සෙවීම (Free සහ කිසිදු API Key එකක් අවශ්‍ය නොවේ)
      const searchUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(paperQuery)}&start=0&max_results=1`;
      const response = await axios.get(searchUrl, { timeout: 20000 });
      
      const xmlData = response.data;

      // XML වලින් අදාළ දත්ත ලබා ගැනීම සඳහා Simple Regex Parsing
      const entryMatch = xmlData.match(/<entry>([\s\S]*?)<\/entry>/);
      if (entryMatch) {
        const entry = entryMatch[1];
        const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
        const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
        const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);

        if (idMatch && titleMatch) {
          const arxivIdUrl = idMatch[1].trim();
          // arXiv PDF Direct URL සකස් කරගැනීම
          const pdfUrl = arxivIdUrl.replace('/abs/', '/pdf/') + '.pdf';
          const title = titleMatch[1].replace(/\n/g, ' ').trim();
          const summary = summaryMatch ? summaryMatch[1].replace(/\n/g, ' ').trim() : 'No summary available.';

          paperData = {
            title,
            summary,
            pdfUrl,
            pageUrl: arxivIdUrl
          };
        }
      }
    } catch (e) {
      console.log('[paper] API error:', e.message);
    }

    if (!paperData) {
      return reply(`꒰ᵎ 📄 *Paper Downloader* ᵎ꒱

❌ No research papers found for *${paperQuery}*!

　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`);
    }

    const caption = `꒰ᵎ 📄 *Paper Downloader* ᵎ꒱

📚 *Title* ➜ ${paperData.title}
📝 *Abstract* ➜ ${paperData.summary.substring(0, 300)}...

✨ *Downloading your PDF document...*

　　˚₊‧꒰ა 🌸 ໒꒱‧₊˚
*${botName}* 🖤 | *𝐁ʟᴀᴄᴋ 𝐂ᴀᴛ 𝐎ꜰᴄ*`;

    await socket.sendMessage(sender, {
      text: caption,
      contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: NEWSLETTER_CONTEXT?.forwardedNewsletterMessageInfo?.newsletterJid || '',
          newsletterName: botName,
          serverMessageId: 999,
        }
      }
    }, { quoted: msg });

    const _id = crypto.randomBytes(8).toString('hex');
    const tmpPdf = path.join(osModule.tmpdir(), `paper_${_id}.pdf`);

    try {
      const dlResp = await axios.get(paperData.pdfUrl, {
        responseType: 'stream',
        timeout: 60000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }).catch(() => null);

      if (!dlResp?.data) {
        return socket.sendMessage(sender, {
          text: `꒰ᵎ ❌ *Error* ᵎ꒱\n\n⚠️ PDF Download failed!\n\n*${botName}* 🖤`
        }, { quoted: msg });
      }

      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(tmpPdf);
        dlResp.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const pdfBuffer = fs.readFileSync(tmpPdf);
      const safeTitle = paperData.title.replace(/[/\\?%*:|"<>]/g, '');

      // WhatsApp Document එකක් ලෙස PDF යැවීම
      await socket.sendMessage(sender, {
        document: pdfBuffer,
        mimetype: 'application/pdf',
        fileName: `${safeTitle}.pdf`,
        caption: `📄 *${paperData.title}*`,
        contextInfo: {
          forwardingScore: 1,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: NEWSLETTER_CONTEXT?.forwardedNewsletterMessageInfo?.newsletterJid || '',
            newsletterName: botName,
            serverMessageId: 999,
          }
        }
      }, { quoted: msg });

      await socket.sendMessage(sender, {
        react: { text: '✅', key: msg.key }
      });

    } catch (err) {
      console.log('[paper] Processing error:', err);
      await socket.sendMessage(sender, {
        text: `꒰ᵎ ❌ *Error* ᵎ꒱\n\n⚠️ An error occurred while processing the PDF.\n\n*${botName}* 🖤`
      }, { quoted: msg });
    } finally {
      try {
        if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
      } catch (e) {}
    }

  }
};
