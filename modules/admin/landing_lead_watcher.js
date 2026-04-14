// modules/admin/landing_lead_watcher.js
// Слушает входящие сообщения от лендинга и сохраняет лиды в файл

const fs   = require('fs');
const path = require('path');

const DATA_DIR   = process.env.DATA_DIR || path.join(__dirname, '../../data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const ADMIN_ID   = process.env.ADMIN_ID || '';

// ──── Утилиты файла ──────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('📁 Создана папка data:', DATA_DIR);
  }
}

function readLeads() {
  ensureDataDir();
  try {
    if (!fs.existsSync(LEADS_FILE)) return {};
    const raw = fs.readFileSync(LEADS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('❌ Ошибка чтения leads.json:', e.message);
    return {};
  }
}

function writeLeads(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('❌ Ошибка записи leads.json:', e.message);
    return false;
  }
}

// ──── Парсинг сообщения с лендинга ──────────────────────────────────────────
// Ожидаемый формат (из telegramNotify.js):
// 🔔 *Новая запись (лендинг)!*
// 👤 *Имя*
// 📧 email  (опционально)
// 📞 телефон (опционально)
// 🟡 *Результат:* заголовок — XX/100
// ...

function parseLandingMessage(text) {
  if (!text) return null;
  // Проверяем что это сообщение с лендинга
  if (!text.includes('Новая запись (лендинг)')) return null;

  const lead = {
    source: 'landing',
    timestamp: new Date().toISOString(),
    userInfo: {},
    analysisResult: { segment: 'WARM_LEAD', scores: { urgency: 0, total: 0 } },
  };

  // Имя: строка после «👤 *» или «👤 »
  const nameMatch = text.match(/👤\s*\*?([^*\n]+)\*?/);
  if (nameMatch) lead.userInfo.first_name = nameMatch[1].trim();

  // Email
  const emailMatch = text.match(/📧\s*([^\n]+)/);
  if (emailMatch) lead.userInfo.email = emailMatch[1].trim();

  // Телефон
  const phoneMatch = text.match(/📞\s*([^\n]+)/);
  if (phoneMatch) lead.userInfo.phone = phoneMatch[1].trim();

  // Результат: «🟡 *Результат:* Заголовок — 42/100»
  const resultMatch = text.match(/[🟢🟡🟠🔴⚪]\s*\*?Результат:\*?\s*([^—\n]+)—\s*(\d+)\/100/);
  if (resultMatch) {
    lead.analysisResult.title    = resultMatch[1].trim();
    const score = parseInt(resultMatch[2], 10);
    lead.analysisResult.scores.urgency = score;
    lead.analysisResult.scores.total   = score;

    // Определяем сегмент по баллу
    if (score >= 70)       lead.analysisResult.segment = 'HOT_LEAD';
    else if (score >= 45)  lead.analysisResult.segment = 'WARM_LEAD';
    else if (score >= 20)  lead.analysisResult.segment = 'COLD_LEAD';
    else                   lead.analysisResult.segment = 'NURTURE_LEAD';
  }

  // Уникальный ID лида — email/телефон/имя+время
  lead.userInfo.telegram_id =
    lead.userInfo.email ||
    lead.userInfo.phone ||
    `${lead.userInfo.first_name || 'unknown'}_${Date.now()}`;

  return lead;
}

// ──── Сохранение лида ────────────────────────────────────────────────────────

function saveLandingLead(leadData) {
  const leads = readLeads();
  const id = leadData.userInfo.telegram_id;
  leads[id] = leadData;
  const ok = writeLeads(leads);
  if (ok) {
    console.log(`💾 Лид с лендинга сохранён: ${leadData.userInfo.first_name || id}`);
  }
  return ok;
}

// ──── Синхронизация в память adminNotifications ──────────────────────────────

function syncLeadsToMemory(adminNotifications) {
  if (!adminNotifications) return;
  const leads = readLeads();
  const count = Object.keys(leads).length;
  if (count === 0) return;
  adminNotifications.leadDataStorage = {
    ...adminNotifications.leadDataStorage,
    ...leads,
  };
  console.log(`🔄 Синхронизировано ${count} лидов из файла в память`);
}

// ──── Регистрация listener в Telegraf ────────────────────────────────────────

function setupLandingLeadWatcher(telegramBot, adminNotifications) {
  console.log('👂 Запуск LandingLeadWatcher...');

  // Слушаем только сообщения в чате с администратором
  telegramBot.on('message', async (ctx, next) => {
    try {
      const chatId = ctx.chat?.id?.toString();
      const text   = ctx.message?.text || '';

      // Только сообщения в личном чате администратора
      if (chatId !== ADMIN_ID) return next();

      const lead = parseLandingMessage(text);
      if (!lead) return next();

      console.log('🔔 Обнаружен лид с лендинга в чате с админом, сохраняем...');

      const saved = saveLandingLead(lead);
      if (saved && adminNotifications) {
        // Сразу кладём в память чтобы «Лиды сегодня» показал без перезапуска
        const id = lead.userInfo.telegram_id;
        if (!adminNotifications.leadDataStorage) adminNotifications.leadDataStorage = {};
        adminNotifications.leadDataStorage[id] = lead;

        // Обновляем счётчик дня
        adminNotifications.resetDailyStatsIfNeeded?.();
        adminNotifications.updateDailyStats?.(lead.analysisResult.segment);

        console.log(`✅ Лид ${lead.userInfo.first_name} добавлен в память и файл`);
      }

    } catch (e) {
      console.error('❌ LandingLeadWatcher ошибка:', e.message);
    }
    return next();
  });

  console.log('✅ LandingLeadWatcher активен — слушает сообщения в чате с админом');
}

module.exports = { setupLandingLeadWatcher, readLeads, saveLandingLead, syncLeadsToMemory };
