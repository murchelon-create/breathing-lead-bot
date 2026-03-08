// Файл: modules/admin/callbacks/leads_callbacks.js
// Обработчики callback'ов для работы с лидами

class LeadsCallbacks {
  constructor(adminHandlers, adminNotifications) {
    this.adminHandlers = adminHandlers;
    this.adminNotifications = adminNotifications;
    
    // Статистика работы с лидами
    this.leadsCallbacksUsage = {
      totalRequests: 0,
      actionsUsed: {},
      lastRequest: null,
      processedLeads: new Set()
    };

    // Инициализируем leadDataStorage если его нет
    if (this.adminNotifications && !this.adminNotifications.leadDataStorage) {
      console.warn('⚠️ Инициализация leadDataStorage в leads_callbacks');
      this.adminNotifications.leadDataStorage = {};
    }
  }

  /**
   * Обработка callback'ов для работы с лидами
   */
  async handleCallback(ctx, callbackData) {
    this.trackLeadsUsage(callbackData);
    
    try {
      switch (callbackData) {
        case 'admin_hot_leads':
          await this.showHotLeads(ctx);
          break;
          
        case 'admin_today_leads':
          await this.showTodayLeads(ctx);
          break;
          
        case 'admin_search':
          await this.showSearchPanel(ctx);
          break;
          
        case 'admin_process_all_hot':
          await this.processAllHotLeads(ctx);
          break;
          
        default:
          return false; // Не обработано этим модулем
      }
      return true;
    } catch (error) {
      console.error('❌ Ошибка LeadsCallbacks:', error);
      throw error;
    }
  }

  /**
   * Получение leadDataStorage с проверкой
   */
  getLeadDataStorage() {
    if (!this.adminNotifications) {
      console.error('❌ adminNotifications не инициализирован');
      return {};
    }
    if (!this.adminNotifications.leadDataStorage) {
      console.warn('⚠️ leadDataStorage не существует, создаем пустой объект');
      this.adminNotifications.leadDataStorage = {};
    }
    return this.adminNotifications.leadDataStorage;
  }

