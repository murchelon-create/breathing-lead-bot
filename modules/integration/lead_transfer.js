// Файл: modules/integration/lead_transfer.js

const axios = require('axios');
const config = require('../../config');

// ─── Переводы сегментов ───────────────────────────────────────────────────────

const SEGMENT_LABELS = {
  good:     'Без нарушений',
  mild:     'Лёгкие нарушения',
  moderate: 'Умеренные нарушения',
  severe:   'Выраженные нарушения',
};

// ─── Переводы значений анкеты ─────────────────────────────────────────────────

const VALUE_LABELS = {
  '18-30':          '18–30 лет',
  '31-45':          '31–45 лет',
  '46-60':          '46–60 лет',
  '60+':            '60+ лет',
  'for_child':      'Заполняю для ребёнка',
  'office_work':    'Офисная работа',
  'home_work':      'Работа дома / фриланс',
  'physical_work':  'Физический труд',
  'student':        'Учёба',
  'maternity_leave':'В декрете',
  'retired':        'На пенсии',
  'management':     'Руководящая должность',
  'chronic_stress':       'Хронический стресс, напряжение',
  'insomnia':             'Плохой сон, бессонница',
  'breathing_issues':     'Одышка, нехватка воздуха',
  'high_pressure':        'Повышенное давление',
  'headaches':            'Частые головные боли',
  'fatigue':              'Постоянная усталость',
  'anxiety':              'Тревожность, панические атаки',
  'concentration_issues': 'Проблемы с концентрацией',
  'back_pain':            'Боли в шее, плечах, спине',
  'digestion_issues':     'Проблемы с пищеварением',
  'nose':     'В основном носом',
  'mouth':    'Часто дышу ртом',
  'mixed':    'Попеременно носом и ртом',
  'unaware':  'Не обращаю внимания',
  'constantly': 'Постоянно (каждый день)',
  'often':      'Часто (несколько раз в неделю)',
  'yes_often':  'Да, часто ловлю себя на этом',
  'no':         'Нет, дышу нормально и глубоко',
  'rapid_shallow':      'Учащается, становится поверхностным',
  'breath_holding':     'Начинаю задерживать дыхание',
  'air_shortage':       'Чувствую нехватку воздуха',
  'mouth_breathing':    'Дышу ртом вместо носа',
  'no_change':          'Не замечаю изменений',
  'conscious_breathing':'Стараюсь дышать глубже',
  'few_times':    'Пробовал(а) пару раз, не пошло',
  'theory_only':  'Изучал(а) теорию, но не практиковал(а)',
  'regularly':    'Практикую регулярно (несколько раз в неделю)',
  'expert':       'Опытный практик (ежедневно)',
  '3-5_minutes':   '3–5 минут',
  '10-15_minutes': '10–15 минут',
  '20-30_minutes': '20–30 минут',
  '30+_minutes':   '30+ минут',
  'video':       'Видеоуроки с демонстрацией',
  'audio':       'Аудиопрактики с голосом',
  'text':        'Текст с картинками',
  'online_live': 'Живые онлайн-занятия',
  'individual':  'Индивидуальные консультации',
  'mobile_app':  'Мобильное приложение',
  'quick_relaxation':   'Быстро расслабляться в стрессе',
  'stress_resistance':  'Повысить стрессоустойчивость',
  'reduce_anxiety':     'Избавиться от тревожности и паники',
  'improve_sleep':      'Наладить качественный сон',
  'increase_energy':    'Повысить энергию и работоспособность',
  'normalize_pressure': 'Нормализовать давление/пульс',
  'improve_breathing':  'Улучшить работу лёгких и дыхания',
  'improve_focus':      'Улучшить концентрацию внимания',
  'weight_management':  'Поддержать процесс похудения',
  'general_health':     'Общее оздоровление организма',
  'respiratory_diseases':   'Астма / бронхит / ХОБЛ',
  'cardiovascular_diseases':'Гипертония / аритмия',
  'diabetes':               'Диабет 1 или 2 типа',
  'spine_problems':         'Остеохондроз / грыжи',
  'chronic_headaches':      'Мигрени / головные боли',
  'panic_disorder':         'Панические атаки / ВСД',
  'thyroid_diseases':       'Заболевания щитовидной железы',
  'digestive_diseases':     'Гастрит / язва / рефлюкс',
  'none':                   'Нет хронических заболеваний',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function translateValue(val) {
  if (Array.isArray(val)) return val.map(v => VALUE_LABELS[v] || v).join(', ');
  if (typeof val === 'number') return String(val);
  return VALUE_LABELS[val] || val || '';
}

function formatScale(value) {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return `${String(num).padStart(2, '0')}/10`;
}

// ─── Google Sheets JWT ────────────────────────────────────────────────────────

async function getGoogleAccessToken() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey  = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('GOOGLE_CLIENT_EMAIL или GOOGLE_PRIVATE_KEY не заданы');
  }

  const now     = Math.floor(Date.now() / 1000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  };

  const encode = obj =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  const pemBody = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const keyDer = Buffer.from(pemBody, 'base64');

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey, Buffer.from(unsignedToken)
  );

  const signature = Buffer.from(signatureBuffer)
    .toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signature}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResp.ok) {
    const e = await tokenResp.text();
    throw new Error(`Google token error: ${e}`);
  }

  const { access_token } = await tokenResp.json();
  return access_token;
}

