// Файл: modules/admin/export/csv_exporter.js
// Модуль экспорта данных лидов в CSV формат для Excel

class CSVExporter {
  constructor() {
    this.encoding = 'utf-8';
    this.delimiter = ';'; // ✅ ИЗМЕНЕНО: точка с запятой для русского Excel
    this.lineBreak = '\r\n'; // Для корректной работы в Excel
  }

  /**
   * Генерация CSV файла из массива лидов
   * @param {Array} leads - Массив объектов лидов
   * @param {Object} options - Опции экспорта (filter, includeHeader)
   * @returns {String} CSV строка с UTF-8 BOM
   */
  generateCSV(leads, options = {}) {
    const {
      filter = 'all', // 'all', 'hot', 'today'
      includeHeader = true
    } = options;

    // Фильтруем лиды по условию
    const filteredLeads = this.filterLeads(leads, filter);

    console.log(`📊 Генерация CSV: ${filteredLeads.length} лидов, фильтр: ${filter}`);

    // Формируем CSV
    let csv = '';

    // UTF-8 BOM для корректного открытия в Excel
    csv += '\uFEFF';

    // Заголовок
    if (includeHeader) {
      csv += this.generateHeader() + this.lineBreak;
    }

    // Данные
    filteredLeads.forEach(lead => {
      csv += this.formatLeadRow(lead) + this.lineBreak;
    });

    return csv;
  }

  /**
   * Генерация заголовка CSV
   */
  generateHeader() {
    const headers = [
      'Дата',
      'Время',
      'Имя',
      'Username',
      'Telegram ID',
      'Возраст',
      'Сегмент',
      'Балл VERSE',
      'Срочность',
      'Готовность',
      'Соответствие',
      'Основная проблема',
      'Уровень стресса',
      'Качество сна',
      'Деятельность',
      'Хронические заболевания',
      'Опыт практик',
      'Время на практики',
      'Цели',
      'Примечания'
    ];

    return headers.map(h => this.escapeCSV(h)).join(this.delimiter);
  }

  /**
   * Форматирование одного лида в строку CSV
   */
  formatLeadRow(lead) {
    const user = lead.userInfo || {};
    const analysis = lead.analysisResult || {};
    const answers = lead.surveyAnswers || {};
    const timestamp = lead.timestamp ? new Date(lead.timestamp) : new Date();

    // Дата и время
    const date = timestamp.toLocaleDateString('ru-RU');
    const time = timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    // Основная информация
    const name = user.first_name || 'Неизвестно';
    const username = user.username ? `@${user.username}` : '';
    const telegramId = user.telegram_id || '';

    // Демографические данные
    const ageGroup = this.translateAnswer(answers.age_group) || 'Не указано';
    const activity = this.translateAnswer(answers.current_activity) || 'Не указано';

    // Результаты анализа
    const segment = this.translateSegment(analysis.segment);
    const totalScore = analysis.scores?.total || 0;
    const urgency = analysis.scores?.urgency || 0;
    const readiness = analysis.scores?.readiness || 0;
    const engagement = analysis.scores?.engagement || 0;

    // Основные проблемы
    const primaryIssue = this.translateIssue(analysis.primaryIssue);
    const stressLevel = answers.stress_level ? `${answers.stress_level}/10` : 'Не указано';
    const sleepQuality = answers.sleep_quality ? `${answers.sleep_quality}/10` : 'Не указано';

    // Хронические заболевания (массив)
    const chronicConditions = this.formatArrayAnswer(answers.chronic_conditions);

    // Опыт и цели
    const breathingExperience = this.translateAnswer(answers.breathing_experience) || 'Не указано';
    const practiceTime = this.translateAnswer(answers.practice_time) || 'Не указано';
    const goals = this.translateAnswer(answers.goals) || 'Не указано';

    // Примечания
    const notes = this.generateNotes(analysis);

    // Формируем строку
    const row = [
      date,
      time,
      name,
      username,
      telegramId,
      ageGroup,
      segment,
      `${totalScore}/100`,
      urgency,
      readiness,
      engagement,
      primaryIssue,
      stressLevel,
      sleepQuality,
      activity,
      chronicConditions,
      breathingExperience,
      practiceTime,
      goals,
      notes
    ];

    return row.map(field => this.escapeCSV(field)).join(this.delimiter);
  }

  /**
   * Фильтрация лидов по условию
   */
  filterLeads(leads, filter) {
    switch (filter) {
      case 'hot':
        return leads.filter(lead => lead.analysisResult?.segment === 'HOT_LEAD');
      
      case 'today':
        const today = new Date().toDateString();
        return leads.filter(lead => {
          if (!lead.timestamp) return false;
          const leadDate = new Date(lead.timestamp).toDateString();
          return leadDate === today;
        });
      
      case 'all':
      default:
        return leads;
    }
  }