  /**
   * Показ горячих лидов
   */
  async showHotLeads(ctx) {
    console.log('🔥 Показ горячих лидов');
    
    try {
      const leadsData = this.getLeadDataStorage();
      const leads = Object.values(leadsData)
        .filter(lead => lead.analysisResult?.segment === 'HOT_LEAD')
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .slice(0, 10);

      if (!leads.length) {
        await ctx.editMessageText('✅ *ГОРЯЧИЕ ЛИДЫ*\n\nНет горячих лидов.\n\nПосле прохождения анкеты пользователями, здесь появятся горячие лиды с высоким баллом VERSE.', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Обновить', callback_data: 'admin_hot_leads' }],
              [{ text: '📋 Все лиды сегодня', callback_data: 'admin_today_leads' }],
              [{ text: '🎛️ Главная панель', callback_data: 'admin_main' }]
            ]
          }
        });
        return;
      }

      let message = `🔥 *ГОРЯЧИЕ ЛИДЫ (${leads.length})*\n\n`;
      
      leads.forEach((lead, index) => {
        const user = lead.userInfo;
        const score = lead.analysisResult?.scores?.total || 0;
        const timeAgo = this.getTimeAgo(lead.timestamp);
        
        // Экранируем имя
        const firstName = this.escapeMarkdown(user?.first_name || 'Неизвестно');
        const username = user?.username ? this.escapeMarkdown(user.username) : null;
        
        message += `${index + 1}. *${firstName}*\n`;
        if (username) {
          message += `   💬 @${username}\n`;
        }
        message += `   🆔 ID: \`${user?.telegram_id}\`\n`;
        message += `   📊 Балл: ${score}/100\n`;
        message += `   ⏰ ${timeAgo}\n`;
        message += `   🎯 ${this.translateIssue(lead.analysisResult?.primaryIssue)}\n\n`;
      });

      const keyboard = [
        [{ text: '📞 Обработать всех', callback_data: 'admin_process_all_hot' }],
        [{ text: '🔄 Обновить', callback_data: 'admin_hot_leads' }],
        [{ text: '🎛️ Главная панель', callback_data: 'admin_main' }]
      ];

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
      
    } catch (error) {
      console.error('❌ Ошибка показа горячих лидов:', error);
      await this.showErrorMessage(ctx, 'Ошибка получения горячих лидов');
    }
  }

  /**
   * Показ лидов за сегодня
   */
  async showTodayLeads(ctx) {
    console.log('📋 Показ лидов за сегодня');
    
    try {
      const today = new Date().toDateString();
      const leadsData = this.getLeadDataStorage();
      
      // 🔍 ОТЛАДКА: Выводим структуру данных
      console.log('🔍 DEBUG: leadDataStorage keys:', Object.keys(leadsData));
      console.log('🔍 DEBUG: leadDataStorage entries:', Object.entries(leadsData).map(([id, lead]) => ({
        id,
        hasTimestamp: !!lead.timestamp,
        timestamp: lead.timestamp,
        hasAnalysisResult: !!lead.analysisResult,
        segment: lead.analysisResult?.segment,
        hasUserInfo: !!lead.userInfo
      })));
      
      const leads = Object.entries(leadsData)
        .map(([userId, lead]) => {
          // Если lead не содержит userInfo, добавляем userId
          if (!lead.userInfo && userId) {
            lead.userInfo = { telegram_id: userId };
          }
          return lead;
        })
        .filter(lead => {
          if (!lead.timestamp) {
            console.warn('⚠️ Лид без timestamp:', lead.userInfo?.telegram_id);
            return false;
          }
          const leadDate = new Date(lead.timestamp).toDateString();
          const isToday = leadDate === today;
          console.log(`🔍 Проверка лида ${lead.userInfo?.telegram_id}: ${leadDate} === ${today} = ${isToday}`);
          return isToday;
        })
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

      console.log(`📊 Найдено лидов за сегодня: ${leads.length}`);

      if (!leads.length) {
        await ctx.editMessageText('📋 *ЛИДЫ СЕГОДНЯ*\n\n✅ Сегодня лидов пока нет.\n\nКогда пользователи завершат анкету, здесь появится список всех лидов за сегодня.', {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Обновить', callback_data: 'admin_today_leads' }],
              [{ text: '📊 Аналитика дня', callback_data: 'admin_day_analytics' }],
              [{ text: '🎛️ Главная панель', callback_data: 'admin_main' }]
            ]
          }
        });
        return;
      }

      let message = `📋 *ЛИДЫ СЕГОДНЯ (${leads.length})*\n\n`;
      message += `📅 ${new Date().toLocaleDateString('ru-RU')}\n\n`;
      
      // Группируем по сегментам
      const bySegment = leads.reduce((acc, lead) => {
        const segment = lead.analysisResult?.segment || 'UNKNOWN';
        if (!acc[segment]) acc[segment] = [];
        acc[segment].push(lead);
        return acc;
      }, {});

      // Сортируем сегменты по приоритету
      const segmentOrder = ['HOT_LEAD', 'WARM_LEAD', 'COLD_LEAD', 'NURTURE_LEAD', 'UNKNOWN'];
      const sortedSegments = segmentOrder.filter(seg => bySegment[seg]);

      sortedSegments.forEach(segment => {
        const segmentLeads = bySegment[segment];
        const emoji = this.getSegmentEmoji(segment);
        message += `${emoji} *${this.translateSegment(segment)}* (${segmentLeads.length}):\n`;
        
        segmentLeads.slice(0, 3).forEach(lead => {
          const user = lead.userInfo;
          const time = new Date(lead.timestamp).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
          });
          
          // Экранируем имя и username
          const name = this.escapeMarkdown(user?.first_name || 'Неизвестно');
          const username = user?.username ? this.escapeMarkdown(user.username) : null;
          
          message += `   • ${name}`;
          if (username) {
            message += ` (@${username})`;
          }
          message += ` - ${time}\n`;
        });
        
        if (segmentLeads.length > 3) {
          message += `   • ... и еще ${segmentLeads.length - 3}\n`;
        }
        message += `\n`;
      });

      const keyboard = [
        [
          { text: '🔥 Только горячие', callback_data: 'admin_hot_leads' },
          { text: '📊 Аналитика дня', callback_data: 'admin_day_analytics' }
        ],
        [
          { text: '🔄 Обновить', callback_data: 'admin_today_leads' },
          { text: '🎛️ Главная панель', callback_data: 'admin_main' }
        ]
      ];

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

    } catch (error) {
      console.error('❌ Ошибка показа лидов за сегодня:', error);
      console.error('Stack:', error.stack);
      await this.showErrorMessage(ctx, 'Ошибка получения лидов за сегодня');
    }
  }

  /**
   * Показ панели поиска лидов
   */
  async showSearchPanel(ctx) {
    console.log('🔍 Показ панели поиска лидов');
    
    const leadsData = this.getLeadDataStorage();
    const totalLeads = Object.keys(leadsData).length;

    let message = `🔍 *ПОИСК ЛИДОВ*\n\n`;
    message += `Для поиска лидов используйте команду:\n`;
    message += `\`/search_lead <запрос>\`\n\n`;
    message += `*Можно искать по:*\n`;
    message += `• Telegram ID\n`;
    message += `• Имени пользователя\n`;
    message += `• Username (без @)\n`;
    message += `• Проблеме\n`;
    message += `• Сегменту\n\n`;
    message += `*Примеры:*\n`;
    message += `\`/search_lead 123456789\`\n`;
    message += `\`/search_lead Анна\`\n`;
    message += `\`/search_lead стресс\`\n`;
    message += `\`/search_lead HOT_LEAD\`\n\n`;
    
    message += `📊 *Всего лидов в базе:* ${totalLeads}`;

    try {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Все лиды сегодня', callback_data: 'admin_today_leads' }],
            [{ text: '🔥 Горячие лиды', callback_data: 'admin_hot_leads' }],
            [{ text: '🎛️ Главная панель', callback_data: 'admin_main' }]
          ]
        }
      });
    } catch (error) {
      console.error('❌ Ошибка показа панели поиска:', error);
      await this.showErrorMessage(ctx, 'Ошибка отображения панели поиска');
    }
  }

  /**
   * Обработка всех горячих лидов
   */
  async processAllHotLeads(ctx) {
    console.log('📞 Обработка всех горячих лидов');
    
    const leadsData = this.getLeadDataStorage();
    const hotLeads = Object.values(leadsData)
      .filter(lead => lead.analysisResult?.segment === 'HOT_LEAD');

    if (!hotLeads.length) {
      await ctx.editMessageText('✅ Нет горячих лидов для обработки', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎛️ Главная панель', callback_data: 'admin_main' }]
          ]
        }
      });
      return;
    }

    // Отмечаем лидов как обработанных
    hotLeads.forEach(lead => {
      if (lead.userInfo?.telegram_id) {
        this.leadsCallbacksUsage.processedLeads.add(lead.userInfo.telegram_id);
      }
    });

    let message = `📞 *ОБРАБОТКА ГОРЯЧИХ ЛИДОВ*\n\n`;
    message += `🔥 Найдено горячих лидов: ${hotLeads.length}\n\n`;
    message += `*Рекомендуемые действия:*\n`;
    message += `• Связаться с каждым в течение 2 часов\n`;
    message += `• Предложить экстренную консультацию\n`;
    message += `• Отправить персональные материалы\n\n`;
    message += `*Контакты для связи:*\n`;
    
    hotLeads.slice(0, 5).forEach((lead, index) => {
      const user = lead.userInfo;
      const name = this.escapeMarkdown(user?.first_name || 'Неизвестно');
      const username = user?.username ? this.escapeMarkdown(user.username) : null;
      
      message += `${index + 1}. ${name} - `;
      if (username) {
        message += `@${username}\n`;
      } else {
        message += `ID: ${user?.telegram_id}\n`;
      }
    });

    if (hotLeads.length > 5) {
      message += `... и еще ${hotLeads.length - 5} лидов\n`;
    }

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔥 Горячие лиды', callback_data: 'admin_hot_leads' }],
          [{ text: '🎛️ Главная панель', callback_data: 'admin_main' }]
        ]
      }
    });
  }

  // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====

  /**
   * Экранирование специальных символов Markdown
   */
  escapeMarkdown(text) {
    if (!text) return '';
    // Экранируем символы, которые имеют особое значение в Markdown
    return text.toString().replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  /**
   * Получение времени "X назад"
   */
  getTimeAgo(timestamp) {
    if (!timestamp) return 'Неизвестно';
    
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ч назад`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} дн назад`;
  }

  /**
   * Получение эмодзи для сегмента
   */
  getSegmentEmoji(segment) {
    const emojis = {
      'HOT_LEAD': '🔥',
      'WARM_LEAD': '⭐',
      'COLD_LEAD': '❄️',
      'NURTURE_LEAD': '🌱'
    };
    return emojis[segment] || '❓';
  }

  /**
   * Перевод сегмента
   */
  translateSegment(segment) {
    const translations = {
      'HOT_LEAD': 'Горячие',
      'WARM_LEAD': 'Теплые',
      'COLD_LEAD': 'Холодные',
      'NURTURE_LEAD': 'Для взращивания',
      'UNKNOWN': 'Неопределенные'
    };
    return translations[segment] || segment;
  }

  /**
   * Перевод проблемы
   */
  translateIssue(issue) {
    const translations = {
      'chronic_stress': 'Хронический стресс',
      'anxiety': 'Тревожность',
      'insomnia': 'Бессонница',
      'breathing_issues': 'Проблемы с дыханием',
      'high_pressure': 'Высокое давление',
      'fatigue': 'Усталость',
      'hyperactivity': 'Гиперактивность',
      'sleep_problems': 'Проблемы со сном'
    };
    return translations[issue] || issue || 'Не указано';
  }

  /**
   * Показ сообщения об ошибке
   */
  async showErrorMessage(ctx, errorText) {
    try {
      await ctx.editMessageText(`❌ ${errorText}\n\nПопробуйте обновить данные или вернуться на главную панель.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Попробовать снова', callback_data: 'admin_today_leads' }],
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
   * Отслеживание использования функций работы с лидами
   */
  trackLeadsUsage(action) {
    this.leadsCallbacksUsage.totalRequests++;
    this.leadsCallbacksUsage.lastRequest = {
      action: action,
      timestamp: new Date().toISOString()
    };
    
    if (!this.leadsCallbacksUsage.actionsUsed[action]) {
      this.leadsCallbacksUsage.actionsUsed[action] = 0;
    }
    this.leadsCallbacksUsage.actionsUsed[action]++;
  }

  /**
   * Получение статистики модуля
   */
  getStats() {
    return {
      name: 'LeadsCallbacks',
      total_requests: this.leadsCallbacksUsage.totalRequests,
      actions_used: this.leadsCallbacksUsage.actionsUsed,
      last_request: this.leadsCallbacksUsage.lastRequest,
      processed_leads_count: this.leadsCallbacksUsage.processedLeads.size,
      most_used_action: this.getMostUsedAction(),
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Получение наиболее используемого действия
   */
  getMostUsedAction() {
    const actions = this.leadsCallbacksUsage.actionsUsed;
    let maxAction = null;
    let maxCount = 0;
    
    Object.entries(actions).forEach(([action, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxAction = action;
      }
    });
    
    return maxAction ? { action: maxAction, count: maxCount } : null;
  }

  /**
   * Очистка ресурсов
   */
  cleanup() {
    console.log('🧹 Очистка LeadsCallbacks...');
    console.log('📊 Статистика работы с лидами:', JSON.stringify(this.getStats(), null, 2));
    
    // Очищаем множество обработанных лидов
    this.leadsCallbacksUsage.processedLeads.clear();
    
    console.log('✅ LeadsCallbacks очищен');
  }
}

module.exports = LeadsCallbacks;