// ─── Запись в Google Sheets ───────────────────────────────────────────────────
// Заголовки (строка 1):
// Дата | Источник | Имя | Телефон | Email | Сегмент | Счёт | Профиль |
// Возраст | Деятельность | Стресс | Сон | Тип дыхания | Опыт практик |
// Проблемы | Главная проблема | Цели | Время | Форматы | Хр. заболевания

async function appendLeadToSheet(userData) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    console.warn('⚠️ GOOGLE_SHEET_ID не задан — пропускаем запись в Sheets');
    return;
  }

  const accessToken = await getGoogleAccessToken();

  const ui = userData.userInfo       || {};
  const ar = userData.analysisResult || {};
  const sa = userData.surveyAnswers  || {};

  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Yekaterinburg' });

  const row = [
    now,                                                          // Дата
    userData.source || 'bot',                                     // Источник
    ui.first_name || ui.username || '',                           // Имя
    sa.phone  || ui.phone  || '',                                 // Телефон
    sa.email  || ui.email  || '',                                 // Email
    SEGMENT_LABELS[ar.segment] || ar.segment || '',               // Сегмент (на русском)
    ar.scores?.total ?? ar.score ?? '',                           // Счёт
    ar.profile || ar.primaryIssue || '',                          // Профиль
    translateValue(sa.age_group),                                 // Возраст
    translateValue(sa.occupation),                                // Деятельность
    formatScale(sa.stress_level),                                 // Стресс (05/10)
    formatScale(sa.sleep_quality),                                // Сон (05/10)
    translateValue(sa.breathing_method),                          // Тип дыхания
    translateValue(sa.breathing_experience),                      // Опыт практик
    translateValue(sa.current_problems),                          // Проблемы
    translateValue(sa.priority_problem),                          // Главная проблема
    translateValue(sa.main_goals),                                // Цели
    translateValue(sa.time_commitment),                           // Время
    translateValue(sa.format_preferences),                        // Форматы
    translateValue(sa.chronic_conditions),                        // Хр. заболевания
  ];

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}` +
    `/values/Sheet1!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [row] }),
  });

  if (!resp.ok) {
    const e = await resp.text();
    throw new Error(`Sheets append error: ${e}`);
  }

  return await resp.json();
}

// ─── LeadTransferSystem ───────────────────────────────────────────────────────

class LeadTransferSystem {
  constructor(adminNotifications = null) {
    this.retryAttempts = 3;
    this.retryDelay = 2000;

    this.mainBotWebhook  = config.MAIN_BOT_API_URL;
    this.crmWebhook      = config.CRM_WEBHOOK_URL;
    this.trainerContact  = config.TRAINER_CONTACT;

    this.enableRetries = true;
    this.enableLogging = config.NODE_ENV !== 'production';

    this.adminNotifications = adminNotifications;
    this.standaloneMode = !this.mainBotWebhook;

    if (this.standaloneMode) {
      console.log('🔄 LeadTransferSystem: Режим автономной работы (данные сохраняются локально)');
    }

    if (!this.adminNotifications) {
      console.warn('⚠️ LeadTransferSystem: adminNotifications не передан - данные будут сохраняться только локально');
    }
  }

  async processLead(userData) {
    console.log('🚀 Начинаем обработку лида:', userData.userInfo?.telegram_id);

    try {
      await this.saveToAdminNotifications(userData);

      // Запись в Google Sheets (параллельно, не блокирует основной поток)
      appendLeadToSheet(userData)
        .then(() => console.log('✅ Лид записан в Google Sheets'))
        .catch(err => console.error('❌ Ошибка записи в Google Sheets:', err.message));

      if (this.standaloneMode) {
        console.log('💾 Автономный режим: лид сохранен локально');
        return await this.saveLeadLocally(userData);
      }

      await this.transferToMainBot(userData);

      if (config.FEATURES?.enable_crm_integration && this.crmWebhook) {
        await this.transferToCRM(userData);
      } else {
        console.log('⚠️ CRM интеграция отключена или не настроена');
      }

      await this.logLeadSuccess(userData);

    } catch (error) {
      console.error('❌ Критическая ошибка обработки лида:', error.message);
      console.log('💾 Сохраняем лид локально из-за ошибки передачи');
      await this.saveToAdminNotifications(userData);
      await this.saveLeadLocally(userData);
      await this.logLeadError(userData, error);
    }
  }

