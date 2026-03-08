// Файл: core/admin_integration.js - ОБНОВЛЕННАЯ ВЕРСИЯ v5.1
// Координирует работу всех модульных админ-компонентов с поддержкой уведомлений

const AdminHandlers = require('../modules/admin/admin_handlers');
const AdminCallbacks = require('../modules/admin/admin_callbacks');
const config = require('../config');

class AdminIntegration {
  constructor(botInstance) {
    this.bot = botInstance;
    this.telegramBot = botInstance.bot;
    this.adminId = config.ADMIN_ID;
    
    // ИСПРАВЛЕНО: Используем adminNotifications из botInstance вместо создания нового
    this.adminNotifications = botInstance.adminNotifications;
    
    // Получаем ссылки на существующие модули
    this.verseAnalysis = botInstance.verseAnalysis;
    this.leadTransfer = botInstance.leadTransfer;
    this.pdfManager = botInstance.pdfManager;
    
    // Инициализируем модульные админ-компоненты
    this.adminHandlers = null;
    this.adminCallbacks = null;
    
    // Статистика интеграции
    this.integrationStats = {
      initialized: false,
      startTime: new Date().toISOString(),
      totalAdminActions: 0,
      lastAction: null,
      errors: 0,
      moduleVersion: '5.1.0',
      architecture: 'modular_v3_with_notifications_fixed'
    };
  }

  // ===== ИНИЦИАЛИЗАЦИЯ =====

  initialize() {
    console.log('🎛️ Инициализация модульной админ-панели v5.1 с уведомлениями...');
    
    try {
      // Проверяем что adminNotifications существует
      if (!this.adminNotifications) {
        throw new Error('adminNotifications не передан из botInstance');
      }
      
      // Проверяем leadDataStorage
      if (!this.adminNotifications.leadDataStorage) {
        this.adminNotifications.leadDataStorage = {};
        console.log('⚠️ Инициализировано пустое leadDataStorage');
      }
      
      console.log('✅ Используем adminNotifications из botInstance (shared instance)');
      
      // Создаем модульные админ-компоненты
      this.createModularAdminComponents();
      
      // Настраиваем модули
      this.setupModularAdminComponents();
      
      // Запускаем планировщик
      this.startAdminScheduler();
      
      this.integrationStats.initialized = true;
      console.log('✅ Модульная админ-панель v5.1 готова к работе');
      
      // Выводим информацию о модулях
      this.logModularArchitectureInfo();
      
    } catch (error) {
      console.error('❌ Ошибка инициализации админ-панели v5.1:', error);
      this.integrationStats.errors++;
      this.sendEmergencyAlert('system_error', 'Ошибка инициализации админ-панели v5.1', { error: error.message });
    }
  }

  createModularAdminComponents() {
    console.log('📦 Создание модульных админ-компонентов v5.1...');
    
    // Создаем модульный AdminHandlers
    this.adminHandlers = new AdminHandlers(
      this.bot,
      this.adminNotifications,
      this.verseAnalysis,
      this.leadTransfer,
      this.pdfManager
    );
    console.log('✅ Модульный AdminHandlers создан');
    
    // Создаем модульный AdminCallbacks
    this.adminCallbacks = new AdminCallbacks(
      this.adminHandlers,
      this.adminNotifications,
      this.verseAnalysis,
      this.leadTransfer
    );
    console.log('✅ Модульный AdminCallbacks создан');
    
    console.log('✅ Все модульные админ-компоненты созданы');
  }

  setupModularAdminComponents() {
    console.log('⚙️ Настройка модульных админ-компонентов...');
    
    // Настраиваем модульные команды
    if (this.adminHandlers) {
      this.adminHandlers.setupCommands();
      console.log('✅ Модульные админ-команды настроены');
    }
    
    // Настраиваем модульные callbacks
    if (this.adminCallbacks) {
      this.adminCallbacks.setupCallbacks(this.telegramBot);
      console.log('✅ Модульные админ-callbacks настроены');
    }
  }

