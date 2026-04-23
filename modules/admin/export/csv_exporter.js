// Файл: modules/admin/export/csv_exporter.js
// Модуль экспорта данных лидов в CSV формат для Excel
// v2.1 - исправлены: нулевые баллы, английские значения, пустые поля

class CSVExporter {
  constructor() {
    this.encoding = 'utf-8';
    this.delimiter = ';'; // точка с запятой для русского Excel
    this.lineBreak = '\r\n'; // Для корректной работы в Excel
  }

  generateCSV(leads, options = {}) {
    const {
      filter = 'all',
      includeHeader = true
    } = options;

    const filteredLeads = this.filterLeads(leads, filter);
    console.log(`📊 Генерация CSV: ${filteredLeads.length} лидов, фильтр: ${filter}`);

    let csv = '\uFEFF'; // UTF-8 BOM

    if (includeHeader) {
      csv += this.generateHeader() + this.lineBreak;
    }

    filteredLeads.forEach(lead => {
      csv += this.formatLeadRow(lead) + this.lineBreak;
    });

    return csv;
  }

  generateHeader() {
    const headers = [
      'Дата', 'Время', 'Имя', 'Username', 'Telegram ID',
      'Возраст', 'Сегмент', 'Балл VERSE', 'Срочность', 'Готовность', 'Соответствие',
      'Основная проблема', 'Уровень стресса', 'Качество сна',
      'Деятельность', 'Хронические заболевания', 'Опыт практик',
      'Время на практики', 'Цели', 'Источник', 'Примечания'
    ];
    return headers.map(h => this.escapeCSV(h)).join(this.delimiter);
  }

  formatLeadRow(lead) {
    const user     = lead.userInfo     || {};
    const analysis = lead.analysisResult || {};
    const answers  = lead.surveyAnswers  || {};
    const timestamp = lead.timestamp ? new Date(lead.timestamp) : new Date();

    const date = timestamp.toLocaleDateString('ru-RU');
    const time = timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    const name       = user.first_name || 'Неизвестно';
    const username   = user.username ? `@${user.username}` : '';
    const telegramId = user.telegram_id || '';

    // ✅ ИСПРАВЛЕНО: поддержка обоих вариантов ключа возраста
    const ageGroup = this.translateAnswer(
      answers.age_group || answers.ageGroup
    ) || 'Не указано';

    // ✅ ИСПРАВЛЕНО: поддержка обоих вариантов ключа деятельности
    const activity = this.translateAnswer(
      answers.occupation || answers.current_activity || answers.activity
    ) || 'Не указано';

    const segment    = this.translateSegment(analysis.segment);
    const totalScore = analysis.scores?.total || analysis.totalScore || 0;
    const urgency    = analysis.scores?.urgency   || analysis.urgency   || 0;
    const readiness  = analysis.scores?.readiness  || analysis.readiness  || 0;
    // ✅ ИСПРАВЛЕНО: был engagement, должен быть fit
    const fit        = analysis.scores?.fit || analysis.scores?.engagement || analysis.scores?.compatibility || 0;

    const primaryIssue = this.translateIssue(
      analysis.primaryIssue || analysis.primary_issue
    );

    // ✅ ИСПРАВЛЕНО: поддержка разных ключей стресса/сна
    const stressLevel  = answers.stress_level  != null ? `${answers.stress_level}/10`  : 'Не указано';
    const sleepQuality = answers.sleep_quality != null ? `${answers.sleep_quality}/10` : 'Не указано';

    // ✅ ИСПРАВЛЕНО: поддержка обоих ключей хронических заболеваний
    const chronicConditions = this.formatArrayAnswer(
      answers.chronic_conditions || answers.chronicConditions || answers.health_issues
    );

    // ✅ ИСПРАВЛЕНО: поддержка обоих ключей опыта
    const breathingExperience = this.translateAnswer(
      answers.breathing_experience || answers.breathingExperience || answers.experience
    ) || 'Не указано';

    // ✅ ИСПРАВЛЕНО: поддержка обоих ключей времени практики
    const practiceTime = this.translateAnswer(
      answers.practice_time || answers.practiceTime || answers.time_commitment
    ) || 'Не указано';

    // ✅ ИСПРАВЛЕНО: цели могут быть массивом или строкой
    const goals = this.formatGoals(answers.goals || answers.main_goals);

    // Источник лида
    const source = lead.source === 'landing' ? '🌐 Сайт' : '🤖 Telegram';

    const notes = this.generateNotes(analysis);

    const row = [
      date, time, name, username, telegramId,
      ageGroup, segment, `${totalScore}/100`, urgency, readiness, fit,
      primaryIssue, stressLevel, sleepQuality,
      activity, chronicConditions, breathingExperience,
      practiceTime, goals, source, notes
    ];

    return row.map(field => this.escapeCSV(field)).join(this.delimiter);
  }