  async saveToAdminNotifications(userData) {
    try {
      if (!this.adminNotifications) {
        console.warn('⚠️ adminNotifications недоступен, пропускаем сохранение');
        return;
      }

      const userId = userData.userInfo?.telegram_id;
      if (!userId) {
        console.error('❌ Отсутствует telegram_id в userData');
        return;
      }

      if (!this.adminNotifications.leadDataStorage) {
        console.log('🔧 Инициализация leadDataStorage');
        this.adminNotifications.leadDataStorage = {};
      }

      this.adminNotifications.leadDataStorage[userId] = {
        userInfo:       userData.userInfo,
        surveyType:     userData.surveyType,
        surveyAnswers:  userData.surveyAnswers,
        analysisResult: userData.analysisResult,
        timestamp:      new Date().toISOString(),
        saved_via:      'lead_transfer',
      };

      console.log(`✅ Лид ${userId} сохранен в adminNotifications.leadDataStorage`);

      if (this.adminNotifications.updateStoredSegment && userData.analysisResult?.segment) {
        this.adminNotifications.updateStoredSegment(userId, userData.analysisResult.segment);
      }

      if (this.adminNotifications.updateDailyStats && userData.analysisResult?.segment) {
        this.adminNotifications.updateDailyStats(userData.analysisResult.segment);
      }

    } catch (error) {
      console.error('❌ Ошибка сохранения в adminNotifications:', error);
    }
  }