  logModularArchitectureInfo() {
    console.log('🏗️ ИНФОРМАЦИЯ О МОДУЛЬНОЙ АРХИТЕКТУРЕ v5.1:');
    console.log('📊 Handlers модули:');
    console.log('   - MainHandler: основные команды + управление уведомлениями');
    console.log('   - StatsHandler: статистика и аналитика');
    console.log('   - LeadsHandler: работа с лидами');
    console.log('   - SystemHandler: системные функции');
    console.log('📋 Callbacks модули:');
    console.log('   - NavigationCallbacks: навигация + переключение уведомлений');
    console.log('   - StatsCallbacks: статистика');
    console.log('   - LeadsCallbacks: лиды');
    console.log('   - SystemCallbacks: система');
    console.log('🔔 Notifications модули:');
    console.log('   - NotificationSystem: основная система с режимами (SHARED INSTANCE)');
    console.log('   - NotificationTemplates: шаблоны');
    console.log('   - NotificationHandlers: обработчики');
    console.log('   - NotificationFormatters: форматирование');
    console.log('   - NotificationAnalytics: аналитика');
  }

  // ===== ОСНОВНОЙ ОБРАБОТЧИК АДМИН-CALLBACK'ОВ =====

  async handleAdminCallback(ctx, callbackData) {
  try {
    // answerCbQuery УЖЕ вызван в bot.action — не вызываем снова!

    this.trackAdminAction(callbackData, ctx.from.id);
    console.log(`🔍 Admin callback integration v5.1: ${callbackData}`);

    if (!this.adminCallbacks) {
      console.error('❌ AdminCallbacks не инициализирован');
      return;
    }

    await this.adminCallbacks.handleCallback(ctx, callbackData);

  } catch (error) {
    console.error('❌ Ошибка handleAdminCallback в интеграции v5.1:', error);
    this.integrationStats.errors++;
    // Уже ответили в bot.action — просто логируем
  }
}

  // ===== ОБРАБОТКА АДМИН-КОМАНД =====

  async handleAdminCommand(ctx, commandName) {
    if (!this.adminId) {
      await ctx.reply('Админ-панель не настроена');
      return;
    }

    if (ctx.from.id.toString() !== this.adminId) {
      await ctx.reply('🚫 Доступ запрещен');
      return;
    }

    try {
      this.trackAdminAction(commandName, ctx.from.id);
      
      console.log(`🔍 Admin command integration v5.1: ${commandName}`);
      
      // Передаем обработку в модульный AdminHandlers
      if (this.adminHandlers) {
        await this.adminHandlers.handleCommand(ctx, commandName);
      } else {
        console.error('❌ Модульный AdminHandlers не инициализирован');
        await ctx.reply('Админ-панель временно недоступна');
      }
      
    } catch (error) {
      console.error('❌ Ошибка handleAdminCommand в интеграции v5.1:', error);
      this.integrationStats.errors++;
      
      await ctx.reply('Произошла ошибка при выполнении команды');
      await this.sendEmergencyAlert('admin_error', `Ошибка admin command v5.1: ${error.message}`, {
        command: commandName,
        user_id: ctx.from.id,
        error_stack: error.stack,
        architecture: 'modular_v3_with_notifications_fixed'
      });
    }
  }

  // ===== МЕТОДЫ УВЕДОМЛЕНИЙ =====

  /**
   * Уведомляет администратора о новом лиде
   */
  async notifyNewLead(userData) {
    try {
      await this.adminNotifications.notifyNewLead(userData);
    } catch (error) {
      console.error('❌ Ошибка уведомления о новом лиде:', error);
      this.integrationStats.errors++;
    }
  }

  /**
   * Уведомляет администратора о результатах анкетирования
   */
  async notifySurveyResults(userData) {
    try {
      await this.adminNotifications.notifySurveyResults(userData);
    } catch (error) {
      console.error('❌ Ошибка уведомления о результатах анкетирования:', error);
      this.integrationStats.errors++;
    }
  }

  /**
   * Получает текущий режим уведомлений
   */
  getNotificationMode() {
    return this.adminNotifications?.getNotificationMode?.() || {
      mode: 'unknown',
      description: 'Система уведомлений недоступна',
      emoji: '❓'
    };
  }

