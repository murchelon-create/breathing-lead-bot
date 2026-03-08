# Перезапуск бота на Railway

## Что было исправлено

### Основная проблема
Лиды сохранялись через `lead_transfer.js`, но **не попадали** в `adminNotifications.leadDataStorage`, который использует админ-панель.

### Что сделано

1. **Исправлен `modules/integration/lead_transfer.js`:**
   - Добавлен конструктор с параметром `adminNotifications`
   - Добавлен метод `saveToAdminNotifications()` для сохранения лидов
   - Лиды теперь сохраняются в `adminNotifications.leadDataStorage`

2. **Исправлен `core/bot.js`:**
   - Изменен порядок инициализации: `adminNotifications` создаётся **ДО** `leadTransfer`
   - `LeadTransferSystem` теперь получает ссылку на `adminNotifications`

3. **Исправлены `stats_callbacks.js` и `leads_callbacks.js`:**
   - Добавлена инициализация `leadDataStorage`
   - Добавлены защитные проверки на пустые данные
   - Улучшено отображение сообщений

## Как применить изменения

### Вариант 1: Автоматическое развёртывание (Рекомендуется)

Railway автоматически заметит изменения в GitHub и переразвернет бота:

1. **Просто подождите 2-3 минуты** – Railway автоматически начнет новый deploy

2. **Проверьте статус:**
   - Откройте [Railway Dashboard](https://railway.app/)
   - Выберите ваш проект `breathing-lead-bot`
   - В разделе **Deployments** увидите новый deploy
   - Дождитесь статуса `✅ Active`

3. **Проверьте логи:**
   - Нажмите на сервис
   - Перейдите на вкладку **Logs**
   - Ищите строки:
     ```
     ✅ AdminNotificationSystem загружен
     ✅ LeadTransferSystem загружен с подключением к adminNotifications
     🚀 BreathingLeadBot успешно запущен
     ```

---

### Вариант 2: Ручной перезапуск

Если автоматическое развертывание не работает:

#### Через Railway Dashboard

1. Откройте [Railway Dashboard](https://railway.app/)
2. Выберите ваш проект `breathing-lead-bot`
3. Нажмите на сервис
4. В правом верхнем углу найдите **… (three dots)**
5. Выберите:
   - **Redeploy** (пересобрать и запустить) - **Рекомендуется**
   - ИЛИ **Restart** (просто перезапустить) - может не сработать

#### Через Railway CLI

```bash
# Установите Railway CLI (если еще не установлен)
npm install -g @railway/cli

# Войдите в аккаунт
railway login

# Подключитесь к проекту
railway link

# Перезапустите сервис
railway restart

# ИЛИ переразверните (рекомендуется)
railway redeploy

# Просмотр логов
railway logs
```

---

## Проверка работы

### 1. Проверьте логи запуска

В Railway Logs должны быть:

```
📦 Загрузка модулей системы...
✅ ExtendedSurveyQuestions загружен
✅ BreathingVERSEAnalysis загружен
✅ ContentGenerator загружен
✅ FileHandler загружен
✅ PDFManager полностью инициализирован и подключён
✅ AdminNotificationSystem загружен
✅ LeadTransferSystem загружен с подключением к adminNotifications  ← ВАЖНО!
✅ Все модули системы загружены успешно
🚀 BreathingLeadBot успешно запущен
```

### 2. Проверьте админ-панель

1. Откройте бота [@breathing_diagnostic_bot](https://t.me/breathing_diagnostic_bot)
2. Нажмите `/admin`
3. Проверьте каждую кнопку:

   - 📋 **Все лиды сегодня**
   - 📊 **Статистика**
   - 📈 **Аналитика**

### 3. Тестовое прохождение анкеты

1. Нажмите `/start`
2. Пройдите всю анкету
3. После завершения проверьте `/admin` → "Все лиды сегодня"
4. Ваш лид должен появиться в списке!

---

## Ожидаемые результаты

### ДО исправлений

Кнопки показывали:
```
📋 ВСЕ ЛИДЫ СЕГОДНЯ

• Всего сегодня: 0
• 🔥 Горячие: 0
• ⭐ Теплые: 0
```

📊 Статистика и 📈 Аналитика — пустые

### ПОСЛЕ исправлений

**Если лидов нет:**
```
📋 ЛИДЫ СЕГОДНЯ

✅ Сегодня лидов пока нет.

Когда пользователи завершат анкету, 
здесь появится список...

[🔄 Обновить] [📊 Аналитика дня]
```

**Если лиды есть:**
```
📋 ЛИДЫ СЕГОДНЯ (1)

📅 08.03.2026

⭐ Теплые (1):
   • Вячеслав (@ASPopov87) - 13:08

[🔄 Обновить] [📊 Аналитика дня]
```

**Статистика:**
```
📊 СТАТИСТИКА ЛИДОВ

📅 За всё время:
• Всего: 1
• 🔥 Горячие: 0
• ⭐ Теплые: 1
• ❄️ Холодные: 0
• 🌱 Для развития: 0

🎯 Конверсия: 100%
🎯 Средний VERSE: 63/100
```

---

## Если что-то пошло не так

### 1. Проверьте логи Railway

Ищите:
- `❌` - ошибки
- `⚠️` - предупреждения
- `✅ LeadTransferSystem загружен с подключением к adminNotifications` - это должно быть!

### 2. Проверьте переменные окружения

В Railway Dashboard:
1. Откройте сервис
2. Перейдите на **Variables**
3. Убедитесь, что есть:
   - `LEAD_BOT_TOKEN`
   - `ADMIN_ID`

### 3. Полный перезапуск

Если проблемы продолжаются:

```bash
# Через CLI
railway restart --yes

# ИЛИ через Dashboard:
# Service → … → Restart
```

### 4. Создайте Issue

Если проблема не решена:
1. Скопируйте логи из Railway
2. Сделайте скриншоты ошибок
3. Создайте [GitHub Issue](https://github.com/murchelon-create/breathing-lead-bot/issues)

---

## Дополнительная информация

### Разница между Restart и Redeploy

- **Restart**: Перезапускает существующий контейнер (без сборки)
- **Redeploy**: Собирает новый контейнер из GitHub (с новыми изменениями)

Для применения изменений из GitHub **обязательно Redeploy** или автоматическое развертывание.

### Автоматическое развертывание

Railway автоматически отслеживает изменения в вашей ветке GitHub (обычно `main`).
Каждый `git push` запускает новый deploy.

### Версия бота

После применения исправлений версия бота: **v2.8.0**

---

**Дата:** 08.03.2026  
**Статус:** Исправления применены в `main`  
**Commits:**
- [aa3deb7](https://github.com/murchelon-create/breathing-lead-bot/commit/aa3deb7f3e49916d25392ee897deb89712c7468f) - Исправлен lead_transfer.js
- [3286368](https://github.com/murchelon-create/breathing-lead-bot/commit/32863689ca1856077e884caff5d7ee1591e86752) - Исправлен core/bot.js
- [a1a1382](https://github.com/murchelon-create/breathing-lead-bot/commit/a1a13823519830e1d517346d069d2da29ab09113) - Исправлен stats_callbacks.js
- [a87ea94](https://github.com/murchelon-create/breathing-lead-bot/commit/a87ea949d34a71bb2146478363cbfa02b2a3360c) - Исправлен leads_callbacks.js