  async transferToMainBot(userData) {
    if (!this.mainBotWebhook) {
      console.log('⚠️ Main bot webhook не настроен, данные сохраняются локально');
      return this.saveLeadLocally(userData);
    }

    const webhookUrl = `${this.mainBotWebhook}/api/leads/import`;
    console.log(`📤 Передаем лида в основной бот: ${userData.userInfo?.telegram_id}`);

    const payload = {
      timestamp: new Date().toISOString(),
      source: 'lead_bot',
      data: userData,
    };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await axios.post(webhookUrl, payload, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'BreathingLeadBot/2.5',
            'X-Source': 'lead-bot',
          },
        });

        if (response.status >= 200 && response.status < 300) {
          console.log('✅ Лид успешно передан в основной бот');
          return response.data;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error(`❌ Попытка ${attempt}/${this.retryAttempts} неудачна:`, error.message);
        if (attempt === this.retryAttempts) {
          console.error('💥 Все попытки передачи в основной бот исчерпаны');
          return this.saveLeadLocally(userData);
        }
        if (this.enableRetries) {
          console.log(`⏳ Ожидание ${this.retryDelay}ms перед повтором...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
  }

  async transferToCRM(userData) {
    if (!this.crmWebhook) {
      console.log('⚠️ CRM webhook не настроен, пропускаем');
      return;
    }

    console.log(`📤 Передаем лида в CRM: ${userData.userInfo?.telegram_id}`);

    const crmPayload = {
      contact: {
        name:        userData.userInfo?.first_name || 'Пользователь Telegram',
        telegram_id: userData.userInfo?.telegram_id,
        username:    userData.userInfo?.username || '',
        source:      'Telegram Diagnostic Bot',
      },
      lead_info: {
        survey_type:   userData.surveyType || 'adult',
        quality:       userData.analysisResult?.segment || 'UNKNOWN',
        score:         userData.analysisResult?.scores?.total || 0,
        primary_issue: userData.analysisResult?.primaryIssue || 'general_wellness',
        timestamp:     new Date().toISOString(),
      },
      survey_data: userData.surveyAnswers  || {},
      analysis:    userData.analysisResult || {},
    };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await axios.post(this.crmWebhook, crmPayload, {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'BreathingLeadBot/2.5',
            'X-Source': 'telegram-lead-bot',
          },
        });

        if (response.status >= 200 && response.status < 300) {
          console.log('✅ Лид успешно передан в CRM');
          return response.data;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error(`❌ CRM попытка ${attempt}/${this.retryAttempts} неудачна:`, error.message);
        if (attempt === this.retryAttempts) {
          console.error('💥 Все попытки передачи в CRM исчерпаны');
        } else if (this.enableRetries) {
          console.log(`⏳ Ожидание ${this.retryDelay}ms перед повтором...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
  }

  async saveLeadLocally(userData) {
    try {
      const leadData = {
        timestamp:       new Date().toISOString(),
        telegram_id:     userData.userInfo?.telegram_id,
        survey_type:     userData.surveyType,
        segment:         userData.analysisResult?.segment,
        score:           userData.analysisResult?.scores?.total,
        primary_issue:   userData.analysisResult?.primaryIssue,
        answers:         userData.surveyAnswers,
        trainer_contact: this.trainerContact,
        user_info:       userData.userInfo,
        analysis_result: userData.analysisResult,
        saved_locally:   true,
        processing_mode: this.standaloneMode ? 'standalone' : 'fallback',
      };

      console.log('💾 ЛОКАЛЬНОЕ СОХРАНЕНИЕ ЛИДА:', JSON.stringify({
        telegram_id: leadData.telegram_id,
        segment:     leadData.segment,
        score:       leadData.score,
        timestamp:   leadData.timestamp,
        mode:        leadData.processing_mode,
      }, null, 2));

      return {
        success: true,
        stored_locally: true,
        data: leadData,
        mode: this.standaloneMode ? 'standalone' : 'fallback',
      };
    } catch (error) {
      console.error('❌ Ошибка локального сохранения:', error);
      return { success: false, error: error.message };
    }
  }

  async logLeadSuccess(userData) {
    if (!this.enableLogging) return;
    console.log('✅ УСПЕШНАЯ ОБРАБОТКА ЛИДА:', JSON.stringify({
      event:        'lead_processed_successfully',
      timestamp:    new Date().toISOString(),
      telegram_id:  userData.userInfo?.telegram_id,
      survey_type:  userData.surveyType,
      segment:      userData.analysisResult?.segment,
      mode:         this.standaloneMode ? 'standalone' : 'integrated',
      saved_in_admin_panel: !!this.adminNotifications,
    }, null, 2));
  }

  async logLeadError(userData, error) {
    console.error('💥 ОШИБКА ОБРАБОТКИ ЛИДА:', JSON.stringify({
      event:         'lead_processing_error',
      timestamp:     new Date().toISOString(),
      telegram_id:   userData.userInfo?.telegram_id,
      error_message: error.message,
      userData_summary: {
        survey_type:  userData.surveyType,
        has_answers:  !!userData.surveyAnswers,
        has_analysis: !!userData.analysisResult,
      },
      fallback_used: true,
    }, null, 2));
  }

  async testConnections() {
    const results = {
      main_bot:            { status: 'not_configured', url: this.mainBotWebhook },
      crm:                 { status: 'not_configured', url: this.crmWebhook },
      admin_notifications: { status: this.adminNotifications ? 'connected' : 'not_configured' },
      google_sheets:       { status: process.env.GOOGLE_SHEET_ID ? 'configured' : 'not_configured' },
      standalone_mode:     this.standaloneMode,
      timestamp:           new Date().toISOString(),
    };

    if (this.mainBotWebhook) {
      try {
        const response = await axios.get(`${this.mainBotWebhook}/api/health`, {
          timeout: 5000, validateStatus: () => true,
        });
        results.main_bot.status      = response.status === 200 ? 'connected' : 'error';
        results.main_bot.http_status = response.status;
      } catch (error) {
        results.main_bot.status = 'error';
        results.main_bot.error  = error.message;
      }
    }

    if (this.crmWebhook) {
      try {
        const response = await axios.post(this.crmWebhook, { test: true, timestamp: Date.now() }, {
          timeout: 5000, validateStatus: () => true,
        });
        results.crm.status      = response.status >= 200 && response.status < 300 ? 'connected' : 'error';
        results.crm.http_status = response.status;
      } catch (error) {
        results.crm.status = 'error';
        results.crm.error  = error.message;
      }
    }

    return results;
  }

  getStats() {
    return {
      configuration: {
        main_bot_configured:          !!this.mainBotWebhook,
        crm_configured:               !!this.crmWebhook,
        google_sheets_configured:     !!process.env.GOOGLE_SHEET_ID,
        trainer_contact:              this.trainerContact,
        retries_enabled:              this.enableRetries,
        retry_attempts:               this.retryAttempts,
        retry_delay:                  this.retryDelay,
        standalone_mode:              this.standaloneMode,
        admin_notifications_connected: !!this.adminNotifications,
      },
      endpoints: {
        main_bot: this.mainBotWebhook ? `${this.mainBotWebhook}/api/leads/import` : null,
        crm:      this.crmWebhook,
        trainer:  this.trainerContact,
      },
      storage: {
        leads_in_admin_panel: this.adminNotifications?.leadDataStorage
          ? Object.keys(this.adminNotifications.leadDataStorage).length : 0,
      },
      version:      '2.7.0',
      last_updated: new Date().toISOString(),
    };
  }
}

module.exports = LeadTransferSystem;