  /**
   * Переключает режим уведомлений
   */
  toggleNotificationMode() {
    try {
      return this.adminNotifications?.toggleNotificationMode?.() || null;
    } catch (error) {
      console.error('❌ Ошибка переключения режима уведомлений:', error);
      return null;
    }
  }

  // ===== ДИАГНОСТИКА И МОНИТОРИНГ =====

  async runDiagnostics() {
    const results = {
      timestamp: new Date().toISOString(),
      overall_status: 'UNKNOWN',
      version: '5.1.0',
      architecture: 'modular_v3_with_notifications_fixed',
      checks: {}
    };

    try {
      // Проверка интеграции
      results.checks.admin_integration = {
        status: this.integrationStats.initialized ? 'OK' : 'ERROR',
        message: `Интеграция v5.1 ${this.integrationStats.initialized ? 'активна' : 'не инициализирована'}`
      };

      // Проверка модульных компонентов
      results.checks.modular_handlers = {
        status: (this.adminHandlers) ? 'OK' : 'ERROR',
        message: `Модульные Handlers: ${!!this.adminHandlers}`
      };

      results.checks.modular_callbacks = {
        status: (this.adminCallbacks) ? 'OK' : 'ERROR',
        message: `Модульные Callbacks: ${!!this.adminCallbacks}`
      };

      // Проверка системы уведомлений
      results.checks.notification_system = {
        status: (this.adminNotifications && this.adminNotifications.templates) ? 'OK' : 'ERROR',
        message: `Система уведомлений (shared): ${!!this.adminNotifications}, Templates: ${!!this.adminNotifications?.templates}`
      };

      // Проверка режимов уведомлений
      const notificationMode = this.getNotificationMode();
      results.checks.notification_modes = {
        status: notificationMode.mode !== 'unknown' ? 'OK' : 'WARNING',
        message: `Режим уведомлений: ${notificationMode.emoji} ${notificationMode.mode}`
      };

      // Проверка данных
      const leadsCount = Object.keys(this.adminNotifications.leadDataStorage || {}).length;
      results.checks.data_integrity = {
        status: 'OK',
        message: `Доступ к ${leadsCount} лидам (shared storage)`
      };

      // Проверка конфигурации
      results.checks.configuration = {
        status: this.adminId ? 'OK' : 'WARNING',
        message: this.adminId ? 'ADMIN_ID настроен' : 'ADMIN_ID отсутствует'
      };

      // Проверка памяти
      const memUsage = process.memoryUsage();
      const memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      results.checks.memory = {
        status: memoryMB < 500 ? 'OK' : memoryMB < 1000 ? 'WARNING' : 'ERROR',
        message: `Использовано ${memoryMB}MB памяти`
      };

      // Проверка аналитики уведомлений
      const analytics = this.adminNotifications.analytics?.getStats();
      results.checks.notification_analytics = {
        status: analytics ? 'OK' : 'WARNING',
        message: analytics ? `Аналитика активна, отправлено: ${analytics.notifications?.totalSent || 0}` : 'Аналитика недоступна'
      };

      // Проверка модульной архитектуры
      const moduleCount = this.getModuleCount();
      results.checks.module_architecture = {
        status: moduleCount >= 13 ? 'OK' : 'WARNING',
        message: `Загружено модулей: ${moduleCount}/13 ожидаемых`
      };

      // Определяем общий статус
      const statuses = Object.values(results.checks).map(check => check.status);
      if (statuses.includes('ERROR')) {
        results.overall_status = 'ERROR';
      } else if (statuses.includes('WARNING')) {
        results.overall_status = 'WARNING';
      } else {
        results.overall_status = 'OK';
      }

    } catch (error) {
      results.overall_status = 'ERROR';
      results.error = error.message;
    }

    return results;
  }

