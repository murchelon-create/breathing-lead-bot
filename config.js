// Файл: config.js
// ФИНАЛЬНАЯ ВЕРСИЯ - автономный Lead Bot с расширенными переводами

require('dotenv').config();

module.exports = {
  // Telegram Bot Configuration
  LEAD_BOT_TOKEN: process.env.LEAD_BOT_TOKEN,
  
  // ИСПРАВЛЕНО: Отключаем API интеграцию, но сохраняем URL для ссылок
  MAIN_BOT_API_URL: null, // Отключаем API интеграцию
  MAIN_BOT_URL: 'https://t.me/breathing_opros_bot', // Для ссылок в интерфейсе
  
  // Контакт тренера для переадресации
  TRAINER_CONTACT: '@AS_Popov87',
  
  // Database Configuration (опционально)
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  
  // Admin Configuration
  ADMIN_ID: process.env.ADMIN_ID,
  
  // Analytics & Monitoring
  ANALYTICS_API_KEY: process.env.ANALYTICS_API_KEY,
  SENTRY_DSN: process.env.SENTRY_DSN,
  
  // Business Logic
  SURVEY_TIMEOUT_MINUTES: parseInt(process.env.SURVEY_TIMEOUT_MINUTES, 10) || 30,
  MAX_RETRIES_PER_QUESTION: parseInt(process.env.MAX_RETRIES_PER_QUESTION, 10) || 3,
  ANALYSIS_DELAY_SECONDS: parseInt(process.env.ANALYSIS_DELAY_SECONDS, 10) || 3,
  
  // Survey Configuration
  SURVEY_CONFIG: {
    maxQuestions: 21, // Увеличено для новых вопросов
    timeoutMinutes: parseInt(process.env.SURVEY_TIMEOUT_MINUTES, 10) || 30,
    allowSkip: false,
    savePartialResponses: true,
    maxProblemsSelection: 3,
    maxChildProblemsSelection: 3,
    maxGoalsSelection: 2,
    maxFormatsSelection: 4,
    maxWorkEnvironmentSelection: 5 // Новое ограничение
  },
  
  // Lead Scoring Configuration
  SCORING_WEIGHTS: {
    urgency: 0.4,
    readiness: 0.35,
    fit: 0.25
  },
  
  // Segmentation Thresholds
  SEGMENT_THRESHOLDS: {
    HOT_LEAD: 80,
    WARM_LEAD: 60,
    COLD_LEAD: 40,
    NURTURE_LEAD: 0
  },
  
  // Integrations (отключены для автономной работы)
  CRM_WEBHOOK_URL: process.env.CRM_WEBHOOK_URL,
  EMAIL_SERVICE_API: process.env.EMAIL_SERVICE_API,
  
  // Railway/Deployment
  PORT: parseInt(process.env.PORT, 10) || 3001,
  APP_URL: process.env.APP_URL || 'https://breathing-lead-bot-production.up.railway.app',
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Feature Flags - ИСПРАВЛЕНО
  FEATURES: {
    enable_analytics: process.env.ENABLE_ANALYTICS === 'true',
    enable_crm_integration: false, // Отключаем CRM интеграцию
    enable_admin_commands: process.env.ENABLE_ADMIN !== 'false', // Включаем админ по умолчанию
    enable_health_checks: process.env.ENABLE_HEALTH_CHECKS !== 'false'
  },

  // РАСШИРЕННЫЕ ПЕРЕВОДЫ для всех компонентов системы
  TRANSLATIONS: {
    // === ОСНОВНЫЕ ПРОБЛЕМЫ ВЗРОСЛЫХ ===
    'chronic_stress': 'Хронический стресс',
    'insomnia': 'Плохой сон, бессонница',
    'breathing_issues': 'Одышка, нехватка воздуха',
    'high_pressure': 'Повышенное давление',
    'headaches': 'Частые головные боли',
    'fatigue': 'Постоянная усталость',
    'anxiety': 'Тревожность, панические атаки',
    'concentration_issues': 'Проблемы с концентрацией',
    'back_pain': 'Боли в шее, плечах, спине',
    'digestion_issues': 'Проблемы с пищеварением',
    'panic_attacks': 'Панические атаки',
    
    // === ДЕТСКИЕ ПРОБЛЕМЫ ===
    'tantrums': 'Частые истерики, капризы',
    'sleep_problems': 'Проблемы с засыпанием',
    'nightmares': 'Беспокойный сон, кошмары',
    'hyperactivity': 'Гиперактивность',
    'separation_anxiety': 'Боится разлуки с родителями',
    'social_difficulties': 'Сложности в общении',
    'aggression': 'Агрессивное поведение',
    'weak_immunity': 'Частые простуды',
    'prevention': 'В целом здоров, профилактика',
    
    // === ХРОНИЧЕСКИЕ ЗАБОЛЕВАНИЯ (НОВЫЕ) ===
    'respiratory_diseases': 'Астма/бронхит/ХОБЛ',
    'cardiovascular_diseases': 'Гипертония/аритмия',
    'diabetes': 'Диабет 1 или 2 типа',
    'spine_problems': 'Остеохондроз/грыжи',
    'chronic_headaches': 'Мигрени/головные боли',
    'panic_disorder': 'Панические атаки/ВСД',
    'thyroid_diseases': 'Заболевания щитовидной железы',
    'digestive_diseases': 'Гастрит/язва/рефлюкс',
    'none': 'Нет хронических заболеваний',
    
    // === МЕДИКАМЕНТЫ (НОВЫЕ) ===
    'pressure_medications': 'Препараты от давления',
    'respiratory_medications': 'Ингаляторы/препараты от астмы',
    'mental_medications': 'Успокоительные/антидепрессанты',
    'diabetes_medications': 'Инсулин/препараты от диабета',
    'hormonal_medications': 'Гормональные препараты',
    'other_medications': 'Другие препараты',
    'no_medications': 'Не принимаю регулярно',
    
    // === ПАНИЧЕСКИЕ АТАКИ (НОВЫЕ) ===
    'panic_regular': 'Регулярно (раз в неделю и чаще)',
    'panic_sometimes': 'Иногда (раз в месяц)',
    'panic_rarely': 'Редко (несколько раз в год)',
    'panic_past': 'Были раньше, сейчас нет',
    'panic_never': 'Не было панических атак',
    
    // === РАБОЧАЯ СРЕДА (НОВЫЕ) ===
    'long_computer_work': 'Работа за компьютером 8+ часов',
    'frequent_talking': 'Много разговариваю/переговоры',
    'frequent_travel': 'Частые перелеты/командировки',
    'stuffy_environment': 'Работа в душном помещении',
    'irregular_schedule': 'Ненормированный график',
    'night_shifts': 'Ночные смены',
    'social_stress': 'Постоянный стресс от общения',
    
    // === СЕГМЕНТЫ ===
    'HOT_LEAD': 'требует срочного внимания',
    'WARM_LEAD': 'активно мотивирован к изменениям',
    'COLD_LEAD': 'умеренный интерес к практикам', 
    'NURTURE_LEAD': 'долгосрочное развитие',
    
    // === ВОЗРАСТНЫЕ ГРУППЫ ===
    '18-30': '18-30 лет',
    '31-45': '31-45 лет',
    '46-60': '46-60 лет',
    '60+': '60+ лет',
    'for_child': 'Для ребенка',
    
    // === ДЕТСКИЕ ВОЗРАСТА ===
    '3-4': '3-4 года',
    '5-6': '5-6 лет',
    '7-8': '7-8 лет',
    '9-10': '9-10 лет',
    '11-12': '11-12 лет',
    '13-15': '13-15 лет',
    '16-17': '16-17 лет',
    
    // === ПРОФЕССИИ ===
    'office_work': 'Офисная работа',
    'home_work': 'Работа дома/фриланс',
    'physical_work': 'Физический труд',
    'student': 'Учеба',
    'maternity_leave': 'В декрете',
    'retired': 'На пенсии',
    'management': 'Руководящая должность',
    
    // === ФИЗИЧЕСКАЯ АКТИВНОСТЬ ===
    'daily': 'Ежедневно',
    'regular': '3-4 раза в неделю',
    'sometimes': '1-2 раза в неделю',
    'rarely': 'Несколько раз в месяц',
    'never': 'Практически не занимаюсь',
    
    // === МЕТОДЫ ДЫХАНИЯ ===
    'nose': 'В основном носом',
    'mouth': 'Часто дышу ртом',
    'mixed': 'Попеременно носом и ртом',
    'unaware': 'Не обращаю внимания',
    
    // === ЧАСТОТА ПРОБЛЕМ ===
    'constantly': 'Постоянно (каждый день)',
    'often': 'Часто (несколько раз в неделю)',
    'sometimes': 'Периодически',
    'rarely': 'Редко (несколько раз в год)',
    'never': 'Никогда',
    
    // === ОПЫТ С ПРАКТИКАМИ ===
    'few_times': 'Пробовал(а) пару раз',
    'theory_only': 'Изучал(а) теорию',
    'regularly': 'Практикую регулярно',
    'expert': 'Опытный практик',
    
    // === ВРЕМЯ НА ПРАКТИКИ ===
    '3-5_minutes': '3-5 минут в день',
    '10-15_minutes': '10-15 минут в день',
    '20-30_minutes': '20-30 минут в день',
    '30+_minutes': '30+ минут в день',
    
    // === ФОРМАТЫ ОБУЧЕНИЯ ===
    'video': 'Видеоуроки',
    'audio': 'Аудиопрактики',
    'text': 'Текст с картинками',
    'online_live': 'Живые онлайн-занятия',
    'individual': 'Индивидуальные консультации',
    'mobile_app': 'Мобильное приложение',
    
    // === ЦЕЛИ ===
    'quick_relaxation': 'Быстро расслабляться',
    'stress_resistance': 'Повысить стрессоустойчивость',
    'reduce_anxiety': 'Избавиться от тревожности',
    'improve_sleep': 'Наладить сон',
    'increase_energy': 'Повысить энергию',
    'normalize_pressure': 'Нормализовать давление',
    'improve_breathing': 'Улучшить дыхание',
    'improve_focus': 'Улучшить концентрацию',
    'weight_management': 'Поддержать похудение',
    'general_health': 'Общее оздоровление'
  },
  
  // Message Templates - ИСПРАВЛЕНЫ ССЫЛКИ
  MESSAGES: {
    WELCOME: `🌬️ *Добро пожаловать в диагностику дыхания!*

Пройдите быструю диагностику дыхания (4-5 минут) и получите:

✅ Персональный анализ состояния
✅ Индивидуальные рекомендации  
✅ Бесплатные материалы для практики

Готовы узнать, как улучшить свое дыхание?`,

    ANALYSIS_START: `🧠 *Анализирую ваши ответы...*

Александр изучает ваш профиль и подбирает персональные рекомендации.

Это займет несколько секунд...`,

    THANK_YOU: `🙏 *Спасибо за прохождение диагностики!*

Ваши данные сохранены для подготовки персональной программы.

Переходите в основной бот для записи на консультацию: @breathing_opros_bot`,

    CONTACT_TRAINER: `📞 *Связаться с тренером*

Для записи на консультацию и получения персональной программы:

👨‍⚕️ Попов Александр - инструктор по дыхательной гимнастике Бутейко: @AS_Popov87
🤖 Основной бот: @breathing_opros_bot

Просто напишите ему в Telegram!`
  },
  
  // Free Materials by Segment
  FREE_MATERIALS: {
    HOT_LEAD: [
      'SOS-техники при панике (PDF)',
      'Аудиогид "Экстренное успокоение" (10 мин)',
      'Чек-лист домашней диагностики',
      'Прямая связь с Александром в Telegram'
    ],
    WARM_LEAD: [
      '5 дыхательных техник для офиса (PDF)',
      'Аудиогид "Дыхание для сна" (15 мин)',
      'План практик на 7 дней',
      'Доступ к закрытому каналу'
    ],
    COLD_LEAD: [
      'Основы правильного дыхания (PDF)',
      'Видео "3 простые техники" (5 мин)',
      'Мини-курс в рассылке',
      'Календарь дыхательных практик'
    ],
    NURTURE_LEAD: [
      'Гид "Дыхание и здоровье" (PDF)',
      'Доступ к бесплатным вебинарам',
      'Подписка на полезные статьи',
      'Сообщество единомышленников'
    ]
  },
  
  // Product Recommendations by Issue
  PRODUCT_RECOMMENDATIONS: {
    panic_attacks: {
      urgent: 'individual_emergency',
      standard: 'anti_panic_course'
    },
    chronic_stress: {
      urgent: 'stress_management_intensive', 
      standard: 'starter_pack_plus'
    },
    insomnia: {
      urgent: 'sleep_restoration_program',
      standard: 'evening_practices_course'
    },
    breathing_issues: {
      urgent: 'individual_assessment',
      standard: 'breathing_fundamentals'
    },
    general_wellness: {
      urgent: 'comprehensive_evaluation',
      standard: 'starter_pack'
    }
  },

  // Logging Configuration
  LOGGING: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/bot.log',
    console: process.env.NODE_ENV !== 'production'
  },

  // Rate Limiting
  RATE_LIMITS: {
    survey_start: {
      window: 60 * 1000,
      max: 3
    },
    contact_submission: {
      window: 5 * 60 * 1000,
      max: 1
    }
  }
};
