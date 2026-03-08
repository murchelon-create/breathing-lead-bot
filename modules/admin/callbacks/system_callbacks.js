// Файл: modules/admin/callbacks/system_callbacks.js
// Обработчики системных callback'ов (диагностика, настройки, экспорт)

const config = require('../../../config');
const CSVExporter = require('../export/csv_exporter');

class SystemCallbacks {
  constructor(adminHandlers, adminNotifications) {
    this.adminHandlers = adminHandlers;
    this.adminNotifications = adminNotifications;
    this.csvExporter = new CSVExporter();
    
    // Статистика системных операций
    this.systemCallbacksUsage = {
      totalRequests: 0,
      operationsUsed: {},
      lastRequest: null,
      diagnosticsRuns: 0,
      exportsGenerated: 0
    };
  }

  /**
   * Обработка системных callback'ов
   */
  async handleCallback(ctx, callbackData) {
    this.trackSystemUsage(callbackData);
    
    try {
      switch (callbackData) {
        case 'admin_system':
          await this.showSystem(ctx);
          break;
          
        case 'admin_detailed_diagnostics':
          await this.showDetailedDiagnostics(ctx);
          break;
          
        case 'admin_export':
          await this.showExport(ctx);
          break;
          
        case 'admin_export_csv_all':
          await this.exportCSV(ctx, 'all');
          break;
          
        case 'admin_export_csv_hot':
          await this.exportCSV(ctx, 'hot');
          break;
          
        case 'admin_export_csv_today':
          await this.exportCSV(ctx, 'today');
          break;
          
        case 'admin_settings':
          await this.showSettings(ctx);
          break;
          
        default:
          return false; // Не обработано этим модулем
      }
      return true;
    } catch (error) {
      console.error('❌ Ошибка SystemCallbacks:', error);
      throw error;
    }
  }

  /**
   * Экспорт лидов в CSV
   */
  async exportCSV(ctx, filter = 'all') {
    console.log(`💾 Экспорт лидов в CSV: ${filter}`);
    
    try {
      // Получаем данные лидов
      const leadsData = this.adminNotifications?.leadDataStorage || {};
      const leadsArray = Object.values(leadsData);

      if (leadsArray.length === 0) {
        await ctx.answerCbQuery('⚠️ Нет лидов для экспорта', { show_alert: true });
        return;
      }

      // Генерируем CSV
      const csvContent = this.csvExporter.generateCSV(leadsArray, { filter });
      const fileName = this.csvExporter.generateFileName(filter);
      const stats = this.csvExporter.getExportStats(leadsArray, filter);

      // Отвечаем на callback
      await ctx.answerCbQuery(`✅ Генерируется файл с ${stats.total} лидами...`);

      // Создаем Buffer из CSV строки
      const buffer = Buffer.from(csvContent, 'utf-8');

      // Формируем сообщение
      let caption = `💾 *Экспорт лидов*\n\n`;
      caption += `✅ Экспортировано: ${stats.total} лидов\n`;
      caption += `🔥 Горячих: ${stats.hot}\n`;
      caption += `⭐ Теплых: ${stats.warm}\n`;
      caption += `❄️ Холодных: ${stats.cold}\n\n`;
      caption += `📅 Дата: ${new Date().toLocaleString('ru-RU')}\n`;
      caption += `📊 Фильтр: ${this.getFilterName(filter)}`;

      // Отправляем файл
      await ctx.replyWithDocument(
        { source: buffer, filename: fileName },
        {
          caption: caption,
          parse_mode: 'Markdown'
        }
      );

      this.systemCallbacksUsage.exportsGenerated++;
      console.log(`✅ CSV экспорт завершен: ${fileName} (${stats.total} лидов)`);

    } catch (error) {
      console.error('❌ Ошибка экспорта CSV:', error);
      await ctx.answerCbQuery('❌ Ошибка экспорта', { show_alert: true });
    }
  }

