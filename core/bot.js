// Файл: core/bot.js - ИСПРАВЛЕННАЯ ВЕРСИЯ (персональные PDF заработают)

const { Telegraf } = require('telegraf');
const config = require('../config');

// Импорт компонентов ядра
const Handlers = require('./handlers');
const Middleware = require('./middleware');
const AdminIntegration = require('./admin_integration'); // НОВОЕ

// Импорт модулей системы
const ExtendedSurveyQuestions = require('../modules/survey/extended_questions');
const BreathingVERSEAnalysis = require('../modules/analysis/verse_analysis');
const LeadTransferSystem = require('../modules/integration/lead_transfer');

// ИМПОРТЫ ДЛЯ PDF-БОНУСОВ
const ContentGenerator = require('../modules/bonus/content-generator');
const FileHandler = require('../modules/bonus/file-handler');
const PDFManager = require('../modules/bonus/pdf-manager');

// ИСПРАВЛЕНО: Правильный импорт AdminNotificationSystem
const AdminNotificationSystem = require('../modules/admin/notifications/notification_system');

class BreathingLeadBot {
  constructor() {
    console.log('🤖 Инициализация BreathingLeadBot v2.8 с расширенной админ-панелью...');
    
    // Создаем экземпляр Telegraf
    this.bot = new Telegraf(config.LEAD_BOT_TOKEN);
    this.telegramBot = this.bot;
    
    // Инициализируем модули системы
    this.initializeModules();
    
    // Инициализируем компоненты ядра
    this.initializeCore();
    
    // НОВОЕ: Инициализируем админ-панель
    this.initializeAdminPanel();
    
    // Настраиваем бота
    this.setupBot();
    
    console.log('✅ BreathingLeadBot с админ-панелью и персональными PDF инициализирован');
  }

  // Инициализация основных модулей системы
  initializeModules() {
    try {
      console.log('📦 Загрузка модулей системы...');
      
      this.surveyQuestions = new ExtendedSurveyQuestions();
      console.log('✅ ExtendedSurveyQuestions загружен');
      
      this.verseAnalysis = new BreathingVERSEAnalysis();
      console.log('✅ BreathingVERSEAnalysis загружен');
      
      this.contentGenerator = new ContentGenerator();
      console.log('✅ ContentGenerator загружен');
      
      this.fileHandler = new FileHandler(this.contentGenerator);
      console.log('✅ FileHandler загружен');
      
      this.pdfManager = new PDFManager();
      this.pdfManager.contentGenerator = this.contentGenerator;
      this.pdfManager.fileHandler = this.fileHandler;
      console.log('✅ PDFManager полностью инициализирован и подключён');
      
      this.adminNotifications = new AdminNotificationSystem(this);
      console.log('✅ AdminNotificationSystem загружен');
      
      this.leadTransfer = new LeadTransferSystem(this.adminNotifications);
      console.log('✅ LeadTransferSystem загружен с подключением к adminNotifications');
      
      console.log('✅ Все модули системы загружены успешно');
    } catch (error) {
      console.error('❌ Ошибка загрузки модулей:', error.message);
      console.error('Стек:', error.stack);
      throw error;
    }
  }

  // Инициализация компонентов ядра
  initializeCore() {
    try {
      console.log('🔧 Инициализация компонентов ядра...');
      
      this.middleware = new Middleware(this);
      console.log('✅ Middleware инициализирован');
      
      this.handlers = new Handlers(this);
      console.log('✅ Handlers инициализированы');
      
      console.log('✅ Компоненты ядра готовы');
    } catch (error) {
      console.error('❌ Ошибка инициализации ядра:', error.message);
      throw error;
    }
  }

  // Инициализация админ-панели
  initializeAdminPanel() {
    try {
      console.log('🎛️ Инициализация расширенной админ-панели...');
      
      this.adminIntegration = new AdminIntegration(this);
      this.adminIntegration.initialize();
      
      console.log('✅ Расширенная админ-панель готова');
    } catch (error) {
      console.error('❌ Ошибка инициализации админ-панели:', error.message);
      console.warn('⚠️ Бот будет работать без расширенной админ-панели');
      this.adminIntegration = null;
    }
  }

  setupBot() {
    try {
      console.log('⚙️ Настройка бота...');

      this.middleware.setup();
      this.handlers.setup();

      if (this.adminIntegration) {
        this.adminIntegration.startAdminScheduler();
      }

      this.telegramBot.on('callback_query', async (ctx) => {
        const data = ctx.callbackQuery.data;
        if (!data || data.startsWith('admin_')) {
          return;
        }
        console.log('📋 Опросниковый callback:', data);
        await ctx.answerCbQuery();
      });

      this.setupErrorHandling();

      console.log('✅ Бот полностью настроен и готов к работе');
    } catch (error) {
      console.error('❌ Ошибка настройки бота:', error);
      throw error;
    }
  }

  setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      console.error('💥 Ошибка Telegraf:', err);
      this.sendAdminAlert?.('bot_error', 'Ошибка в боте', { error: err.message, ctx });
    });
  }

  async launch() {
    this.validateConfiguration();
    await this.bot.launch();
    console.log('🚀 BreathingLeadBot успешно запущен');
  }

  async stop(reason = 'unknown') {
    try {
      console.log(`🛑 Останавливаем бота: ${reason}`);
      await this.bot.stop(reason);
      
      if (this.middleware?.stop) {
        this.middleware.stop();
      }
      
      console.log('✅ Бот остановлен');
    } catch (error) {
      console.error('❌ Ошибка при остановке бота:', error);
    }
  }

  // Валидация конфигурации — читаем напрямую из process.env
  // чтобы избежать проблемы кеширования dotenv на bothost
  validateConfiguration() {
    console.log('🔍 Проверка конфигурации...');

    // Bothost передаёт токен под разными именами — берём первый найденный
    const token = process.env.LEAD_BOT_TOKEN
      || process.env.BOT_TOKEN
      || process.env.TOKEN
      || process.env.API_TOKEN
      || process.env.TELEGRAM_BOT_TOKEN
      || process.env.BOT_API_TOKEN;

    if (!token) {
      throw new Error('Отсутствует обязательный параметр: LEAD_BOT_TOKEN');
    }

    // Обновляем config на случай если dotenv не успел загрузиться
    config.LEAD_BOT_TOKEN = token;
    // Примечание: this.bot.token readonly в Telegraf, пересоздаём если нужно
    if (!this.bot.token) {
      this.bot = new Telegraf(token);
      this.telegramBot = this.bot;
    }

    if (!config.MAIN_BOT_API_URL) {
      console.log('ℹ️ MAIN_BOT_API_URL не настроен - работаем в автономном режиме');
    }

    if (!config.ADMIN_ID) {
      console.warn('⚠️ ADMIN_ID не настроен - админ-панель будет ограничена');
    }

    console.log('✅ Конфигурация валидна');
  }

  getBotInfo() {
    const baseInfo = {
      name: 'BreathingLeadBot',
      version: '2.8.0',
      status: 'running',
      uptime: process.uptime(),
      configuration: {
        main_bot_connected: !!config.MAIN_BOT_API_URL,
        crm_connected: !!config.CRM_WEBHOOK_URL,
        admin_configured: !!config.ADMIN_ID,
        environment: config.NODE_ENV || 'development',
        standalone_mode: !config.MAIN_BOT_API_URL
      },
      modules: {
        survey_questions: !!this.surveyQuestions,
        verse_analysis: !!this.verseAnalysis,
        lead_transfer: !!this.leadTransfer,
        pdf_manager: !!this.pdfManager,
        content_generator: !!this.contentGenerator,
        file_handler: !!this.fileHandler,
        admin_notifications: !!this.adminNotifications,
        admin_integration: !!this.adminIntegration
      },
      lead_storage: {
        leads_count: this.adminNotifications?.leadDataStorage ? 
          Object.keys(this.adminNotifications.leadDataStorage).length : 0,
        connected_to_transfer: !!this.leadTransfer?.adminNotifications
      },
      last_updated: new Date().toISOString()
    };

    if (this.adminIntegration) {
      baseInfo.admin_panel = this.adminIntegration.getIntegrationInfo();
      baseInfo.extended_stats = this.adminIntegration.getExtendedStats();
    }

    return baseInfo;
  }

  async getAdminStats() {
    if (!this.adminIntegration) return null;
    return this.adminIntegration.getExtendedStats();
  }

  async createBackup() {
    if (!this.adminIntegration) return null;
    return this.adminIntegration.createBackup();
  }

  async runDiagnostics() {
    if (!this.adminIntegration) return null;
    return this.adminIntegration.runDiagnostics();
  }

  async cleanupOldData(days) {
    if (!this.adminIntegration) return null;
    return this.adminIntegration.cleanupOldData(days);
  }

  async sendAdminAlert(type, message, data = {}) {
    if (!this.adminIntegration) return false;
    await this.adminIntegration.sendEmergencyAlert(type, message, data);
    return true;
  }

  async checkHealth() {
    const health = {
      bot_status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      modules_loaded: Object.keys(this).filter(k => this[k] !== null).length,
      admin_panel: this.adminIntegration ? 'active' : 'inactive',
      pdf_system: !!this.pdfManager && !!this.pdfManager.contentGenerator && !!this.pdfManager.fileHandler,
      lead_storage_connected: !!this.leadTransfer?.adminNotifications,
      timestamp: new Date().toISOString()
    };

    if (this.adminIntegration) {
      const diagnostics = await this.adminIntegration.runDiagnostics();
      health.diagnostics = diagnostics;
    }

    return health;
  }

  getAdminPanel() {
    return this.adminIntegration;
  }

  async updateSettings(newSettings) {
    try {
      console.log('⚙️ Обновление настроек бота...');
      
      if (this.adminIntegration && newSettings.notifications) {
        this.adminIntegration.adminPanel.notificationSettings = {
          ...this.adminIntegration.adminPanel.notificationSettings,
          ...newSettings.notifications
        };
      }
      
      console.log('✅ Настройки обновлены');
      return { success: true };
    } catch (error) {
      console.error('❌ Ошибка обновления настроек:', error);
      return { success: false, error: error.message };
    }
  }

  getPerformanceStats() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      timestamp: new Date().toISOString(),
      middleware_stats: this.middleware ? this.middleware.getStats() : null,
      admin_stats: this.adminIntegration ? this.adminIntegration.getExtendedStats() : null
    };
  }
}

module.exports = BreathingLeadBot;
