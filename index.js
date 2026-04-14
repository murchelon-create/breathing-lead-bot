// index.js - Точка входа BreathingLeadBot
// HTTP-сервер для лендинга + Telegram-бот

const BreathingLeadBot = require('./core/bot');
const express = require('express');
const config  = require('./config');

console.log('🌬️ Запуск BreathingLeadBot v2.5...');

// ─── HTTP-сервер ─────────────────────────────────────────────────────────────

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Health-check
app.get('/', (req, res) => res.json({ ok: true, service: 'BreathingLeadBot' }));

// ─── /notify-lead — лид с лендинга ───────────────────────────────────────────
// Принимает данные анкеты с сайта и передаёт в AdminNotificationSystem,
// чтобы лид попал в статистику (горячие/тёплые/холодные) и leadDataStorage.
//
// Ожидаемое тело запроса:
//   name     string  — имя
//   phone    string  — телефон (обязательно)
//   email    string  — email
//   tg       string  — telegram username
//   segment  string  — 'hot' | 'mild' | 'moderate' | 'severe'  (с лендинга)
//   score    number  — итоговый балл (0-100)
//   profile  string  — описание профиля
//   tech     string  — рекомендованная техника
//   goals    string  — цели пользователя

app.post('/notify-lead', async (req, res) => {
  try {
    const { name, phone, email, tg, segment, score, profile, tech, goals } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({ ok: false, error: 'name и phone обязательны' });
    }

    // Ждём пока бот будет готов (на случай очень быстрого запроса при старте)
    if (!global.botInstance || !global.botInstance.adminNotifications) {
      console.warn('⚠️ /notify-lead: бот ещё не готов, отправляем через raw API');
      return await sendRawTelegram(req.body, res);
    }

    // Маппинг сегмента с лендинга → внутренний сегмент AdminNotificationSystem
    const segmentMap = {
      'hot':      'HOT_LEAD',
      'mild':     'WARM_LEAD',
      'moderate': 'WARM_LEAD',
      'severe':   'HOT_LEAD',
      'good':     'COLD_LEAD'
    };
    const internalSegment = segmentMap[segment] || 'WARM_LEAD';

    // Уникальный ID для лида с лендинга
    const landingId = `landing_${Date.now()}`;

    // Формируем объект userData в формате AdminNotificationSystem
    const userData = {
      source: 'landing',           // пометка источника — видна в CSV
      userInfo: {
        telegram_id: landingId,
        first_name:  name,
        username:    tg ? tg.replace('@', '') : null,
        phone:       phone,
        email:       email
      },
      surveyType: 'adult',
      surveyAnswers: {
        // Контактные данные (для отображения в уведомлении)
        phone:   phone,
        email:   email,
        tg:      tg,
        // Анкетные данные
        goals:   goals || null,
        profile: profile || null,
        tech:    tech || null
      },
      analysisResult: {
        segment:      internalSegment,
        primaryIssue: profile || 'general_wellness',
        scores: {
          total:     typeof score === 'number' ? score : parseInt(score) || 0,
          urgency:   internalSegment === 'HOT_LEAD'  ? 85 :
                     internalSegment === 'WARM_LEAD' ? 60 : 35,
          readiness: internalSegment === 'HOT_LEAD'  ? 80 :
                     internalSegment === 'WARM_LEAD' ? 55 : 30,
          fit:       typeof score === 'number' ? score : parseInt(score) || 0
        }
      },
      timestamp: new Date().toISOString()
    };

    // Вызываем AdminNotificationSystem — лид попадёт в статистику и уведомление
    await global.botInstance.adminNotifications.notifyNewLead(userData);

    console.log(`✅ Лид с лендинга передан в AdminNotificationSystem: ${name} | ${phone} | ${internalSegment}`);
    res.json({ ok: true });

  } catch (err) {
    console.error('❌ /notify-lead error:', err.message);
    // Fallback: попробуем хотя бы сырой Telegram
    try { await sendRawTelegram(req.body, res); } catch (e) {
      res.status(500).json({ ok: false, error: 'Внутренняя ошибка сервера' });
    }
  }
});

// ─── Fallback: прямой вызов Telegram API (если бот ещё не готов) ──────────────
async function sendRawTelegram(body, res) {
  const { name, phone, email, tg, segment, score, profile, tech } = body || {};

  const adminId = process.env.ADMIN_ID || config.ADMIN_ID;
  const token   = process.env.LEAD_BOT_TOKEN || process.env.BOT_TOKEN
    || process.env.TOKEN || process.env.API_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

  if (!adminId || !token) {
    return res.status(500).json({ ok: false, error: 'Сервер не настроен' });
  }

  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const text =
    '🌐 <b>Новый лид с сайта (анкета)</b>\n\n' +
    `👤 <b>Имя:</b> ${esc(name)}\n` +
    `📱 <b>Телефон:</b> ${esc(phone)}\n` +
    `📧 <b>Email:</b> ${esc(email)}\n` +
    (tg ? `✈️ <b>Telegram:</b> ${esc(tg)}\n` : '') +
    `\n📊 Сегмент: ${esc(segment)} | Балл: ${score || '?'}/100\n` +
    `💡 Профиль: ${esc(profile)}\n` +
    `🧘 Техника: ${esc(tech)}\n` +
    `\n🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: adminId, text, parse_mode: 'HTML' })
  });
  const data = await r.json();
  if (!data.ok) return res.status(502).json({ ok: false, error: data.description });

  console.log(`✅ Лид отправлен (fallback raw API): ${name} | ${phone}`);
  res.json({ ok: true, fallback: true });
}

app.listen(PORT, () => {
  console.log(`🌐 HTTP-сервер запущен на порту ${PORT}`);
});

// ─── Запуск Telegram-бота ─────────────────────────────────────────────────────

async function startBot() {
  try {
    const bot = new BreathingLeadBot();
    // Сохраняем экземпляр глобально — нужен для /notify-lead
    global.botInstance = bot;
    await bot.launch();
  } catch (error) {
    console.error('💥 Критическая ошибка запуска:', error.message);
    console.error('Стек ошибки:', error.stack);
    console.error('Детали:', {
      name: error.name,
      code: error.code,
      response: error.response?.description || 'N/A',
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Необработанное отклонение промиса:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Неперехваченное исключение:', error);
  process.exit(1);
});

startBot();