  getModuleCount() {
    let count = 0;
    
    // Считаем модули handlers
    if (this.adminHandlers?.mainHandler) count++;
    if (this.adminHandlers?.statsHandler) count++;
    if (this.adminHandlers?.leadsHandler) count++;
    if (this.adminHandlers?.systemHandler) count++;
    
    // Считаем модули callbacks
    if (this.adminCallbacks?.navigationCallbacks) count++;
    if (this.adminCallbacks?.statsCallbacks) count++;
    if (this.adminCallbacks?.leadsCallbacks) count++;
    if (this.adminCallbacks?.systemCallbacks) count++;
    
    // Считаем модули notifications
    if (this.adminNotifications?.templates) count++;
    if (this.adminNotifications?.handlers) count++;
    if (this.adminNotifications?.formatters) count++;
    if (this.adminNotifications?.analytics) count++;
    
    // Основная система уведомлений
    if (this.adminNotifications) count++;
    
    return count;
  }

  async getSystemHealthOverview() {
    const baseHealth = {
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      cpu_usage: process.cpuUsage(),
      admin_panel_status: this.integrationStats.initialized ? 'active' : 'inactive',
      version: '5.1.0',
      architecture: 'modular_v3_with_notifications_fixed',
      integrations: {
        main_bot: !!config.MAIN_BOT_API_URL,
        crm: !!config.CRM_WEBHOOK_URL,
        database: !!config.DATABASE_URL
      }
    };

    // Добавляем информацию о модульных компонентах
    baseHealth.modular_components = {
      handlers: {
        loaded: !!this.adminHandlers,
        modules: this.adminHandlers ? {
          main: !!this.adminHandlers.mainHandler,
          stats: !!this.adminHandlers.statsHandler,
          leads: !!this.adminHandlers.leadsHandler,
          system: !!this.adminHandlers.systemHandler
        } : null
      },
      callbacks: {
        loaded: !!this.adminCallbacks,
        modules: this.adminCallbacks ? {
          navigation: !!this.adminCallbacks.navigationCallbacks,
          stats: !!this.adminCallbacks.statsCallbacks,
          leads: !!this.adminCallbacks.leadsCallbacks,
          system: !!this.adminCallbacks.systemCallbacks
        } : null
      },
      notifications: {
        loaded: !!this.adminNotifications,
        shared_instance: true,
        current_mode: this.getNotificationMode(),
        modules: this.adminNotifications ? {
          templates: !!this.adminNotifications.templates,
          handlers: !!this.adminNotifications.handlers,
          formatters: !!this.adminNotifications.formatters,
          analytics: !!this.adminNotifications.analytics
        } : null
      }
    };

    return baseHealth;
  }

  // ===== СТАТИСТИКА И АНАЛИТИКА =====

  getExtendedStats() {
    const baseStats = this.adminNotifications?.getStats() || {};
    
    // Получаем агрегированную статистику от модульных компонентов
    const aggregatedHandlerStats = this.adminHandlers?.getAggregatedStats() || {};
    const aggregatedCallbackStats = this.adminCallbacks?.getCallbackStats() || {};
    
    // Получаем детальную аналитику уведомлений
    const notificationAnalytics = this.adminNotifications?.analytics?.getDetailedAnalytics() || {};

    return {
      ...baseStats,
      admin_integration: this.integrationStats,
      
      // Модульная статистика
      modular_handlers: aggregatedHandlerStats,
      modular_callbacks: aggregatedCallbackStats,
      
      // Детальная аналитика уведомлений
      notification_analytics: notificationAnalytics,
      
      // Общая информация о системе
      system_health: this.getSystemHealthOverview(),
      
      // Информация об архитектуре
      architecture_info: {
        version: '5.1.0',
        type: 'modular_v3_with_notifications_fixed',
        total_modules: this.getModuleCount(),
        handlers_modules: 4,
        callbacks_modules: 4,
        notifications_modules: 5,
        shared_notifications_instance: true
      },
      
      timestamp: new Date().toISOString()
    };
  }

  trackAdminAction(action, userId) {
    this.integrationStats.totalAdminActions++;
    this.integrationStats.lastAction = {
      action: action,
      user_id: userId,
      timestamp: new Date().toISOString(),
      architecture: 'modular_v3_with_notifications_fixed'
    };
    
    console.log(`📊 Admin action tracked v5.1: ${action} by ${userId} (total: ${this.integrationStats.totalAdminActions})`);
  }

