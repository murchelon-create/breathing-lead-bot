// Файл: core/handlers.js - ЧАСТЬ 1 (строки 1-400)
// ПЕРЕПИСАННАЯ ВЕРСИЯ с правильной структурой тизера

const { Markup } = require('telegraf');
const config = require('../config');

// Уведомление админу: Telegram + Google Sheets через прокси
async function notifyAdmin(data) {
  const proxyUrl = 'https://buteyko-api.bothost.tech/notify';

  // ── Google Sheets + Telegram через прокси ──────────────────────────────────
  // Прокси /notify ожидает { plan: { title, price, unit }, contacts: { telegram, phone } }
  try {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: {
          title: data.product || 'Пробное занятие',
          price: data.price   || 1500,
          unit:  '₽',
        },
        contacts: {
          telegram: data.telegram || '—',
          phone:    data.phone    || '—',
          email:    data.email    || '',
        },
        source: data.source || 'bot',
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (json.ok === false) {
      console.warn('⚠️ Прокси вернул ошибку:', JSON.stringify(json));
    } else {
      console.log('✅ Заявка записана в Google Sheets через прокси');
    }
  } catch (err) {
    console.error('❌ notifyAdmin: ошибка отправки на прокси:', err.message);
  }
}

class Handlers {
  constructor(botInstance) {
    this.bot = botInstance;
    this.telegramBot = botInstance.bot;
    
    this.surveyQuestions = botInstance.surveyQuestions;
    this.verseAnalysis = botInstance.verseAnalysis;
    this.leadTransfer = botInstance.leadTransfer;
    this.pdfManager = botInstance.pdfManager;
    this.adminNotifications = botInstance.adminNotifications;
    this.fileHandler = botInstance.fileHandler;

    // Кэш вопросов — избегаем повторного обхода дерева при каждом ответе
    this._questionCache = new Map();
    
    this.validateDependencies();
  }

  validateDependencies() {
    console.log('Handlers: проверка зависимостей...');
    const checks = {
      pdfManager: !!this.pdfManager,
      handleHelpChooseProgram: !!this.pdfManager?.handleHelpChooseProgram,
      showMoreMaterials: !!this.pdfManager?.showMoreMaterials,
      surveyQuestions: !!this.surveyQuestions,
      verseAnalysis: !!this.verseAnalysis,
      fileHandler: !!this.fileHandler
    };
    
    Object.entries(checks).forEach(([check, result]) => {
      console.log(`${result ? '✅' : '❌'} ${check}: ${result}`);
    });
  }

  setup() {
    console.log('Настройка обработчиков команд и событий...');
    this.setupUserCommands();
    this.setupUserCallbacks();
    this.setupTextHandlers();
    console.log('Обработчики настроены');
  }

  setupUserCommands() {
    this.telegramBot.start(async (ctx) => {
      try { await this.handleStart(ctx); } catch (e) { await this.handleError(ctx, e); }
    });

    this.telegramBot.help(async (ctx) => {
      try { await this.handleHelp(ctx); } catch (e) { await this.handleError(ctx, e); }
    });

    this.telegramBot.command('restart', async (ctx) => {
      try { await this.handleRestart(ctx); } catch (e) { await this.handleError(ctx, e); }
    });
  }

  setupUserCallbacks() {
  this.telegramBot.on('callback_query', async (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    console.log(`\n${'='.repeat(50)}`);
    console.log(`🔔 User Callback: "${callbackData}" от ${ctx.from.id}`);
    console.log(`📋 Текущий вопрос в сессии: ${ctx.session?.currentQuestion}`);
    console.log(`${'='.repeat(50)}\n`);

    if (callbackData.startsWith('admin_')) {
      console.log('⏩ Admin-callback пропущен (обработает bot.action)');
      return;
    }

    if (callbackData === 'get_bonus') {
      console.log('🎁 Нажата кнопка: Получить персональную технику');
      await ctx.answerCbQuery('🧠 Готовлю ваш персональный гид...');

      try {
        const analysisResult = ctx.session?.analysisResult;
        const surveyAnswers = ctx.session?.answers || {};

        if (!analysisResult) {
          await ctx.reply('😔 Результаты анализа не найдены. Начните заново: /start');
          return;
        }

        const bonus = this.pdfManager.getBonusForUser(analysisResult, surveyAnswers);
        ctx.session.pendingBonus = bonus;

        const teaserMessage = this.pdfManager.generateBonusMessage(bonus, analysisResult);

        await ctx.reply(teaserMessage, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📥 Получить мой гид (PDF)', 'download_bonus')]
          ])
        });

      } catch (error) {
        console.error('❌ Ошибка при подготовке гида:', error);
        await ctx.reply('😔 Произошла временная ошибка. Напишите @NastuPopova — она отправит материалы лично');
      }
      return;
    }

