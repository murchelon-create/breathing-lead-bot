// index.js - Точка входа для BreathingLeadBot v2.5
// + HTTP-сервер для приёма лидов с лендинга

const BreathingLeadBot = require('./core/bot');
const express = require('express');
const config = require('./config');

console.log('🌬️ Запуск BreathingLeadBot v2.5...');

// ─── HTTP-сервер для лендинга ───────────────────────────────────────────────

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS — разрешаем запросы с лендинга
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Health-check
app.get('/', (req, res) => res.json({ ok: true, service: 'BreathingLeadBot' }));

// Получаем лид с лендинга и шлём уведомление в Telegram
app.post('/notify-lead', async (req, res) => {
  try {
    const { name, phone, email, tg, segment, profile, tech } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({ ok: false, error: 'name и phone обязательны' });
    }

    const adminId = process.env.ADMIN_ID || config.ADMIN_ID;
    const token   = process.env.LEAD_BOT_TOKEN
      || process.env.BOT_TOKEN
      || process.env.TOKEN
      || process.env.API_TOKEN
      || process.env.TELEGRAM_BOT_TOKEN;

    if (!adminId || !token) {
      console.error('❌ /notify-lead: ADMIN_ID или токен не настроены');
      return res.status(500).json({ ok: false, error: 'Сервер не настроен' });
    }

    const esc = (s) => String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const text =
      '🌐 <b>Новый лид с сайта (анкета)</b>\n\n' +
      `👤 <b>Имя:</b> ${esc(name)}\n` +
      `📱 <b>Телефон:</b> ${esc(phone)}\n` +
      `📧 <b>Email:</b> ${esc(email)}\n` +
      (tg ? `✈️ <b>Telegram:</b> ${esc(tg)}\n` : '') +
      '\n📊 <b>Результат диагностики:</b>\n' +
      `  • Сегмент: ${esc(segment)}\n` +
      `  • Профиль: ${esc(profile)}\n` +
      `  • Техника: ${esc(tech)}\n` +
      `\n🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: adminId, text, parse_mode: 'HTML' })
      }
    );

    const tgData = await tgRes.json();
    if (!tgData.ok) {
      console.error('❌ Telegram API error:', tgData.description);
      return res.status(502).json({ ok: false, error: tgData.description });
    }

    console.log(`✅ Лид отправлен: ${name} | ${phone}`);
    res.json({ ok: true });

  } catch (err) {
    console.error('❌ /notify-lead error:', err.message);
    res.status(500).json({ ok: false, error: 'Внутренняя ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 HTTP-сервер запущен на порту ${PORT}`);
});

// ─── Запуск Telegram-бота ────────────────────────────────────────────────────

async function startBot() {
  try {
    const bot = new BreathingLeadBot();
    await bot.launch();
  } catch (error) {
    console.error('💥 Критическая ошибка запуска:', error.message);
    console.error('Стек ошибки:', error.stack);
    console.error('Детали ошибки:', {
      name: error.name,
      code: error.code,
      response: error.response?.description || 'N/A',
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Необработанное отклонение промиса в index.js:', reason);
  console.error('Промис:', promise);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Неперехваченное исключение в index.js:', error);
  process.exit(1);
});

startBot();
