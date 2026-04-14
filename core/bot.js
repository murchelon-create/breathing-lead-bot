// Файл: core/bot.js

const { Telegraf } = require('telegraf');
const config = require('../config');

// Импорт компонентов ядра
const Handlers = require('./handlers');
const Middleware = require('./middleware');
const AdminIntegration = require('./admin_integration');

// Импорт модулей системы
const ExtendedSurveyQuestions = require('../modules/survey/extended_questions');
const BreathingVERSEAnalysis = require('../modules/analysis/verse_analysis');
const LeadTransferSystem = require('../modules/integration/lead_transfer');

// PDF-бонусы
const ContentGenerator = require('../modules/bonus/content-generator');
const FileHandler = require('../modules/bonus/file-handler');
const PDFManager = require('../modules/bonus/pdf-manager');

const AdminNotificationSystem = require('../modules/admin/notifications/notification_system');

// ♥ НОВОЕ: Модуль перехвата лидов с лендинга
const { setupLandingLeadWatcher, syncLeadsToMemory } = require('../modules/admin/landing_lead_watcher');

class BreathingLeadBot {
  constructor() {
    console.log('🤖 Инициализация BreathingLeadBot v2.9 + LandingLeadWatcher...');

    this.bot = new Telegraf(config.LEAD_BOT_TOKEN);
    this.telegramBot = this.bot;

    this.initializeModules();
    this.initializeCore();
    this.initializeAdminPanel();
    this.setupBot();

    console.log('✅ BreathingLeadBot инициализирован');
  }

  initializeModules() {
    try {
      console.log('📦 Загрузка модулей...');

      this.surveyQuestions = new ExtendedSurveyQuestions();
      this.verseAnalysis   = new BreathingVERSEAnalysis();
      this.contentGenerator = new ContentGenerator();
      this.fileHandler     = new FileHandler(this.contentGenerator);
      this.pdfManager      = new PDFManager();
      this.pdfManager.contentGenerator = this.contentGenerator;
      this.pdfManager.fileHandler      = this.fileHandler;

      this.adminNotifications = new AdminNotificationSystem(this);

      // ♥ При старте загружаем лиды из файла в память
      syncLeadsToMemory(this.adminNotifications);

      this.leadTransfer = new LeadTransferSystem(this.adminNotifications);

      console.log('✅ Все модули загружены');
    } catch (error) {
      console.error('❌ Ошибка загрузки модулей:', error.message);
      throw error;
    }
  }

  initializeCore() {
    try {
      this.middleware = new Middleware(this);
      this.handlers   = new Handlers(this);
      console.log('✅ Компоненты ядра готовы');
    } catch (error) {
      console.error('❌ Ошибка инициализации ядра:', error.message);
      throw error;
    }
  }

  initializeAdminPanel() {
    try {
      this.adminIntegration = new AdminIntegration(this);
      this.adminIntegration.initialize();
      console.log('✅ Админ-панель готова');
    } catch (error) {
      console.error('❌ Ошибка админ-панели:', error.message);
      this.adminIntegration = null;
    }
  }

  setupBot() {
    try {
      console.log('⚙️ Настройка бота...');

      this.middleware.setup();

      // ♥ Сначала регистрируем LandingLeadWatcher чтобы он
      //   получал сообщения раньше text-handlerа в handlers.js
      setupLandingLeadWatcher(this.bot, this.adminNotifications);

      this.handlers.setup();

      if (this.adminIntegration) {
        this.adminIntegration.startAdminScheduler();
      }

      this.telegramBot.on('callback_query', async (ctx) => {
        const data = ctx.callbackQuery.data;
        if (!data || data.startsWith('admin_')) return;
        console.log('📋 Опросниковый callback:', data);
        await ctx.answerCbQuery();
      });

      this.setupErrorHandling();
      console.log('✅ Бот полностью настроен');
    } catch (error) {
      console.error('❌ Ошибка настройки бота:', error);
      throw error;
    }
  }

  setupErrorHandling() {
    this.bot.catch((err, ctx) => {
      console.error('💥 Ошибка Telegraf:', err);
    });
  }

  async launch() {
    this.validateConfiguration();
    await this.bot.launch();
    console.log('🚀 BreathingLeadBot запущен');
  }

  async stop(reason = 'unknown') {
    try {
      await this.bot.stop(reason);
      if (this.middleware?.stop) this.middleware.stop();
    } catch (error) {
      console.error('❌ Ошибка остановки:', error);
    }
  }

  validateConfiguration() {
    const token = process.env.LEAD_BOT_TOKEN
      || process.env.BOT_TOKEN
      || process.env.TOKEN
      || process.env.API_TOKEN
      || process.env.TELEGRAM_BOT_TOKEN
      || process.env.BOT_API_TOKEN;

    if (!token) throw new Error('Отсутствует LEAD_BOT_TOKEN');

    config.LEAD_BOT_TOKEN = token;
    if (!this.bot.token) {
      this.bot = new Telegraf(token);
      this.telegramBot = this.bot;
    }
    if (!config.ADMIN_ID) console.warn('⚠️ ADMIN_ID не настроен');
    console.log('✅ Конфигурация валидна');
  }

  getBotInfo() {
    return {
      name: 'BreathingLeadBot',
      version: '2.9.0',
      status: 'running',
      uptime: process.uptime(),
      landing_lead_watcher: 'active',
      leads_file: require('../modules/admin/landing_lead_watcher').readLeads
        ? Object.keys(require('../modules/admin/landing_lead_watcher').readLeads()).length
        : 0,
    };
  }

  async getAdminStats()    { return this.adminIntegration?.getExtendedStats() || null; }
  async createBackup()     { return this.adminIntegration?.createBackup() || null; }
  async runDiagnostics()   { return this.adminIntegration?.runDiagnostics() || null; }
  async cleanupOldData(d)  { return this.adminIntegration?.cleanupOldData(d) || null; }
  async sendAdminAlert(type, msg, data = {}) {
    if (!this.adminIntegration) return false;
    await this.adminIntegration.sendEmergencyAlert(type, msg, data);
    return true;
  }
  getAdminPanel()          { return this.adminIntegration; }
}

module.exports = BreathingLeadBot;