  // ✅ НОВЫЙ МЕТОД: отдельная обработка целей (массив или строка)
  formatGoals(goals) {
    if (!goals) return 'Не указано';
    if (Array.isArray(goals)) {
      if (goals.length === 0) return 'Не указано';
      return goals.map(g => this.translateAnswer(g)).filter(Boolean).join(', ');
    }
    return this.translateAnswer(goals) || 'Не указано';
  }

  filterLeads(leads, filter) {
    switch (filter) {
      case 'hot':
        return leads.filter(l => l.analysisResult?.segment === 'HOT_LEAD');
      case 'today':
        const today = new Date().toDateString();
        return leads.filter(lead => {
          if (!lead.timestamp) return false;
          return new Date(lead.timestamp).toDateString() === today;
        });
      case 'all':
      default:
        return leads;
    }
  }

  escapeCSV(field) {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(this.delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}`;
    }
    return str;
  }

  formatArrayAnswer(arr) {
    if (!arr) return 'Нет';
    if (!Array.isArray(arr)) return this.translateAnswer(arr) || 'Нет';
    if (arr.length === 0) return 'Нет';
    return arr.map(item => this.translateAnswer(item)).filter(Boolean).join(', ');
  }

  generateNotes(analysis) {
    const notes = [];
    if (analysis.segment === 'HOT_LEAD') notes.push('🔥 Горячий лид - срочный контакт');
    if ((analysis.scores?.urgency || 0) >= 90) notes.push('⚠️ Высокая срочность');
    if ((analysis.scores?.total  || 0) >= 90) notes.push('⭐ Отличное соответствие');
    return notes.join('; ');
  }

  translateSegment(segment) {
    const t = {
      'HOT_LEAD':    '🔥 Горячий',
      'WARM_LEAD':   '⭐ Теплый',
      'COLD_LEAD':   '❄️ Холодный',
      'NURTURE_LEAD':'🌱 Для взращивания'
    };
    return t[segment] || segment || 'Неизвестно';
  }

  translateIssue(issue) {
    const t = {
      'chronic_stress':        'Хронический стресс',
      'anxiety':               'Тревожность',
      'insomnia':              'Бессонница',
      'breathing_issues':      'Проблемы с дыханием',
      'high_pressure':         'Высокое давление',
      'high_blood_pressure':   'Повышенное давление',
      'fatigue':               'Усталость',
      'hyperactivity':         'Гиперактивность',
      'sleep_problems':        'Проблемы со сном',
      'poor_sleep':            'Плохой сон',
      'general_wellness':      'Общее оздоровление',
      'shortness_of_breath':   'Одышка',
      'frequent_colds':        'Частые простуды',
      'low_energy':            'Низкая энергия',
      'difficulty_concentrating': 'Сложности с концентрацией'
    };
    return t[issue] || issue || 'Не указано';
  }

  translateAnswer(answer) {
    if (!answer) return '';
    if (typeof answer !== 'string') return String(answer);

    const t = {
      // --- Возраст ---
      '18-30': '18-30 лет', '31-45': '31-45 лет',
      '46-60': '46-60 лет', '60+': '60+ лет',
      '0-6':   '0-6 лет',  '7-12': '7-12 лет', '13-17': '13-17 лет',

      // --- Деятельность / Занятость ---
      'work':       'Работа',
      'study':      'Учеба',
      'retired':    'На пенсии',
      'unemployed': 'Безработный',
      'maternity':  'В декрете',
      'schoolchild':'Школьник',
      'preschooler':'Дошкольник',
      'management': 'Руководитель',
      'business':   'Предприниматель',
      'freelance':  'Фриланс',
      'employee':   'Наёмный сотрудник',
      'student':    'Студент',

      // --- Опыт практик ---
      'never':                'Никогда не пробовал(а)',
      'never_tried':          'Никогда не пробовал(а)',
      'tried_before':         'Пробовал(а) раньше',
      'sometimes':            'Иногда практикую',
      'occasionally':         'Иногда практикую',
      'currently_practicing': 'Практикую сейчас',
      'regular':              'Регулярно практикую',
      'yes_regular':          'Регулярно практикую',

      // --- Время на практики ---
      '3-5min':      '3-5 минут',
      '5-10min':     '5-10 минут',
      '5-10_minutes':'5-10 минут',
      '10-15min':    '10-15 минут',
      '10-15_minutes':'10-15 минут',
      '15+min':      'Более 15 минут',
      '15+_minutes': 'Более 15 минут',
      '15-30min':    '15-30 минут',
      '30+min':      'Более 30 минут',

      // --- Хронические заболевания ---
      'asthma':                  'Астма',
      'hypertension':            'Гипертония',
      'diabetes':                'Диабет',
      'heart_disease':           'Заболевания сердца',
      'panic_disorder':          'Панические атаки',
      'chronic_stress_condition':'Хронический стресс',
      'sleep_apnea':             'Апноэ сна',
      'respiratory_diseases':    'Заболевания дыхательных путей',
      'digestive_diseases':      'Заболевания ЖКТ',
      'spine_problems':          'Проблемы с позвоночником',
      'vsd':                     'ВСД',
      'osteoporosis':            'Остеопороз',
      'arthritis':               'Артрит',
      'none':                    'Нет',
      'no':                      'Нет',

      // --- Проблемы и симптомы ---
      'high_blood_pressure':      'Повышенное давление',
      'shortness_of_breath':      'Одышка, нехватка воздуха',
      'chronic_stress':           'Хронический стресс',
      'poor_sleep':               'Плохой сон',
      'frequent_colds':           'Частые простуды',
      'low_energy':               'Низкая энергия',
      'difficulty_concentrating': 'Сложности с концентрацией',
      'hyperactivity':            'Гиперактивность',
      'sleep_problems':           'Проблемы со сном',
      'anxiety':                  'Тревожность',
      'insomnia':                 'Бессонница',
      'fatigue':                  'Усталость',

      // --- Цели ---
      'reduce_stress':    'Снизить стресс',
      'stress_resistance':'Стрессоустойчивость',
      'improve_sleep':    'Улучшить сон',
      'better_sleep':     'Улучшить сон',
      'lower_pressure':   'Нормализовать давление',
      'boost_immunity':   'Укрепить иммунитет',
      'increase_energy':  'Повысить энергию',
      'improve_focus':    'Улучшить концентрацию',
      'calm_hyperactivity':'Успокоить гиперактивность',
      'general_health':   'Общее оздоровление',
      'weight_loss':      'Снижение веса',
      'sports_performance':'Спортивные результаты'
    };

    return t[answer] || answer;
  }

  generateFileName(filter = 'all') {
    const date = new Date().toISOString().split('T')[0];
    const filterName = {
      'all':   'vse_lidy',
      'hot':   'goryachie_lidy',
      'today': 'lidy_segodnya'
    }[filter] || 'lidy';
    return `${filterName}_${date}.csv`;
  }

  getExportStats(leads, filter = 'all') {
    const filteredLeads = this.filterLeads(leads, filter);
    return {
      total:  filteredLeads.length,
      hot:    filteredLeads.filter(l => l.analysisResult?.segment === 'HOT_LEAD').length,
      warm:   filteredLeads.filter(l => l.analysisResult?.segment === 'WARM_LEAD').length,
      cold:   filteredLeads.filter(l => l.analysisResult?.segment === 'COLD_LEAD').length,
      filter,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = CSVExporter;