    if (callbackData === 'download_bonus') {
      console.log('📥 Нажата кнопка: Получить мой гид (PDF)');
      await ctx.answerCbQuery('Готовлю ваш персональный гид...');
      
      try {
        const bonus = ctx.session?.pendingBonus;

        if (!bonus) {
          await ctx.reply('😔 Гид не найден. Пройдите диагностику заново: /start');
          return;
        }

        await this.pdfManager.fileHandler.sendPDFFile(ctx, bonus);
        delete ctx.session.pendingBonus;

      } catch (error) {
        console.error('❌ Ошибка отправки гида:', error);
        await ctx.reply('😔 Не удалось отправить файл. Напишите @NastuPopova — она пришлёт гид лично');
      }
      return;
    }

    // ── Запись на пробное занятие ──────────────────────────────────────────
    if (callbackData === 'book_trial') {
      console.log('📅 Нажата кнопка: Записаться на пробное занятие');
      await ctx.answerCbQuery();
      try {
        await this.fileHandler.handleBookTrial(ctx);
      } catch (error) {
        console.error('❌ Ошибка handleBookTrial:', error);
        await ctx.reply('😔 Произошла ошибка. Напишите @NastuPopova напрямую.');
      }
      return;
    }
    // ──────────────────────────────────────────────────────────────────────

    if (callbackData === 'back_to_results') {
      await ctx.answerCbQuery();
      if (ctx.session?.analysisResult) {
        await this.showResults(ctx, ctx.session.analysisResult);
      }
      return;
    }

    if (callbackData === 'help_choose_program') {
      return await this.handleProgramHelp(ctx);
    }

    if (callbackData === 'start_survey' || callbackData === 'start_survey_from_about') {
      console.log('✅ Распознано: start_survey');
      return await this.startSurvey(ctx);
    }
    if (callbackData === 'about_survey') {
      console.log('✅ Распознано: about_survey');
      return await this.showAboutSurvey(ctx);
    }
    if (callbackData === 'back_to_main') {
      console.log('✅ Распознано: back_to_main');
      return await this.backToMain(ctx);
    }

    const isSurveyAnswer = 
      callbackData.startsWith('age_') ||
      callbackData.startsWith('prob_') ||
      callbackData.startsWith('child_prob_') ||
      callbackData.startsWith('goal_') ||
      callbackData.startsWith('format_') ||
      callbackData.startsWith('stress_') ||
      callbackData.startsWith('sleep_') ||
      callbackData.startsWith('breath_') ||
      callbackData.startsWith('method_') ||
      callbackData.startsWith('freq_') ||
      callbackData.startsWith('shallow_') ||
      callbackData.startsWith('exp_') ||
      callbackData.startsWith('time_') ||
      callbackData.startsWith('prio_') ||
      callbackData.startsWith('med_') ||
      callbackData.startsWith('meds_') ||
      callbackData.startsWith('panic_') ||
      callbackData.startsWith('env_') ||
      callbackData.startsWith('work_') ||
      callbackData.startsWith('occ_') ||
      callbackData.startsWith('activity_') ||
      callbackData.startsWith('condition_') ||
      callbackData.startsWith('child_age_') ||
      callbackData.startsWith('edu_') ||
      callbackData.startsWith('schedule_') ||
      callbackData.startsWith('parent_') ||
      callbackData.startsWith('motivation_') ||
      callbackData.startsWith('weight_') ||
      callbackData.startsWith('both_parents') ||
      callbackData.startsWith('mother') ||
      callbackData.startsWith('father') ||
      callbackData === 'nav_back' ||
      callbackData.endsWith('_done');