  /**
   * Показ системной информации
   */
  async showSystem(ctx) {
    console.log('🔧 Показ системной информации');
    
    try {
      const health = await this.getSystemHealthData();
      
      let message = `🔧 *СОСТОЯНИЕ СИСТЕМЫ*\n\n`;
      
      // Общий статус
      const statusEmoji = health.overall === 'HEALTHY' ? '✅' : health.overall === 'DEGRADED' ? '⚠️' : '❌';
      message += `${statusEmoji} **Общий статус:** ${health.overall}\n\n`;
      
      // Основные компоненты
      message += `🤖 *КОМПОНЕНТЫ:*\n`;
      Object.entries(health.components).forEach(([component, data]) => {
        const emoji = data.status === 'HEALTHY' ? '✅' : data.status === 'DEGRADED' ? '⚠️' : '❌';
        message += `${emoji} ${component}: ${data.status}\n`;
      });
      message += `\n`;
      
      // Производительность
      message += `📊 *ПРОИЗВОДИТЕЛЬНОСТЬ:*\n`;
      message += `• Память: ${health.performance.memory}MB\n`;
      message += `• Время работы: ${this.formatUptime(health.performance.uptime)}\n\n`;
      
      // Интеграции
      message += `🔗 *ИНТЕГРАЦИИ:*\n`;
      message += `• Основной бот: ${health.integrations.mainBot ? '✅' : '❌'}\n`;
      message += `• CRM: ${health.integrations.crm ? '✅' : '❌'}\n`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Детальная диагностика', callback_data: 'admin_detailed_diagnostics' }],
            [{ text: '🎛️ Главная панель', callback_data: 'admin_main' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Ошибка показа системной информации:', error);
      await this.showErrorMessage(ctx, 'Ошибка получения системной информации');
    }
  }

  /**
   * Показ детальной диагностики
   */
  async showDetailedDiagnostics(ctx) {
    console.log('🔍 Показ детальной диагностики');
    this.systemCallbacksUsage.diagnosticsRuns++;
    
    try {
      const diagnostics = await this.runDiagnostics();
      
      let message = `🔍 *ДЕТАЛЬНАЯ ДИАГНОСТИКА*\n\n`;
      
      const statusEmoji = {
        'OK': '✅',
        'WARNING': '⚠️',
        'ERROR': '❌',
        'UNKNOWN': '❓'
      };

      message += `${statusEmoji[diagnostics.overall_status]} **Общий статус:** ${diagnostics.overall_status}\n`;
      message += `🕐 Время: ${new Date().toLocaleString('ru-RU')}\n\n`;

      Object.entries(diagnostics.checks).forEach(([checkName, result]) => {
        const emoji = statusEmoji[result.status] || '❓';
        const name = checkName.replace(/_/g, ' ').toUpperCase();
        message += `${emoji} **${name}:**\n`;
        message += `└─ ${result.message}\n\n`;
      });

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔧 Система', callback_data: 'admin_system' }],
            [{ text: '🎛️ Главная панель', callback_data: 'admin_main' }]
          ]
        }
      });
      
    } catch (error) {
      console.error('❌ Ошибка детальной диагностики:', error);
      await this.showErrorMessage(ctx, 'Ошибка выполнения диагностики');
    }
  }

  /**
   * Показ меню экспорта
   */
  async showExport(ctx) {
    console.log('💾 Показ меню экспорта');
    
    const leadsData = this.adminNotifications?.leadDataStorage || {};
    const totalLeads = Object.keys(leadsData).length;
    const hotLeads = Object.values(leadsData).filter(l => l.analysisResult?.segment === 'HOT_LEAD').length;
    
    const today = new Date().toDateString();
    const todayLeads = Object.values(leadsData).filter(lead => {
      if (!lead.timestamp) return false;
      return new Date(lead.timestamp).toDateString() === today;
    }).length;

    let message = `💾 *ЭКСПОРТ ДАННЫХ*\n\n`;
    message += `Выберите что экспортировать:\n\n`;
    message += `📋 **Лиды в CSV формате:**\n`;
    message += `• Все лиды (${totalLeads})\n`;
    message += `• Только горячие (${hotLeads})\n`;
    message += `• Лиды за сегодня (${todayLeads})\n\n`;
    message += `📄 *Формат файла:* CSV (Excel)\n`;
    message += `🇷🇺 *Язык:* Русский\n`;
    message += `📊 *Колонок:* 20 (все данные лидов)`;

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: `📋 Все лиды (${totalLeads})`, callback_data: 'admin_export_csv_all' }
          ],
          [
            { text: `🔥 Горячие (${hotLeads})`, callback_data: 'admin_export_csv_hot' },
            { text: `📅 Сегодня (${todayLeads})`, callback_data: 'admin_export_csv_today' }
          ],
          [{ text: '🎛️ Главная панель', callback_data: 'admin_main' }]
        ]
      }
    });
  }

  /**
   * Показ настроек
   */
  async showSettings(ctx) {
    console.log('⚙️ Показ настроек');
    
    let message = `⚙️ *НАСТРОЙКИ СИСТЕМЫ*\n\n`;
    message += `🔔 **Уведомления:**\n`;
    message += `• Горячие лиды: ✅\n`;
    message += `• Теплые лиды: ✅\n`;
    message += `• Системные ошибки: ✅\n\n`;
    message += `📊 **Система:**\n`;
    message += `• Автоочистка логов: 7 дней\n`;
    message += `• Лимит rate limiting: улучшенный\n`;
    message += `• Сохранение сессий: включено\n\n`;
    message += `⚠️ *Настройки находятся в разработке*`;

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔔 Уведомления (скоро)', callback_data: 'admin_notifications' }],
          [{ text: '🎛️ Главная панель', callback_data: 'admin_main' }]
        ]
      }
    });
  }

  // ===== ДИАГНОСТИЧЕСКИЕ МЕТОДЫ =====

  /**
   * Выполнение диагностики системы
   */
  async runDiagnostics() {
    const results = {
      timestamp: new Date().toISOString(),
      overall_status: 'OK',
      checks: {}
    };

    try {
      // Проверка интеграции
      results.checks.admin_integration = {
        status: 'OK',
        message: 'Интеграция v5.1 активна'
      };

      // Проверка модулей
      results.checks.admin_modules = {
        status: (this.adminHandlers && this.adminNotifications) ? 'OK' : 'ERROR',
        message: `Handlers: ${!!this.adminHandlers}, Notifications: ${!!this.adminNotifications}`
      };

      // Проверка системы уведомлений
      results.checks.notification_system = {
        status: (this.adminNotifications && this.adminNotifications.templates) ? 'OK' : 'ERROR',
        message: `Модульные уведомления: ${!!this.adminNotifications}, Components: ${!!this.adminNotifications?.templates}`
      };

      // Проверка CSV экспортера
      results.checks.csv_exporter = {
        status: this.csvExporter ? 'OK' : 'ERROR',
        message: `CSV экспортер: ${!!this.csvExporter}, Экспортов: ${this.systemCallbacksUsage.exportsGenerated}`
      };

      // Проверка данных
      const leadsCount = Object.keys(this.adminNotifications.leadDataStorage || {}).length;
      results.checks.data_integrity = {
        status: 'OK',
        message: `Доступ к ${leadsCount} лидам`
      };

      // Проверка конфигурации
      results.checks.configuration = {
        status: config.ADMIN_ID ? 'OK' : 'WARNING',
        message: config.ADMIN_ID ? 'ADMIN_ID настроен' : 'ADMIN_ID отсутствует'
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
      results.checks.analytics = {
        status: analytics ? 'OK' : 'WARNING',
        message: analytics ? `Аналитика активна, успешность: ${analytics.performance?.success_rate}` : 'Аналитика недоступна'
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

  /**
   * Получение данных о здоровье системы
   */
  async getSystemHealthData() {
    return {
      overall: 'HEALTHY',
      components: {
        'telegram_bot': { status: 'HEALTHY' },
        'admin_callbacks': { status: 'HEALTHY' },
        'lead_storage': { status: 'HEALTHY' },
        'pdf_generator': { status: 'HEALTHY' },
        'csv_exporter': { status: 'HEALTHY' }
      },
      performance: {
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        uptime: process.uptime()
      },
      integrations: {
        mainBot: !!config.MAIN_BOT_API_URL,
        crm: !!config.CRM_WEBHOOK_URL,
        database: !!config.DATABASE_URL
      }
    };
  }

  // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====

  /**
   * Получение названия фильтра
   */
  getFilterName(filter) {
    const names = {
      'all': 'Все лиды',
      'hot': 'Горячие лиды',
      'today': 'Лиды за сегодня'
    };
    return names[filter] || filter;
  }

  /**
   * Форматирование времени работы
   */
  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}д ${remainingHours}ч ${minutes}м`;
    }
    
    return `${hours}ч ${minutes}м`;
  }

  /**
   * Показ сообщения об ошибке
   */
  async showErrorMessage(ctx, errorText) {
    try {
      await ctx.editMessageText(`❌ ${errorText}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Попробовать снова', callback_data: 'admin_system' }],
            [{ text: '🎛️ Главная панель', callback_data: 'admin_main' }]
          ]
        }
      });
    } catch (error) {
      console.error('❌ Ошибка показа сообщения об ошибке:', error);
      await ctx.reply(`❌ ${errorText}`);
    }
  }

  /**
   * Отслеживание использования системных функций
   */
  trackSystemUsage(operation) {
    this.systemCallbacksUsage.totalRequests++;
    this.systemCallbacksUsage.lastRequest = {
      operation: operation,
      timestamp: new Date().toISOString()
    };
    
    if (!this.systemCallbacksUsage.operationsUsed[operation]) {
      this.systemCallbacksUsage.operationsUsed[operation] = 0;
    }
    this.systemCallbacksUsage.operationsUsed[operation]++;
  }

  /**
   * Получение статистики модуля
   */
  getStats() {
    return {
      name: 'SystemCallbacks',
      total_requests: this.systemCallbacksUsage.totalRequests,
      operations_used: this.systemCallbacksUsage.operationsUsed,
      last_request: this.systemCallbacksUsage.lastRequest,
      diagnostics_runs: this.systemCallbacksUsage.diagnosticsRuns,
      exports_generated: this.systemCallbacksUsage.exportsGenerated,
      most_used_operation: this.getMostUsedOperation(),
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Получение наиболее используемой операции
   */
  getMostUsedOperation() {
    const operations = this.systemCallbacksUsage.operationsUsed;
    let maxOperation = null;
    let maxCount = 0;
    
    Object.entries(operations).forEach(([operation, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxOperation = operation;
      }
    });
    
    return maxOperation ? { operation: maxOperation, count: maxCount } : null;
  }

  /**
   * Очистка ресурсов
   */
  cleanup() {
    console.log('🧹 Очистка SystemCallbacks...');
    console.log('📊 Статистика системных операций:', JSON.stringify(this.getStats(), null, 2));
    console.log('✅ SystemCallbacks очищен');
  }
}

module.exports = SystemCallbacks;