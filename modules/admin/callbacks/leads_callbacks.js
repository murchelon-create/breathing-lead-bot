// Файл: modules/admin/callbacks/leads_callbacks.js
// Управление лидами: читаем из памяти + файла

const { readLeads } = require('../landing_lead_watcher');

class LeadsCallbacks {
  constructor(adminHandlers, adminNotifications) {
    this.adminHandlers = adminHandlers;
    this.adminNotifications = adminNotifications;

    this.leadsCallbacksUsage = {
      totalRequests: 0,
      actionsUsed: {},
      lastRequest: null,
      processedLeads: new Set()
    };

    if (this.adminNotifications && !this.adminNotifications.leadDataStorage) {
      this.adminNotifications.leadDataStorage = {};
    }
  }

  async handleCallback(ctx, callbackData) {
    this.trackLeadsUsage(callbackData);
    try {
      switch (callbackData) {
        case 'admin_hot_leads':       await this.showHotLeads(ctx);      break;
        case 'admin_today_leads':     await this.showTodayLeads(ctx);    break;
        case 'admin_search':          await this.showSearchPanel(ctx);   break;
        case 'admin_process_all_hot': await this.processAllHotLeads(ctx); break;
        default: return false;
      }
      return true;
    } catch (error) {
      console.error('❌ LeadsCallbacks:', error);
      throw error;
    }
  }

  // ──── Получение лидов: память + файл ──────────────────────────────────────────

  getAllLeads() {
    // 1. Лиды из памяти (bot-survey лиды)
    const memLeads = this.adminNotifications?.leadDataStorage || {};

    // 2. Лиды из файла (landing лиды)
    let fileLeads = {};
    try { fileLeads = readLeads(); } catch (e) { /* файл ещё не существует */ }

    // 3. Мержим: память приоритетнее (bot) потом файл (landing)
    const merged = { ...fileLeads, ...memLeads };

    console.log(`📊 Лидов в памяти: ${Object.keys(memLeads).length}, в файле: ${Object.keys(fileLeads).length}, итого: ${Object.keys(merged).length}`);
    return merged;
  }

  // ──── Показ горячих лидов ────────────────────────────────────────────────────────────