    if (isSurveyAnswer) {
      console.log('✅ Распознано как ответ на анкету, отправляем в handleSurveyAnswer');
      return await this.handleSurveyAnswer(ctx, callbackData);
    }

    console.log('⚠️ Callback не распознан ни одним обработчиком!');
    this.logCallbackDiagnostics(ctx, callbackData);
  });
  }

  setupTextHandlers() {
    this.telegramBot.on('text', async (ctx) => {
      // ── Перехват телефона для записи на пробное занятие ──────────
      if (ctx.session?.awaitingTrialPhone) {
        try {
          await this.fileHandler.handleTrialPhoneInput(ctx, notifyAdmin);
        } catch (error) {
          console.error('❌ Ошибка handleTrialPhoneInput:', error);
          await ctx.reply('😔 Произошла ошибка при сохранении заявки. Напишите @NastuPopova напрямую.');
        }
        return;
      }
      // ─────────────────────────────────────────────────────────────

      if (ctx.session?.currentQuestion) {
        await ctx.reply('Пожалуйста, используйте кнопки выше для ответа на вопрос.');
      } else {
        await ctx.reply('Для начала диагностики используйте /start');
      }
    });
  }

  getReviewsForTechnique(problem, isChild) {
    const reviewsMap = {
      adult: {
        'Хронический стресс': ['Быстро уходит внутреннее напряжение','Появляется ясность и контроль','Легче справляться с дедлайнами','Улучшается эмоциональный фон'],
        'Высокое давление': ['Давление приходит в норму','Головные боли уменьшаются','Улучшается самочувствие','Меньше зависимость от таблеток'],
        'Головные боли': ['Головные боли проходят за 5–7 минут','Уходит напряжение в висках и затылке','Появляется лёгкость в голове','Меньше нужно обезболивающих'],
        'Бессонница': ['Легче засыпаете','Сон становится глубже','Меньше ночных пробуждений','Утром чувствуете себя отдохнувшим'],
        'Проблемы с концентрацией': ['Уходит «туман в голове»','Появляется лёгкость и приток энергии','Мысли становятся упорядоченнее','Учёба/работа идёт легче и спокойнее']
      },
      child: {
        'Гиперактивность': ['Меньше импульсивности','Легче выполнять задания','Улучшается самоконтроль','Ребёнок становится более уравновешенным'],
        'Проблемы со сном': ['Легче засыпает','Меньше кошмаров','Сон спокойнее','Утром бодрый'],
        'Тревожность': ['Меньше страхов','Увереннее в себе','Легче идёт в садик/школу','Спокойнее реагирует на новое'],
        'Головные боли': ['Головные боли проходят за 5–7 минут','Уходит напряжение в висках','Появляется лёгкость в голове','Реже нужны обезболивающие']
      }
    };

    const source = isChild ? reviewsMap.child : reviewsMap.adult;
    return source[problem] || ['Становится легче дышать','Снижается внутреннее напряжение','Появляется ощущение контроля над состоянием','Улучшается общее самочувствие'];
  }

  getProgramNameByProblem(problem, isChild) {
    const programMap = {
      adult: {
        'Хронический стресс': 'Программа «Антистресс»',
        'Высокое давление': 'Программа «Давление под контроль»',
        'Головные боли': 'Программа «Свежая голова»',
        'Бессонница': 'Программа «Спокойный сон»',
        'Проблемы с концентрацией': 'Программа «Ясный ум»'
      },
      child: {
        'Гиперактивность': 'Детская программа «Спокойный ребёнок»',
        'Проблемы со сном': 'Детская программа «Сладкий сон»',
        'Тревожность': 'Детская программа «Спокойствие»',
        'Головные боли': 'Детская программа «Свежая голова»'
      }
    };

    const source = isChild ? programMap.child : programMap.adult;
    return source[problem] || 'Индивидуальная программа дыхательной коррекции';
  }

  getTelegramLinkByProblem(problem, isChild) {
    const links = {
      adult: {
        'Хронический стресс': 'https://t.me/+stress-program',
        'Высокое давление': 'https://t.me/+pressure-program',
        'Головные боли': 'https://t.me/+headache-program',
        'Бессонница': 'https://t.me/+sleep-program',
        'Проблемы с концентрацией': 'https://t.me/+focus-program'
      },
      child: {
        'Гиперактивность': 'https://t.me/+child-calm',
        'Проблемы со сном': 'https://t.me/+child-sleep',
        'Тревожность': 'https://t.me/+child-anxiety',
        'Головные боли': 'https://t.me/+child-headache'
      }
    };

    const source = isChild ? links.child : links.adult;
    return source[problem] || 'https://t.me/NastuPopova';
  }

  async handleStart(ctx) {
    console.log(`Команда /start от пользователя ${ctx.from.id}`);
    
    ctx.session = {
      ...ctx.session,
      currentQuestion: null,
      answers: {},
      completedQuestions: [],
      surveyStarted: false,
      surveyCompleted: false,
      analysisResult: null
    };

    const welcomeText = `🪡 *Диагностика Дыхания*\n\nУзнайте, как ваше дыхание влияет на:\n• стресс и тревожность\n• сон и энергию\n• концентрацию\n• давление и самочувствие\n\nБыстрый тест покажет ваше текущее состояние и даст персональные рекомендации.`;

    await ctx.reply(welcomeText, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Запустить тест', 'start_survey')],
        [Markup.button.callback('ℹ️ Подробнее о диагностике', 'about_survey')]
      ])
    });
  }

  async handleHelp(ctx) {
    await ctx.reply('Используйте /start для начала диагностики или /restart для перезапуска.');
  }

  async handleRestart(ctx) {
    ctx.session = {
      ...ctx.session,
      currentQuestion: null,
      answers: {},
      completedQuestions: [],
      surveyStarted: false,
      surveyCompleted: false,
      analysisResult: null
    };

    await ctx.reply('🔄 Диагностика перезапущена.');
    await this.handleStart(ctx);
  }

  async showAboutSurvey(ctx) {
    await ctx.answerCbQuery().catch(() => {});

    const text = `ℹ️ *О диагностике*\n\nДиагностика помогает определить, какие дыхательные паттерны могут влиять на ваше состояние.\n\nВы ответите на несколько вопросов, после чего получите персональный разбор и рекомендации.`;

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Начать диагностику', 'start_survey_from_about')],
        [Markup.button.callback('⬅️ Назад', 'back_to_main')]
      ])
    });
  }

  async backToMain(ctx) {
    await ctx.answerCbQuery().catch(() => {});
    return this.handleStart(ctx);
  }

  async handleProgramHelp(ctx) {
    try {
      if (this.pdfManager?.handleHelpChooseProgram) {
        return await this.pdfManager.handleHelpChooseProgram(ctx);
      }
      await ctx.reply('Напишите @NastuPopova — подберём подходящую программу вручную.');
    } catch (error) {
      console.error('Ошибка handleProgramHelp:', error);
      await ctx.reply('Произошла ошибка. Напишите @NastuPopova');
    }
  }

  logCallbackDiagnostics(ctx, callbackData) {
    console.log('📊 Диагностика callback:');
    console.log('- callbackData:', callbackData);
    console.log('- currentQuestion:', ctx.session?.currentQuestion);
    console.log('- session keys:', Object.keys(ctx.session || {}));
  }

  async startSurvey(ctx) {
    await ctx.answerCbQuery().catch(() => {});

    ctx.session.surveyStarted = true;
    ctx.session.surveyCompleted = false;
    ctx.session.answers = {};
    ctx.session.completedQuestions = [];
    ctx.session.startTime = Date.now();

    // Уведомляем админа о старте анкеты (для всех пользователей включая админа)
    if (this.adminNotifications?.notifySurveyStarted) {
      this.adminNotifications.notifySurveyStarted({
        userInfo: {
          telegram_id: ctx.from?.id,
          first_name: ctx.from?.first_name,
          username: ctx.from?.username
        }
      }).catch(e => console.warn('⚠️ Ошибка уведомления о старте:', e.message));
    }

    await this.askQuestion(ctx, 'age_group');
  }

  // Вспомогательный метод: получить вопрос из кэша или загрузить и закэшировать
  _getQuestion(questionKey) {
    let question = this._questionCache.get(questionKey);
    if (!question) {
      question = this.surveyQuestions.getQuestion(questionKey);
      if (question) this._questionCache.set(questionKey, question);
    }
    return question;
  }

  async askQuestion(ctx, questionKey) {
    const askStartedAt = Date.now();
    console.log(`📋 Задаём вопрос: ${questionKey}`);
    
    if (!this.surveyQuestions) {
      console.error('❌ surveyQuestions не инициализирован!');
      await ctx.reply('Ошибка загрузки вопросов. Попробуйте /restart');
      return;
    }

    try {
      // КЭШИРУЕМ: избегаем повторного обхода дерева вопросов
      const question = this._getQuestion(questionKey);
      
      if (!question) {
        console.error(`❌ Вопрос ${questionKey} не найден`);
        await ctx.reply('Ошибка: вопрос не найден. Попробуйте /restart');
        return;
      }

      console.log(`✅ Вопрос найден${this._questionCache.has(questionKey) ? ' (из кэша)' : ''}: ${question.text.substring(0, 50)}...`);

      ctx.session.currentQuestion = questionKey;
      ctx.session.questionStartTime = Date.now();

      const progress = this.surveyQuestions.getProgress(
        ctx.session.completedQuestions || [],
        ctx.session.answers || {}
      );

      const progressBar = this.generateProgressBar(progress.percentage);
      const questionText = `${progressBar}\n\n${question.text}`;

      if (question.note) {
        await ctx.editMessageText(
          `${questionText}\n\n💡 ${question.note}`,
          { parse_mode: 'Markdown', reply_markup: question.keyboard.reply_markup }
        ).catch(async () => {
          await ctx.reply(`${questionText}\n\n💡 ${question.note}`, {
            parse_mode: 'Markdown',
            reply_markup: question.keyboard.reply_markup
          });
        });
      } else {
        await ctx.editMessageText(questionText, {
          parse_mode: 'Markdown',
          reply_markup: question.keyboard.reply_markup
        }).catch(async () => {
          await ctx.reply(questionText, {
            parse_mode: 'Markdown',
            reply_markup: question.keyboard.reply_markup
          });
        });
      }

      console.log(`✅ Вопрос ${questionKey} отправлен пользователю за ${Date.now() - askStartedAt}ms`);

    } catch (error) {
      console.error(`❌ Ошибка при отправке вопроса ${questionKey}:`, error);
      await ctx.reply('Произошла ошибка. Попробуйте /restart');
    }
  }

  generateProgressBar(percentage) {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    const bar = '▓'.repeat(filled) + '░'.repeat(empty);
    return `📊 Прогресс: ${bar} ${percentage}%`;
  }

  async handleSurveyAnswer(ctx, callbackData) {
    const answerStartedAt = Date.now();
    console.log(`\n${'*'.repeat(60)}`);
    console.log(`📝 НАЧАЛО ОБРАБОТКИ ОТВЕТА`);
    console.log(`Callback Data: "${callbackData}"`);
    console.log(`${'*'.repeat(60)}`);

    if (!ctx.session) {
      console.error('❌ Сессия отсутствует!');
      await ctx.reply('Сессия истекла. Начните заново: /start');
      return;
    }

    const currentQuestion = ctx.session.currentQuestion;
    
    if (!currentQuestion) {
      console.error('❌ Текущий вопрос не установлен!');
      await ctx.reply('Ошибка: текущий вопрос не найден. Попробуйте /restart');
      return;
    }

    console.log(`📌 Текущий вопрос: "${currentQuestion}"`);

    if (callbackData === 'nav_back') {
      console.log('⬅️ Обработка навигации назад');
      return await this.handleNavBack(ctx);
    }

    // КЭШИРУЕМ: не обходим дерево заново для уже загруженного вопроса
    let question = this._getQuestion(currentQuestion);
    
    if (!question) {
      console.error(`❌ Вопрос "${currentQuestion}" не найден в surveyQuestions`);
      await ctx.reply('Ошибка загрузки вопроса. Попробуйте /restart');
      return;
    }

    console.log(`✅ Вопрос найден${this._questionCache.has(currentQuestion) ? ' (из кэша)' : ''}, тип: ${question.type}`);

    if (question.type === 'multiple_choice') {
      console.log('🔀 Обработка как множественный выбор');
      return await this.handleMultipleChoice(ctx, callbackData, question);
    }

    const mappedValue = this.surveyQuestions.mapCallbackToValue(callbackData);
    console.log(`✅ Результат маппинга: "${mappedValue}"`);

    const validation = this.surveyQuestions.validateAnswer(currentQuestion, mappedValue);
    console.log(`📋 Результат валидации:`, validation);

    if (!validation.valid) {
      console.log(`❌ Валидация не пройдена: ${validation.error}`);
      await ctx.answerCbQuery(validation.error || 'Некорректный ответ');
      return;
    }

    if (validation.warning) {
      await ctx.answerCbQuery(validation.warning, { show_alert: true });
    } else {
      await ctx.answerCbQuery();
    }

    ctx.session.answers[currentQuestion] = mappedValue;
    
    if (!ctx.session.completedQuestions.includes(currentQuestion)) {
      ctx.session.completedQuestions.push(currentQuestion);
    }

    console.log(`✅ Ответ сохранен: ${currentQuestion} = ${mappedValue}`);
    
    await this.moveToNextQuestion(ctx);
    console.log(`⏱️ handleSurveyAnswer total: ${Date.now() - answerStartedAt}ms | callback=${callbackData} | question=${currentQuestion}`);
  }

  async handleMultipleChoice(ctx, callbackData, question) {
    const currentQuestion = ctx.session.currentQuestion;
    const selected = ctx.session.answers[currentQuestion] || [];

    if (callbackData === 'nav_back') {
      await ctx.answerCbQuery().catch(() => {});
      return await this.handleNavBack(ctx);
    }

    if (callbackData.endsWith('_done')) {
      if (!selected.length) {
        await ctx.answerCbQuery('Выберите хотя бы один вариант');
        return;
      }
      await ctx.answerCbQuery();
      ctx.session.answers[currentQuestion] = selected;
      if (!ctx.session.completedQuestions.includes(currentQuestion)) {
        ctx.session.completedQuestions.push(currentQuestion);
      }
      return await this.moveToNextQuestion(ctx);
    }

    const mappedValue = this.surveyQuestions.mapCallbackToValue(callbackData);
    const exists = selected.includes(mappedValue);

    if (!exists && question.maxSelections && selected.length >= question.maxSelections) {
      await ctx.answerCbQuery(`Максимум ${question.maxSelections} вариант(а)`);
      return;
    }

    await ctx.answerCbQuery().catch(() => {});

    const nextSelected = exists
      ? selected.filter(item => item !== mappedValue)
      : [...selected, mappedValue];

    ctx.session.answers[currentQuestion] = nextSelected;

    // КЭШИРУЕМ: берём вопрос из кэша вместо нового обхода дерева
    const refreshedQuestion = this._getQuestion(currentQuestion) || question;

    const origRows = refreshedQuestion.keyboard.reply_markup.inline_keyboard;
    const updatedRows = origRows.map(row =>
      row.map(btn => {
        if (!btn.callback_data || btn.callback_data === 'nav_back' || btn.callback_data.endsWith('_done')) {
          return btn;
        }
        const val = this.surveyQuestions.mapCallbackToValue(btn.callback_data);
        const isSelected = nextSelected.includes(val);
        const cleanText = btn.text.replace(/^[✅☑️✓✔️]\s?/, '').trim();
        return { ...btn, text: isSelected ? `✅ ${cleanText}` : cleanText };
      })
    );

    const progress = this.surveyQuestions.getProgress(
      ctx.session.completedQuestions || [],
      ctx.session.answers || {}
    );
    const progressBar = this.generateProgressBar(progress.percentage);
    const questionText = `${progressBar}\n\n${refreshedQuestion.text}`;

    await ctx.editMessageText(questionText, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: updatedRows }
    }).catch(async () => {
      await ctx.reply(questionText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: updatedRows }
      });
    });
  }

  async handleNavBack(ctx) {
    await ctx.answerCbQuery().catch(() => {});

    const currentQuestion = ctx.session.currentQuestion;
    const previousQuestion = this.surveyQuestions.getPreviousQuestion(
      currentQuestion,
      ctx.session.answers
    );

    if (!previousQuestion) {
      await ctx.reply('Это первый вопрос.');
      return;
    }

    ctx.session.currentQuestion = previousQuestion;
    delete ctx.session.answers[currentQuestion];
    ctx.session.completedQuestions = ctx.session.completedQuestions.filter(q => q !== currentQuestion);

    await this.askQuestion(ctx, previousQuestion);
  }

  async moveToNextQuestion(ctx) {
    const nextStartedAt = Date.now();
    console.log('➡️ Переход к следующему вопросу');
    
    const currentQuestion = ctx.session.currentQuestion;
    const nextQuestion = this.surveyQuestions.getNextQuestion(
      currentQuestion,
      ctx.session.answers
    );

    if (!nextQuestion) {
      console.log('✅ Анкета завершена!');
      return await this.completeSurvey(ctx);
    }

    console.log(`➡️ Следующий вопрос: ${nextQuestion}`);
    
    if (!this.surveyQuestions.shouldShowQuestion(nextQuestion, ctx.session.answers)) {
      console.log(`⏭️ Пропускаем вопрос ${nextQuestion} (не подходит по условиям)`);
      ctx.session.currentQuestion = nextQuestion;
      return await this.moveToNextQuestion(ctx);
    }

    await this.askQuestion(ctx, nextQuestion);
    console.log(`⏱️ moveToNextQuestion: ${Date.now() - nextStartedAt}ms | from=${currentQuestion} | to=${nextQuestion}`);
  }

  async completeSurvey(ctx) {
    console.log('🎉 Завершение анкеты');
    
    ctx.session.surveyCompleted = true;
    ctx.session.currentQuestion = null;

    const answers = ctx.session.answers || {};
    const analysisResult = this.verseAnalysis.analyze(answers);
    ctx.session.analysisResult = analysisResult;

    try {
      if (this.leadTransfer?.processLead) {
        await this.leadTransfer.processLead({
          source: 'bot',
          userInfo: {
            telegram_id:   ctx.from?.id,
            first_name:    ctx.from?.first_name,
            username:      ctx.from?.username,
            last_name:     ctx.from?.last_name     || '',
            language_code: ctx.from?.language_code || ''
          },
          surveyType:    answers.age_group === 'for_child' ? 'child' : 'adult',
          surveyAnswers: answers,
          analysisResult
        });
        console.log('✅ Лид передан в leadTransfer');
      } else {
        console.warn('⚠️ leadTransfer.processLead недоступен');
      }
    } catch (error) {
      console.error('❌ Ошибка при передаче лида:', error);
    }

    await this.showResults(ctx, analysisResult);
  }

  async showResults(ctx, analysisResult) {
    const title = analysisResult?.title || 'Результаты диагностики';
    const summary = analysisResult?.summary || 'Ваши ответы проанализированы.';
    const recommendation = analysisResult?.recommendation || 'Рекомендуем пройти консультацию.';

    const text = `📌 *${title}*\n\n${summary}\n\n💡 *Рекомендация:* ${recommendation}`;

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🎁 Получить персональную технику', 'get_bonus')],
        [Markup.button.callback('🧩 Помочь подобрать программу', 'help_choose_program')]
      ])
    });
  }

  async handleError(ctx, error) {
    console.error('Ошибка в handlers:', error);
    try {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery('Произошла ошибка').catch(() => {});
      }
      await ctx.reply('Произошла ошибка. Попробуйте /restart');
    } catch (e) {
      console.error('Не удалось отправить сообщение об ошибке:', e);
    }
  }
}

module.exports = Handlers;
