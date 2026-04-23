// Файл: core/middleware.js - ИСПРАВЛЕННАЯ ВЕРСИЯ с персистентными сессиями
// ФИКС: telegraf-session-local с storageFileAsync — сессии переживают рестарт
const LocalSession = require('telegraf-session-local');
const config = require('../config');

class Middleware {
  constructor(botInstance) {
    this.bot = botInstance;
    this.telegramBot = botInstance.bot;
    
    // Статистика использования
    this.stats = {
      totalRequests: 0,
      uniqueUsers: new Set(),
      sessionsCreated: 0,
      errorsHandled: 0,
      startTime: Date.now()
    };

    // ИСПРАВЛЕНО: Более мягкий rate limiting для предотвращения блокировки переходов
    this.rateLimits = new Map();
    this.cleanupInterval = null;
  }

  // Настройка всех middleware
  setup() {
    console.log('🔧 Настройка middleware...');

    // Сессии
    this.setupSessions();
    
    // Логирование и статистика
    this.setupLogging();
    
    // ИСПРАВЛЕНО: Более умный rate limiting
    this.setupImprovedRateLimiting();
    
    // Обработка ошибок middleware
    this.setupErrorHandling();
    
    // Очистка данных
    this.setupCleanup();
    
    console.log('✅ Middleware настроен');
  }

  // ФИКС: Персистентные сессии через telegraf-session-local
  // Сессии сохраняются в sessions.json и переживают перезапуск на Railway
  setupSessions() {
    const localSession = new LocalSession({
      database: 'sessions.json',
      getSessionKey: (ctx) => {
        if (!ctx.from) return null;
        return `${ctx.from.id}:${ctx.chat?.id || ctx.from.id}`;
      },
      property: 'session',
      storage: LocalSession.storageFileAsync,
      format: {
        serialize: JSON.stringify,
        deserialize: JSON.parse
      }
    });

    this.telegramBot.use(localSession.middleware());

    // Гарантируем дефолтную сессию если вдруг пустая
    this.telegramBot.use(async (ctx, next) => {
      if (!ctx.session || Object.keys(ctx.session).length === 0) {
        ctx.session = this.getDefaultSession();
        this.stats.sessionsCreated++;
        console.log(`🆕 Новая сессия для пользователя ${ctx.from?.id}`);
      }
      return next();
    });

    console.log('✅ Персистентные сессии настроены (telegraf-session-local → sessions.json)');
  }

  // Настройка логирования
  setupLogging() {
    this.telegramBot.use(async (ctx, next) => {
      const startTime = Date.now();
      const messageText = ctx.message?.text || ctx.callbackQuery?.data || 'callback';
      const userId = ctx.from?.id || 'unknown';
      const username = ctx.from?.username || 'no_username';
      const firstName = ctx.from?.first_name || 'Unknown';

      // Обновляем статистику
      this.updateStats(userId);

      // Логируем запрос
      console.log(`[${new Date().toISOString()}] User ${userId} (@${username}, ${firstName}): ${messageText}`);

      // Проверяем/инициализируем сессию
      if (!ctx.session) {
        console.warn('⚠️ Сессия отсутствует, инициализируем новую');
        ctx.session = this.getDefaultSession();
        this.stats.sessionsCreated++;
      }

      try {
        await next();
        
        // Логируем время выполнения с деталями
        const duration = Date.now() - startTime;
        console.log(`⏱️ Middleware total: ${duration}ms | user=${userId} | msg=${messageText}`);
        if (duration > 1000) {
          console.log(`🐢 Медленный запрос: ${duration}ms для пользователя ${userId}`);
        }
        
      } catch (error) {
        this.stats.errorsHandled++;
        console.error(`❌ Ошибка middleware для пользователя ${userId}:`, error);
        throw error;
      }
    });

    console.log('✅ Логирование настроено');
  }

  // ИСПРАВЛЕНО: Более умный rate limiting
  setupImprovedRateLimiting() {
    this.telegramBot.use(async (ctx, next) => {
      if (!ctx.callbackQuery) return next();
      
      const userId = ctx.from?.id;
      if (!userId) return next();
      
      const now = Date.now();
      const userLimit = this.rateLimits.get(userId);
      
      // ФИКС: Уменьшен интервал до 300ms (было 500ms) для быстрых ответов
      if (userLimit && (now - userLimit.lastRequest) < 300) {
        userLimit.count++;
        if (userLimit.count > 5) {
          console.log(`⚠️ Rate limit для пользователя ${userId}: слишком много запросов`);
          await ctx.answerCbQuery('Слишком быстро! Подождите немного.').catch(() => {});
          return;
        }
      } else {
        this.rateLimits.set(userId, { lastRequest: now, count: 1 });
      }
      
      return next();
    });
    
    console.log('✅ Rate limiting настроен (300ms interval)');
  }

  // Обработка ошибок
  setupErrorHandling() {
    this.telegramBot.catch((err, ctx) => {
      console.error(`❌ Необработанная ошибка для пользователя ${ctx.from?.id}:`, err);
      
      // Пытаемся ответить пользователю
      if (ctx.callbackQuery) {
        ctx.answerCbQuery('Произошла ошибка. Попробуйте /restart').catch(() => {});
      } else {
        ctx.reply('Произошла ошибка. Попробуйте /restart').catch(() => {});
      }
    });
    
    console.log('✅ Обработка ошибок настроена');
  }

  // Очистка старых данных
  setupCleanup() {
    // Очищаем rate limits каждые 5 минут
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [userId, data] of this.rateLimits.entries()) {
        if (now - data.lastRequest > 60000) {
          this.rateLimits.delete(userId);
        }
      }
    }, 5 * 60 * 1000);
    
    console.log('✅ Очистка данных настроена');
  }

  // Обновление статистики
  updateStats(userId) {
    this.stats.totalRequests++;
    if (userId !== 'unknown') {
      this.stats.uniqueUsers.add(userId);
    }
  }

  // Получение дефолтной сессии
  getDefaultSession() {
    return {
      state: 'idle',
      currentQuestion: null,
      answers: {},
      completedQuestions: [],
      startTime: null,
      lastActivity: Date.now(),
      userData: {},
      questionStartTime: null,
      version: '2.8.1',
      sessions: 'telegraf-session-local (persistent + timing diagnostics)',
      session_storage: 'sessions.json (storageFileAsync)'
    };
  }

  // Получение статистики
  getStats() {
    return {
      totalRequests: this.stats.totalRequests,
      uniqueUsers: this.stats.uniqueUsers.size,
      sessionsCreated: this.stats.sessionsCreated,
      errorsHandled: this.stats.errorsHandled,
      uptime: Math.floor((Date.now() - this.stats.startTime) / 1000)
    };
  }
}

module.exports = Middleware;