  async showHotLeads(ctx) {
    console.log('🔥 Показ горячих лидов');
    try {
      const leads = Object.values(this.getAllLeads())
        .filter(l => l.analysisResult?.segment === 'HOT_LEAD')
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .slice(0, 10);

      if (!leads.length) {
        await ctx.editMessageText('✅ *ГОРЯЧИЕ ЛИДЫ*\n\nНет горячих лидов.', {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [
            [{ text: '🔄 Обновить', callback_data: 'admin_hot_leads' }],
            [{ text: '📋 Все лиды сегодня', callback_data: 'admin_today_leads' }],
            [{ text: '🏙️ Главная панель', callback_data: 'admin_main' }]
          ]}
        });
        return;
      }

      let msg = `🔥 *ГОРЯЧИЕ ЛИДЫ (${leads.length})*\n\n`;
      leads.forEach((lead, i) => {
        const u = lead.userInfo;
        const score = lead.analysisResult?.scores?.total || 0;
        const name = this.escapeMarkdown(u?.first_name || 'Неизвестно');
        const src  = lead.source === 'landing' ? ' 🌐' : '';
        msg += `${i+1}. *${name}*${src}\n`;
        if (u?.username)  msg += `   💬 @${this.escapeMarkdown(u.username)}\n`;
        if (u?.email)     msg += `   📧 ${u.email}\n`;
        if (u?.phone)     msg += `   📞 ${u.phone}\n`;
        msg += `   📊 Балл: ${score}/100\n`;
        msg += `   ⏰ ${this.getTimeAgo(lead.timestamp)}\n\n`;
      });

      await ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [{ text: '📞 Обработать всех', callback_data: 'admin_process_all_hot' }],
          [{ text: '🔄 Обновить', callback_data: 'admin_hot_leads' }],
          [{ text: '🏙️ Главная панель', callback_data: 'admin_main' }]
        ]}
      });
    } catch (error) {
      console.error('❌ showHotLeads:', error);
      await this.showErrorMessage(ctx, 'Ошибка получения горячих лидов');
    }
  }

  // ──── Показ лидов за сегодня ─────────────────────────────────────────────────────────

  async showTodayLeads(ctx) {
    console.log('📋 Показ лидов за сегодня');
    try {
      const today = new Date().toDateString();
      const allLeads = this.getAllLeads();

      const leads = Object.values(allLeads)
        .filter(lead => {
          if (!lead.timestamp) return false;
          return new Date(lead.timestamp).toDateString() === today;
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      console.log(`📊 Лидов за сегодня: ${leads.length}`);

      if (!leads.length) {
        await ctx.editMessageText(
          '📋 *ЛИДЫ СЕГОДНЯ*\n\n✅ Сегодня лидов пока нет.\n\nКогда пользователи завершат анкету или форму на лендинге, здесь появится список.',
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [
              [{ text: '🔄 Обновить', callback_data: 'admin_today_leads' }],
              [{ text: '📊 Аналитика дня', callback_data: 'admin_day_analytics' }],
              [{ text: '🏙️ Главная панель', callback_data: 'admin_main' }]
            ]}
          }
        );
        return;
      }

      let msg = `📋 *ЛИДЫ СЕГОДНЯ (${leads.length})*\n`;
      msg += `📅 ${new Date().toLocaleDateString('ru-RU')}\n\n`;

      // Группируем по сегментам
      const bySegment = leads.reduce((acc, lead) => {
        const seg = lead.analysisResult?.segment || 'UNKNOWN';
        if (!acc[seg]) acc[seg] = [];
        acc[seg].push(lead);
        return acc;
      }, {});

      const order = ['HOT_LEAD', 'WARM_LEAD', 'COLD_LEAD', 'NURTURE_LEAD', 'UNKNOWN'];
      order.filter(s => bySegment[s]).forEach(seg => {
        const list  = bySegment[seg];
        const emoji = this.getSegmentEmoji(seg);
        msg += `${emoji} *${this.translateSegment(seg)}* (${list.length}):\n`;
        list.slice(0, 3).forEach(lead => {
          const u    = lead.userInfo;
          const time = new Date(lead.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          const name = this.escapeMarkdown(u?.first_name || 'Неизвестно');
          const src  = lead.source === 'landing' ? ' 🌐' : '';
          msg += `   • ${name}${src}`;
          if (u?.username) msg += ` (@${this.escapeMarkdown(u.username)})`;
          else if (u?.email) msg += ` (${u.email})`;
          msg += ` \u2014 ${time}\n`;
        });
        if (list.length > 3) msg += `   • ... и еще ${list.length - 3}\n`;
        msg += `\n`;
      });

      await ctx.editMessageText(msg, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [
            { text: '🔥 Только горячие', callback_data: 'admin_hot_leads' },
            { text: '📊 Аналитика дня',  callback_data: 'admin_day_analytics' }
          ],
          [
            { text: '🔄 Обновить',  callback_data: 'admin_today_leads' },
            { text: '🏙️ Главная',  callback_data: 'admin_main' }
          ]
        ]}
      });

    } catch (error) {
      console.error('❌ showTodayLeads:', error);
      await this.showErrorMessage(ctx, 'Ошибка получения лидов');
    }
  }

  // ──── Поиск лидов ───────────────────────────────────────────────────────────────

  async showSearchPanel(ctx) {
    const total = Object.keys(this.getAllLeads()).length;
    let msg = `🔍 *ПОИСК ЛИДОВ*\n\n`;
    msg += `Для поиска используйте команду:\n\`/search_lead <запрос>\`\n\n`;
    msg += `📊 *Всего лидов в базе:* ${total}`;
    await ctx.editMessageText(msg, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [{ text: '📋 Все лиды сегодня', callback_data: 'admin_today_leads' }],
        [{ text: '🔥 Горячие',            callback_data: 'admin_hot_leads' }],
        [{ text: '🏙️ Главная панель',    callback_data: 'admin_main' }]
      ]}
    });
  }

  async processAllHotLeads(ctx) {
    const hot = Object.values(this.getAllLeads())
      .filter(l => l.analysisResult?.segment === 'HOT_LEAD');
    if (!hot.length) {
      await ctx.editMessageText('✅ Нет горячих лидов', {
        reply_markup: { inline_keyboard: [[{ text: '🏙️ Главная', callback_data: 'admin_main' }]] }
      });
      return;
    }
    hot.forEach(l => { if (l.userInfo?.telegram_id) this.leadsCallbacksUsage.processedLeads.add(l.userInfo.telegram_id); });
    let msg = `📞 *ОБРАБОТКА ГОРЯЧИХ ЛИДОВ*\n\n🔥 ${hot.length} горячих лидов\n\n`;
    hot.slice(0, 5).forEach((lead, i) => {
      const u = lead.userInfo;
      msg += `${i+1}. ${this.escapeMarkdown(u?.first_name || 'Неизвестно')} — `;
      msg += u?.username ? `@${this.escapeMarkdown(u.username)}\n` : `ID: ${u?.telegram_id}\n`;
    });
    await ctx.editMessageText(msg, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [
        [{ text: '🔥 Горячие', callback_data: 'admin_hot_leads' }],
        [{ text: '🏙️ Главная',  callback_data: 'admin_main' }]
      ]}
    });
  }

  // ──── Вспомогательные методы ───────────────────────────────────────────────────────

  escapeMarkdown(text) {
    if (!text) return '';
    return text.toString().replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }

  getTimeAgo(timestamp) {
    if (!timestamp) return 'Неизвестно';
    const diffMins = Math.floor((Date.now() - new Date(timestamp)) / 60000);
    if (diffMins < 1)  return 'Только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    const h = Math.floor(diffMins / 60);
    if (h < 24)        return `${h} ч назад`;
    return `${Math.floor(h / 24)} дн назад`;
  }

  getSegmentEmoji(segment) {
    return { HOT_LEAD: '🔥', WARM_LEAD: '⭐', COLD_LEAD: '❄️', NURTURE_LEAD: '🌱' }[segment] || '❓';
  }

  translateSegment(segment) {
    return { HOT_LEAD: 'Горячие', WARM_LEAD: 'Теплые', COLD_LEAD: 'Холодные', NURTURE_LEAD: 'Для взращивания', UNKNOWN: 'Неопределённые' }[segment] || segment;
  }

  async showErrorMessage(ctx, errorText) {
    try {
      await ctx.editMessageText(`❌ ${errorText}`, {
        reply_markup: { inline_keyboard: [
          [{ text: '🔄 Попробовать', callback_data: 'admin_today_leads' }],
          [{ text: '🏙️ Главная', callback_data: 'admin_main' }]
        ]}
      });
    } catch (e) {
      await ctx.reply(`❌ ${errorText}`);
    }
  }

  trackLeadsUsage(action) {
    this.leadsCallbacksUsage.totalRequests++;
    this.leadsCallbacksUsage.lastRequest = { action, timestamp: new Date().toISOString() };
    if (!this.leadsCallbacksUsage.actionsUsed[action]) this.leadsCallbacksUsage.actionsUsed[action] = 0;
    this.leadsCallbacksUsage.actionsUsed[action]++;
  }

  getStats() {
    return {
      name: 'LeadsCallbacks',
      total_requests: this.leadsCallbacksUsage.totalRequests,
      actions_used: this.leadsCallbacksUsage.actionsUsed,
      last_request: this.leadsCallbacksUsage.lastRequest,
      processed_leads_count: this.leadsCallbacksUsage.processedLeads.size,
      last_updated: new Date().toISOString()
    };
  }

  cleanup() {
    this.leadsCallbacksUsage.processedLeads.clear();
  }
}

module.exports = LeadsCallbacks;