  // ===== ПЛАНИРОВЩИК И АВТОМАТИЗАЦИЯ =====

  startAdminScheduler() {
    console.log('⏰ Запуск планировщика админ-задач v5.1...');
    
    // Ежечасная проверка системы
    setInterval(async () => {
      try {
        const diagnostics = await this.runDiagnostics();
        if (diagnostics.overall_status === 'ERROR') {
          await this.sendEmergencyAlert('system_error', 'Обнаружены критические ошибки модульной системы v5.1', diagnostics);
        }
      } catch (error) {
        console.error('❌ Ошибка планировщика диагностики v5.1:', error);
      }
    }, 3600000); // Каждый час

    // Ежедневная отправка сводки в 9:00
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 9 && now.getMinutes() === 0) {
        await this.adminNotifications.sendDailySummary();
      }
    }, 60000); // Проверяем каждую минуту

    // Еженедельная очистка данных
    setInterval(async () => {
      try {
        const cleanupResult = await this.cleanupOldData(30);
        console.log('🧹 Еженедельная очистка v5.1:', cleanupResult);
      } catch (error) {
        console.error('❌ Ошибка планировщика очистки v5.1:', error);
      }
    }, 7 * 24 * 3600000); // Каждую неделю

    console.log('✅ Планировщик админ-задач v5.1 запущен');
  }

  // ===== ЭКСТРЕННЫЕ УВЕДОМЛЕНИЯ =====

  async sendEmergencyAlert(alertType, message, additionalData = {}) {
    if (!this.adminId) return;

    const alertEmojis = {
      'system_error': '🚨',
      'admin_error': '⚠️',
      'high_load': '⚡',
      'data_corruption': '💥',
      'security_issue': '🛡️',
      'critical_lead': '🔥',
      'module_error': '🔧',
      'notification_error': '🔔'
    };

    const emoji = alertEmojis[alertType] || '⚠️';
    
    try {
      const alertMessage = `${emoji} *ЭКСТРЕННОЕ УВЕДОМЛЕНИЕ v5.1*\n\n` +
        `**Архитектура:** Модульная v3 (fixed shared instance)\n` +
        `**Тип:** ${alertType}\n` +
        `**Сообщение:** ${message}\n\n` +
        `**Детали:**\n\`\`\`\n${JSON.stringify(additionalData, null, 2)}\n\`\`\`\n\n` +
        `🕐 ${new Date().toLocaleString('ru-RU')}`;

      await this.telegramBot.telegram.sendMessage(this.adminId, alertMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔧 Диагностика', callback_data: 'admin_detailed_diagnostics' },
              { text: '🎛️ Админ-панель', callback_data: 'admin_main' }
            ]
          ]
        }
      });

    } catch (error) {
      console.error('❌ Ошибка отправки экстренного уведомления v5.1:', error);
    }
  }

  // ===== РЕЗЕРВНОЕ КОПИРОВАНИЕ И ОЧИСТКА =====

  async createBackup() {
    try {
      const backup = {
        timestamp: new Date().toISOString(),
        version: '5.1.0',
        architecture: 'modular_v3_with_notifications_fixed',
        leads_data: this.adminNotifications.leadDataStorage || {},
        integration_stats: this.integrationStats,
        
        // Модульная статистика
        modular_stats: this.getExtendedStats(),
        
        // Аналитика уведомлений
        notification_analytics: this.adminNotifications.analytics?.exportAllData() || {},
        
        // Настройки уведомлений
        notification_settings: {
          current_mode: this.getNotificationMode(),
          settings: this.adminNotifications?.getStats()?.settings || {}
        },
        
        configuration: {
          admin_id: this.adminId,
          main_bot_url: config.MAIN_BOT_API_URL,
          crm_webhook: config.CRM_WEBHOOK_URL,
          trainer_contact: config.TRAINER_CONTACT
        },
        
        metadata: {
          total_leads: Object.keys(this.adminNotifications.leadDataStorage || {}).length,
          total_modules: this.getModuleCount(),
          backup_size: 0,
          created_by: 'admin_integration_v5.1_fixed_shared_instance'
        }
      };

      const backupString = JSON.stringify(backup, null, 2);
      backup.metadata.backup_size = Buffer.byteLength(backupString, 'utf8');

      return backup;
    } catch (error) {
      console.error('❌ Ошибка создания резервной копии v5.1:', error);
      throw error;
    }
  }

  async cleanupOldData(daysToKeep = 30) {
    try {
      // Очистка через модульную систему уведомлений
      const cleanupResult = this.adminNotifications.cleanupOldData(daysToKeep);

      // Добавляем информацию о модульной архитектуре
      cleanupResult.architecture = 'modular_v3_with_notifications_fixed';
      cleanupResult.version = '5.1.0';
      cleanupResult.modules_count = this.getModuleCount();

      console.log(`🧹 Очистка данных v5.1 завершена:`, cleanupResult);

      return cleanupResult;

    } catch (error) {
      console.error('❌ Ошибка очистки данных v5.1:', error);
      return { error: error.message, version: '5.1.0' };
    }
  }

  // ===== ИНФОРМАЦИЯ О ИНТЕГРАЦИИ =====

  getIntegrationInfo() {
    return {
      name: 'AdminIntegration',
      version: '5.1.0',
      architecture: 'modular_v3_with_notifications_fixed',
      status: this.integrationStats.initialized ? 'active' : 'inactive',
      features: [
        'modular_architecture_v3',
        'modular_handlers',
        'modular_callbacks',
        'notification_system_v4',
        'shared_notifications_instance',
        'notification_modes_management',
        'test_notifications',
        'command_routing',
        'callback_routing',
        'aggregated_analytics',
        'comprehensive_reporting',
        'module_diagnostics',
        'automated_scheduling',
        'emergency_alerts',
        'data_backup',
        'cleanup_automation',
        'notification_analytics'
      ],
      modules: {
        handlers: {
          loaded: !!this.adminHandlers,
          count: 4,
          modules: ['main', 'stats', 'leads', 'system']
        },
        callbacks: {
          loaded: !!this.adminCallbacks,
          count: 4,
          modules: ['navigation', 'stats', 'leads', 'system']
        },
        notifications: {
          loaded: !!this.adminNotifications,
          shared_instance: true,
          count: 5,
          modules: ['system', 'templates', 'handlers', 'formatters', 'analytics'],
          current_mode: this.getNotificationMode()
        }
      },
      total_modules: this.getModuleCount(),
      statistics: this.integrationStats,
      health_status: 'healthy',
      last_updated: new Date().toISOString()
    };
  }

  // ===== БЕЗОПАСНОЕ ЗАВЕРШЕНИЕ РАБОТЫ =====

  async shutdown() {
    try {
      console.log('🔄 Завершение работы AdminIntegration v5.1...');
      
      // Создаем резервную копию
      const backup = await this.createBackup();
      console.log('💾 Резервная копия v5.1 создана');
      
      // Очищаем модульные компоненты
      if (this.adminHandlers) {
        this.adminHandlers.cleanup();
      }
      
      if (this.adminCallbacks) {
        this.adminCallbacks.cleanup();
      }
      
      // Очищаем модульную систему уведомлений
      if (this.adminNotifications?.handlers) {
        this.adminNotifications.handlers.cleanup();
      }
      
      // Отправляем финальное уведомление админу
      if (this.adminId) {
        const notificationMode = this.getNotificationMode();
        
        await this.telegramBot.telegram.sendMessage(
          this.adminId,
          `🔄 *Завершение работы модульной админ-панели v5.1*\n\n` +
          `**Архитектура:** Модульная v3 (fixed shared instance)\n` +
          `Резервная копия создана\n` +
          `Всего лидов: ${backup.metadata.total_leads}\n` +
          `Модулей загружено: ${backup.metadata.total_modules}/13\n` +
          `Админ-действий: ${this.integrationStats.totalAdminActions}\n` +
          `Время работы: ${this.formatUptime(process.uptime())}\n` +
          `Уведомлений отправлено: ${this.adminNotifications.analytics?.getStats()?.notifications?.totalSent || 0}\n` +
          `Режим уведомлений: ${notificationMode.emoji} ${notificationMode.mode}\n\n` +
          `🕐 ${new Date().toLocaleString('ru-RU')}`,
          { parse_mode: 'Markdown' }
        );
      }
      
      console.log('✅ AdminIntegration v5.1 завершил работу');
      
    } catch (error) {
      console.error('❌ Ошибка при завершении AdminIntegration v5.1:', error);
    }
  }

  // ===== УТИЛИТЫ =====

  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}д ${remainingHours}ч ${minutes}м`;
    }
    
    return `${hours}ч ${minutes}м ${secs}с`;
  }

  // ===== МЕТОДЫ ДЛЯ ВНЕШНЕГО ИСПОЛЬЗОВАНИЯ =====

  isReady() {
    return this.integrationStats.initialized && 
           this.adminHandlers && 
           this.adminCallbacks && 
           this.adminNotifications &&
           this.getModuleCount() >= 10; // Минимум 10 модулей должно быть загружено
  }

  getStatus() {
    const notificationMode = this.getNotificationMode();
    
    return {
      ready: this.isReady(),
      version: '5.1.0',
      architecture: 'modular_v3_with_notifications_fixed',
      admin_id: this.adminId,
      modules_loaded: {
        handlers: !!this.adminHandlers,
        callbacks: !!this.adminCallbacks,
        notifications: !!this.adminNotifications,
        notification_analytics: !!this.adminNotifications?.analytics
      },
      notification_system: {
        shared_instance: true,
        current_mode: notificationMode,
        modes_available: ['silent', 'filtered', 'test_mode', 'all_notifications'],
        test_mode: this.adminNotifications?.testMode || false,
        filter_admin: this.adminNotifications?.filterAdminResponses || false,
        silent_mode: this.adminNotifications?.silentMode || false
      },
      module_count: this.getModuleCount(),
      total_actions: this.integrationStats.totalAdminActions,
      last_action: this.integrationStats.lastAction,
      errors: this.integrationStats.errors
    };
  }

  // ===== МЕТОДЫ УПРАВЛЕНИЯ УВЕДОМЛЕНИЯМИ (для внешнего доступа) =====

  /**
   * Включает тестовый режим уведомлений
   */
  enableTestMode() {
    return this.adminNotifications?.enableTestMode() || null;
  }

  /**
   * Отключает тестовый режим уведомлений
   */
  disableTestMode() {
    return this.adminNotifications?.disableTestMode() || null;
  }

  /**
   * Включает фильтр администратора
   */
  enableAdminFilter() {
    return this.adminNotifications?.enableAdminFilter() || null;
  }

  /**
   * Отключает фильтр администратора
   */
  disableAdminFilter() {
    return this.adminNotifications?.disableAdminFilter() || null;
  }

  /**
   * Включает тихий режим
   */
  enableSilentMode() {
    return this.adminNotifications?.enableSilentMode() || null;
  }

  /**
   * Отключает тихий режим
   */
  disableSilentMode() {
    return this.adminNotifications?.disableSilentMode() || null;
  }

  /**
   * Отправляет тестовое уведомление
   */
  async sendTestNotification() {
    if (!this.adminNotifications) {
      throw new Error('Система уведомлений недоступна');
    }
    return await this.adminNotifications.sendTestNotification();
  }

  /**
   * Получает статистику уведомлений
   */
  getNotificationStats() {
    return this.adminNotifications?.getStats() || null;
  }

  /**
   * Получает настройки уведомлений для экспорта
   */
  exportNotificationSettings() {
    if (!this.adminNotifications) return null;
    
    return {
      current_mode: this.getNotificationMode(),
      settings: {
        test_mode: this.adminNotifications.testMode,
        filter_admin_responses: this.adminNotifications.filterAdminResponses,
        silent_mode: this.adminNotifications.silentMode,
        notifications_enabled: this.adminNotifications.enableNotifications
      },
      admin_id: this.adminNotifications.adminId,
      stats: this.adminNotifications.getStats(),
      exported_at: new Date().toISOString()
    };
  }
}

module.exports = AdminIntegration;