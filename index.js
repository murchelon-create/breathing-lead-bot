// index.js - Точка входа BreathingLeadBot
// HTTP-сервер для лендинга + Telegram-бот

const BreathingLeadBot = require('./core/bot');
const express = require('express');
const config  = require('./config');
const { saveLandingLead } = require('./modules/admin/landing_lead_watcher');

console.log('🌬️ Запуск BreathingLeadBot v2.9.1...');

// ─── HTTP-сервер ───────────────────────────────────────────────────────────────────────────────

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
app.get('/', (req, res) => res.json({ ok: true, service: 'BreathingLeadBot', version: '2.9.1' }));

// ─── Вспомогательная функция: сборка userData ────────────────────────────────────────────────
function buildUserData(body) {
  const { name, phone, email, tg, segment, score, profile, tech, goals } = body || {};

  const segmentMap = {
    'hot':      'HOT_LEAD',
    'mild':     'WARM_LEAD',
    'moderate': 'WARM_LEAD',
    'severe':   'HOT_LEAD',
    'good':     'COLD_LEAD'
  };
  const internalSegment = segmentMap[segment] || 'WARM_LEAD';
  const landingId = email || phone || `landing_${Date.now()}`;

  return {
    source: 'landing',
    userInfo: {
      telegram_id: landingId,
      first_name:  name,
      username:    tg ? tg.replace('@', '') : null,
      phone:       phone  || null,
      email:       email  || null,
    },
    surveyType: 'adult',
    surveyAnswers: {
      phone:   phone   || null,
      email:   email   || null,
      tg:      tg      || null,
      goals:   goals   || null,
      profile: profile || null,
      tech:    tech    || null,
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
        fit:       typeof score === 'number' ? score : parseInt(score) || 0,
      },
    },
    timestamp: new Date().toISOString(),
  };
}

// ─── Сохранение лида: память + файл ──────────────────────────────────────────────────────────────────────
function saveLeadToStorage(userData) {
  try {
    // 1. Сохраняем в файл (leads.json) — персистентно, переживает перезапуск
    saveLandingLead(userData);

    // 2. Сохраняем в память (для текущей сессии)
    if (global.botInstance?.adminNotifications) {
      if (!global.botInstance.adminNotifications.leadDataStorage) {
        global.botInstance.adminNotifications.leadDataStorage = {};
      }
      const id = userData.userInfo.telegram_id;
      global.botInstance.adminNotifications.leadDataStorage[id] = userData;
      console.log(`💾 Лид сохранён в файл + память: ${id}`);
    } else {
      console.log(`💾 Лид сохранён в файл (бот ещё не готов): ${userData.userInfo.telegram_id}`);
    }
  } catch (e) {
    console.warn('⚠️ Не удалось сохранить лид:', e.message);
  }
}

// ─── /notify-lead — лид с лендинга ─────────────────────────────────────────────────────────────────────
app.post('/notify-lead', async (req, res) => {
  try {
    const { name, phone, email } = req.body || {};

    if (!name || (!phone && !email)) {
      return res.status(400).json({ ok: false, error: 'name и email/phone обязательны' });
    }

    const userData = buildUserData(req.body);

    // Сохраняем в файл + память
    saveLeadToStorage(userData);

    if (!global.botInstance || !global.botInstance.adminNotifications) {
      console.warn('⚠️ /notify-lead: бот ещё не готов, отправляем через raw API');
      return await sendRawTelegram(req.body, res);
    }

    await global.botInstance.adminNotifications.notifyNewLead(userData);

    console.log(`✅ Лид с лендинга: ${name} | ${phone || email} | ${userData.analysisResult.segment}`);
    res.json({ ok: true });

  } catch (err) {
    console.error('❌ /notify-lead error:', err.message);
    try { await sendRawTelegram(req.body, res); } catch (e) {
      res.status(500).json({ ok: false, error: 'Внутренняя ошибка сервера' });
    }
  }
});

// ─── Fallback: прямой вызов Telegram API ──────────────────────────────────────────────────────────────────
async function sendRawTelegram(body, res) {
  const { name, phone, email, tg, segment, score, profile, tech } = body || {};

  const adminId = process.env.ADMIN_CHAT_ID || process.env.ADMIN_ID || config.ADMIN_ID;
  const token   = process.env.LEAD_BOT_TOKEN || process.env.BOT_TOKEN
    || process.env.TOKEN || process.env.API_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

  if (!adminId || !token) {
    return res.status(500).json({ ok: false, error: 'Сервер не настроен (нет токена/chat_id)' });
  }

  // Сохраняем лид в файл даже при fallback
  saveLeadToStorage(buildUserData(body));

  const esc = s => String(s || '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const text =
    '🌐 <b>Новый лид с сайта (анкета)</b>\n\n' +
    `👤 <b>Имя:</b> ${esc(name)}\n` +
    (phone ? `📞 <b>Телефон:</b> ${esc(phone)}\n` : '') +
    (email ? `📧 <b>Email:</b> ${esc(email)}\n`   : '') +
    (tg    ? `✈️ <b>Telegram:</b> ${esc(tg)}\n`   : '') +
    `\n📊 Сегмент: ${esc(segment)} | Балл: ${score || '?'}/100\n` +
    `💡 Профиль: ${esc(profile)}\n` +
    `🧘 Техника: ${esc(tech)}\n` +
    `\n🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Yekaterinburg' })}`;

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: adminId, text, parse_mode: 'HTML' }),
  });
  const data = await r.json();
  if (!data.ok) return res.status(502).json({ ok: false, error: data.description });

  console.log(`✅ Лид отправлен (fallback): ${name} | ${phone || email}`);
  res.json({ ok: true, fallback: true });
}

app.listen(PORT, () => {
  console.log(`🌐 HTTP-сервер запущен на порту ${PORT}`);
});

// ─── Запуск Telegram-бота ──────────────────────────────────────────────────────────────────────────────
async function startBot() {
  try {
    const bot = new BreathingLeadBot();
    global.botInstance = bot;
    await bot.launch();
  } catch (error) {
    console.error('💥 Критическая ошибка запуска:', error.message);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  console.error('💥 Необработанное отклонение промиса:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Неперехваченное исключение:', error);
  process.exit(1);
});

startBot();
