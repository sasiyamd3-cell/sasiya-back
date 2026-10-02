// Command: weather (alias: climate)
module.exports = {
  name: 'weather',
  aliases: ['climate'],
  async execute(ctx) {
    const { socket, msg, sender, args, reply, sessionConfig, BOT_NAME_FANCY, NEWSLETTER_CONTEXT } = ctx;
    const axios = require('axios');
    const botName = sessionConfig?.botName || BOT_NAME_FANCY;

    const city = args.join(" ");
    if (!city) {
      return reply(`꒰ᵎ 🌤️ *Weather Info* ᵎ꒱\n\n⚠️ Please provide a city name!\n\n📌 *Usage:* .weather Colombo\n\n*${botName}*`);
    }

    await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

    try {
      const { data } = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { timeout: 15000 });
      const current = data?.current_condition?.[0];
      const area = data?.nearest_area?.[0];

      if (!current) return reply(`❌ City not found or error fetching weather!`);

      const cityName = area?.areaName?.[0]?.value || city;
      const country = area?.country?.[0]?.value || '';
      const tempC = current.temp_C;
      const desc = current.weatherDesc?.[0]?.value;
      const humidity = current.humidity;
      const windKmph = current.windspeedKmph;

      const weatherText = 
        `꒰ᵎ 🌤️ *Weather Report: ${cityName}, ${country}* ᵎ꒱\n\n` +
        `🌡️ *Temperature:* ${tempC}°C\n` +
        `☁️ *Condition:* ${desc}\n` +
        `💧 *Humidity:* ${humidity}%\n` +
        `💨 *Wind Speed:* ${windKmph} km/h\n\n` +
        `*${botName}*`;

      await socket.sendMessage(sender, {
        text: weatherText,
        contextInfo: {
          forwardingScore: 1, isForwarded: true,
          forwardedNewsletterMessageInfo: { newsletterJid: NEWSLETTER_CONTEXT.forwardedNewsletterMessageInfo.newsletterJid, newsletterName: botName, serverMessageId: 999 }
        }
      }, { quoted: msg });
      await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });
    } catch (e) {
      return reply(`❌ Error getting weather details!`);
    }
  }
};