  /**
   * Экранирование спецсимволов для CSV
   */
  escapeCSV(field) {
    if (field === null || field === undefined) return '';
    
    const str = String(field);
    
    // Если содержит разделитель, кавычки или перенос строки - оборачиваем в кавычки
    if (str.includes(this.delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      // Экранируем кавычки удвоением
      return `"${str.replace(/"/g, '""')}`;
    }
    
    return str;
  }

  /**
   * Форматирование массива ответов (например, хронические заболевания)
   */
  formatArrayAnswer(arr) {
    if (!arr || !Array.isArray(arr) || arr.length === 0) {
      return 'Нет';
    }
    return arr.map(item => this.translateAnswer(item)).join(', ');
  }

  /**
   * Генерация примечаний на основе анализа
   */
  generateNotes(analysis) {
    const notes = [];
    
    if (analysis.segment === 'HOT_LEAD') {
      notes.push('🔥 Горячий лид - требуется срочный контакт');
    }
    
    if (analysis.scores?.urgency >= 90) {
      notes.push('⚠️ Высокая срочность');
    }
    
    if (analysis.scores?.total >= 90) {
      notes.push('⭐ Отличное соответствие методу');
    }

    return notes.join('; ');
  }

  /**
   * Перевод сегмента на русский
   */
  translateSegment(segment) {
    const translations = {
      'HOT_LEAD': '🔥 Горячий',
      'WARM_LEAD': '⭐ Теплый',
      'COLD_LEAD': '❄️ Холодный',
      'NURTURE_LEAD': '🌱 Для взращивания'
    };
    return translations[segment] || segment || 'Неизвестно';
  }

  /**
   * Перевод проблемы на русский
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
      'sleep_problems': 'Проблемы со сном',
      'general_wellness': 'Общее оздоровление'
    };
    return translations[issue] || issue || 'Не указано';
  }

  /**
   * Перевод ответа анкеты на русский
   */
  translateAnswer(answer) {
    if (!answer) return '';

    const translations = {
      // Возраст
      '18-30': '18-30 лет',
      '31-45': '31-45 лет',
      '46-60': '46-60 лет',
      '60+': '60+ лет',
      '0-6': '0-6 лет',
      '7-12': '7-12 лет',
      '13-17': '13-17 лет',

      // Деятельность
      'work': 'Работа',
      'study': 'Учеба',
      'retired': 'На пенсии',
      'unemployed': 'Безработный',
      'maternity': 'В декрете',
      'schoolchild': 'Школьник',
      'preschooler': 'Дошкольник',

      // Опыт
      'never_tried': 'Никогда не пробовал(а)',
      'tried_before': 'Пробовал(а) раньше',
      'currently_practicing': 'Практикую сейчас',

      // Время на практики
      '3-5min': '3-5 минут',
      '5-10min': '5-10 минут',
      '10-15min': '10-15 минут',
      '15+min': 'Более 15 минут',

      // Хронические заболевания
      'asthma': 'Астма',
      'hypertension': 'Гипертония',
      'diabetes': 'Диабет',
      'heart_disease': 'Заболевания сердца',
      'panic_disorder': 'Панические атаки',
      'chronic_stress_condition': 'Хронический стресс',
      'sleep_apnea': 'Апноэ сна',
      'none': 'Нет',

      // Проблемы
      'high_blood_pressure': 'Повышенное давление',
      'shortness_of_breath': 'Одышка, нехватка воздуха',
      'chronic_stress': 'Хронический стресс',
      'poor_sleep': 'Плохой сон',
      'frequent_colds': 'Частые простуды',
      'low_energy': 'Низкая энергия',
      'difficulty_concentrating': 'Сложности с концентрацией',
      'hyperactivity': 'Гиперактивность',
      'sleep_problems': 'Проблемы со сном',

      // Цели
      'reduce_stress': 'Снизить стресс',
      'improve_sleep': 'Улучшить сон',
      'lower_pressure': 'Нормализовать давление',
      'boost_immunity': 'Укрепить иммунитет',
      'increase_energy': 'Повысить энергию',
      'improve_focus': 'Улучшить концентрацию',
      'calm_hyperactivity': 'Успокоить гиперактивность',
      'better_sleep': 'Улучшить сон ребенка'
    };

    return translations[answer] || answer;
  }

  /**
   * Генерация имени файла
   */
  generateFileName(filter = 'all') {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filterName = {
      'all': 'все_лиды',
      'hot': 'горячие_лиды',
      'today': 'лиды_сегодня'
    }[filter] || 'лиды';

    return `${filterName}_${date}.csv`;
  }

  /**
   * Получение статистики экспорта
   */
  getExportStats(leads, filter = 'all') {
    const filteredLeads = this.filterLeads(leads, filter);
    
    const stats = {
      total: filteredLeads.length,
      hot: filteredLeads.filter(l => l.analysisResult?.segment === 'HOT_LEAD').length,
      warm: filteredLeads.filter(l => l.analysisResult?.segment === 'WARM_LEAD').length,
      cold: filteredLeads.filter(l => l.analysisResult?.segment === 'COLD_LEAD').length,
      filter: filter,
      timestamp: new Date().toISOString()
    };

    return stats;
  }
}

module.exports = CSVExporter;