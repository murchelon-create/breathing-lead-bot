const Markup = require('telegraf/markup');
const ContentGenerator = require('./content-generator');
const FileHandler = require('./file-handler');

class PDFManager {
  constructor() {
    // Инициализация компонентов
    this.contentGenerator = new ContentGenerator();
    this.fileHandler = new FileHandler(this.contentGenerator);
    
    // Статистика доставки бонусов
    this.deliveryStats = {
      totalDelivered: 0,
      bySegment: {},
      byType: {},
      lastDelivery: null
    };
  }

  // Основной метод получения бонуса для пользователя
getBonusForUser(analysisResult, surveyData) {
  try {
    console.log(`🎁 Подбираем бонус для пользователя`);

    const technique = this.contentGenerator.getMasterTechnique(analysisResult, surveyData);

    // Если техника не найдена — используем статичный fallback
    if (!technique || !technique.name) {
      console.warn('⚠️ Мастер-техника не найдена, переходим на статичный PDF fallback');
      return this.getStaticFallbackBonus(analysisResult);
    }

    const title = this.contentGenerator.generatePersonalizedTitle(analysisResult, surveyData);
    const subtitle = this.contentGenerator.generatePersonalizedSubtitle(analysisResult, surveyData);

    const isChildFlow = analysisResult.analysisType === 'child';
    const segment = analysisResult.segment || 'COLD_LEAD';

    const bonus = {
      id: `personal_bonus_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: title,
      subtitle: subtitle,
      description: 'Персональный дыхательный гид, созданный специально для вас',
      technique: technique,
      analysisType: analysisResult.analysisType,
      primaryIssue: analysisResult.primaryIssue,
      segment: segment,
      isChildFlow: isChildFlow,
      createdAt: new Date().toISOString(),
      fileName: this.contentGenerator.generateBeautifulFileName(analysisResult, surveyData),
      type: 'personalized'  // важный флаг
    };

    console.log(`✅ Персональный бонус подобран: ${technique.name}`);
    return bonus;

  } catch (error) {
    console.error(`❌ Ошибка подбора бонуса:`, error);
    return this.getStaticFallbackBonus(analysisResult);
  }
}

  // Генерация сообщения о бонусе
  generateBonusMessage(bonus, analysisResult) {
    const segment = analysisResult.segment;
    const isHotLead = analysisResult.segment === 'HOT_LEAD';
    const isChildFlow = analysisResult.analysisType === 'child';
    const technique = bonus.technique;

    let message = `🎁 *ВАША ПЕРСОНАЛЬНАЯ ТЕХНИКА ГОТОВА!*\n\n`;

    message += `${bonus.title}\n`;
    message += `${bonus.subtitle}\n\n`;

    message += `🎯 *Ваша проблема:* ${technique.problem}\n`;
    message += `✨ *Решение:* ${technique.name}\n`;
    message += `⏳ *Время:* ${technique.duration}\n`;
    message += `🎉 *Результат:* ${technique.result}\n\n`;

    message += `📖 *В вашем персональном гиде:*\n`;
    if (isChildFlow) {
      message += `• 🎮 Игровая техника специально для вашего ребенка\n`;
      message += `• 👨‍👩‍👧‍👦 Подробные инструкции для родителей\n`;
      message += `• 📅 План освоения на 3 дня\n`;
      message += `• 💡 Советы по мотивации ребенка\n\n`;
    } else {
      message += `• 🌬️ Одна мощная техника с пошаговой инструкцией\n`;
      message += `• 🧠 Научное обоснование\n`;
      message += `• 📅 План освоения на 3 дня\n`;
      message += `• 🎯 Четкие ожидаемые результаты\n\n`;
    }

    if (isHotLead) {
      message += `⚡ *СРОЧНАЯ РЕКОМЕНДАЦИЯ:*\n`;
      message += `Ваши ответы показывают критический уровень проблемы. `;
      message += `Эта техника поможет уже через 2-3 минуты!\n\n`;
      message += `🚨 *Начните прямо сейчас!*\n\n`;
    } else {
      message += `💫 *Почему именно эта техника:*\n`;
      message += `Подобрана специально под ваш профиль и основную проблему. `;
      message += `Простая, но очень эффективная!\n\n`;
    }

    message += `📞 *ХОТИТЕ БОЛЬШЕ ТЕХНИК?*\n`;
    message += `Дополнительные бонусы для взрослых и детей доступны в разделе материалов ниже.\n\n`;
    message += `На персональной консультации получите:\n`;
    message += `• Полная программа под вашу ситуацию\n`;
    message += `• План на 30 дней\n`;
    message += `• Контроль прогресса\n`;
    message += `• Ответы на все вопросы\n\n`;
    message += `👨‍⚕️ [Записаться на консультацию](https://t.me/breathing_opros_bot)`;
    return message;
  }

  // Генерация клавиатуры для бонуса
  generateBonusKeyboard(bonus, type) {
    return Markup.inlineKeyboard([
      [Markup.button.callback('📥 Получить мой гид', `download_${bonus.id}`)],
      [Markup.button.callback('📞 Хочу больше техник!', 'contact_request')],
      [Markup.button.callback('🎁 Дополнительные материалы', 'more_materials')],
      [Markup.button.url('💬 Написать Александру', 'https://t.me/breathing_opros_bot')]
    ]);
  }

  // Отправка PDF файла (делегируется в FileHandler)
  async sendPDFFile(ctx, bonus) {
    return await this.fileHandler.sendPDFFile(ctx, bonus);
  }

  // Отправка дополнительных PDF (делегируется в FileHandler)
  async sendAdditionalPDF(ctx, pdfType) {
    return await this.fileHandler.sendAdditionalPDF(ctx, pdfType);
  }

  // Показ дополнительных материалов (делегируется в FileHandler)
  async showMoreMaterials(ctx) {
    return await this.fileHandler.showMoreMaterials(ctx);
  }

  // Логирование доставки бонусов
  logBonusDelivery(userId, bonusId, bonusType, segment, primaryIssue) {
    const logEntry = {
      event: 'bonus_delivered',
      timestamp: new Date().toISOString(),
      user_id: userId,
      bonus_id: bonusId,
      bonus_type: bonusType,
      segment: segment,
      primary_issue: primaryIssue
    };

    // Обновляем статистику
    this.updateDeliveryStats(segment, bonusType);

    console.log('📊 ДОСТАВКА БОНУСА:', JSON.stringify(logEntry, null, 2));
  }

  // Обновление статистики доставки
  updateDeliveryStats(segment, bonusType) {
    this.deliveryStats.totalDelivered++;
    this.deliveryStats.lastDelivery = new Date().toISOString();
    
    // Статистика по сегментам
    if (!this.deliveryStats.bySegment[segment]) {
      this.deliveryStats.bySegment[segment] = 0;
    }
    this.deliveryStats.bySegment[segment]++;
    
    // Статистика по типам
    if (!this.deliveryStats.byType[bonusType]) {
      this.deliveryStats.byType[bonusType] = 0;
    }
    this.deliveryStats.byType[bonusType]++;
  }

  // Получение статистики бонусов
  getBonusStats() {
    const availableTechniques = {
      adult: Object.keys(this.contentGenerator.masterTechniques).length,
      child: Object.keys(this.contentGenerator.childMasterTechniques).length
    };

    return {
      available_bonuses: availableTechniques.adult + availableTechniques.child,
      available_techniques: availableTechniques,
      bonus_types: ['personalized_guide', 'static_pdf'],
      target_segments: this.contentGenerator.bonusesTemplate.target_segments,
      delivery_stats: this.deliveryStats,
      additional_materials: Object.keys(this.fileHandler.getAdditionalMaterials()),
      last_updated: new Date().toISOString()
    };
  }

  // Дефолтный бонус при ошибках
    getDefaultBonus() {
    const defaultTechnique = {
      name: 'Дыхание для давления',
      problem: 'Повышенное давление',
      duration: '5-7 минут',
      result: 'Снижение давления и расслабление',
      steps: [
        'Сядьте удобно, закройте глаза.',
        'Вдохните через нос на 5 секунд.',
        'Медленно выдохните через рот на 7 секунд.',
        'Повторите 6-8 раз.'
      ]
    };

    return {
      id: 'default_bonus_fallback_2025',
      title: 'Дыхательный гид: Нормализация давления',
      subtitle: 'Базовая техника для вашего здоровья',
      description: 'Универсальная техника при повышенном давлении',
      technique: defaultTechnique,
      analysisType: 'adult',
      primaryIssue: 'high_pressure',
      segment: 'HOT_LEAD',
      isChildFlow: false,
      createdAt: new Date().toISOString(),
      fileName: `Дыхательный_гид_Давление_${new Date().getDate()}.${new Date().getMonth() + 1}`,
      isDefault: true
    };
  }

  // Добавь этот новый метод в класс PDFManager (в любое место внутри класса)
getStaticFallbackBonus(analysisResult) {
  const isChildFlow = analysisResult.analysisType === 'child';

  if (isChildFlow) {
    return {
      id: 'static_fallback_child',
      title: 'Дыхательные игры для детей',
      subtitle: 'Базовый гид с игровыми техниками',
      description: 'Универсальный набор дыхательных игр для детей',
      type: 'static',
      staticType: 'child_games',  // ключ из additionalMaterials в file-handler.js
      analysisType: 'child',
      segment: analysisResult.segment || 'NURTURE_LEAD',
      isChildFlow: true,
      createdAt: new Date().toISOString(),
      fileName: 'Базовый_гид_Дыхательные_игры_дети.pdf'
    };
  } else {
    return {
      id: 'static_fallback_adult',
      title: 'Антистресс дыхание',
      subtitle: 'Базовый гид для снятия стресса',
      description: 'Универсальные техники для взрослых',
      type: 'static',
      staticType: 'adult_antistress',  // ключ из additionalMaterials
      analysisType: 'adult',
      segment: analysisResult.segment || 'WARM_LEAD',
      isChildFlow: false,
      createdAt: new Date().toISOString(),
      fileName: 'Базовый_гид_Антистресс_дыхание_взрослые.pdf'
    };
  }
}

  // Показ всех программ (для будущих расширений)
  async showAllPrograms(ctx) {
    const message = `📚 *ВСЕ ПРОГРАММЫ ДЫХАНИЯ*\n\n` +
      `🌟 *Доступные направления:*\n` +
      `• Антистресс и релаксация\n` +
      `• Улучшение сна\n` +
      `• Повышение энергии\n` +
      `• Детские программы\n` +
      `• Специальные техники\n\n` +
      `📞 Для подбора индивидуальной программы обратитесь к [Александру Попову](https://t.me/breathing_opros_bot)`;

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📞 Записаться на консультацию', 'contact_request')],
        [Markup.button.url('💬 Написать Александру', 'https://t.me/breathing_opros_bot')],
        [Markup.button.callback('🔙 Назад', 'back_to_results')]
      ])
    });
  }

  // Показ деталей заказа программы
  async showOrderDetails(ctx, programType) {
    const message = `📋 *ДЕТАЛИ ПРОГРАММЫ*\n\n` +
      `🎯 *Тип:* ${programType}\n` +
      `📞 Для получения подробной информации и записи обратитесь к [Александру Попову](https://t.me/breathing_opros_bot)\n\n` +
      `💝 *Что входит в консультацию:*\n` +
      `• Диагностика вашего дыхания\n` +
      `• Подбор индивидуальных техник\n` +
      `• План развития на 30 дней\n` +
      `• Поддержка и контроль результатов`;

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📞 Записаться к Александру', 'https://t.me/breathing_opros_bot')],
        [Markup.button.callback('🔙 К программам', 'other_programs')]
      ])
    });
  }

  // Помощник выбора программы
  async showProgramHelper(ctx) {
    const message = `🤔 *ПОМОЩЬ В ВЫБОРЕ ПРОГРАММЫ*\n\n` +
      `Не знаете, какая программа вам подойдет?\n\n` +
      `📞 [Александр Попов](https://t.me/breathing_opros_bot) поможет:\n` +
      `• Определить ваши приоритеты\n` +
      `• Подобрать оптимальную программу\n` +
      `• Составить индивидуальный план\n` +
      `• Ответить на все вопросы\n\n` +
      `💡 *Консультация поможет выбрать правильное направление и избежать ошибок в практике.*`;

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('💬 Получить помощь', 'https://t.me/breathing_opros_bot')],
        [Markup.button.callback('📚 К программам', 'other_programs')],
        [Markup.button.callback('🔙 К результатам', 'back_to_results')]
      ])
    });
  }

  // Получение информации о модуле
  getModuleInfo() {
    return {
      name: 'PDFManager',
      version: '2.5.0',
      components: {
        contentGenerator: 'ContentGenerator',
        fileHandler: 'FileHandler'
      },
      features: [
        'personalized_guides',
        'static_materials',
        'html_generation',
        'delivery_tracking',
        'fallback_support'
      ],
      last_updated: new Date().toISOString()
    };
  }
}

module.exports = PDFManager;
