// Файл: modules/integration/lead_transfer.js
// ИСПРАВЛЕННАЯ ВЕРСИЯ - правильное сохранение лидов в adminNotifications

const axios = require('axios');
const config = require('../../config');

class LeadTransferSystem {
  constructor(adminNotifications = null) {
    this.retryAttempts = 3;
    this.retryDelay = 2000;
    
    this.mainBotWebhook = config.MAIN_BOT_API_URL;
    this.crmWebhook = config.CRM_WEBHOOK_URL;
    this.trainerContact = config.TRAINER_CONTACT;
    
    this.enableRetries = true;
    this.enableLogging = config.NODE_ENV !== 'production';
    
    // ИСПРАВЛЕНО: Сохраняем ссылку на adminNotifications
    this.adminNotifications = adminNotifications;
    
    // ИСПРАВЛЕНО: Режим автономной работы
    this.standaloneMode = !this.mainBotWebhook;
    
    if (this.standaloneMode) {
      console.log('🔄 LeadTransferSystem: Режим автономной работы (данные сохраняются локально)');
    }
    
    if (!this.adminNotifications) {
      console.warn('⚠️ LeadTransferSystem: adminNotifications не передан - данные будут сохраняться только локально');
    }
  }

  async processLead(userData) {
    console.log('🚀 Начинаем обработку лида:', userData.userInfo?.telegram_id);

    try {
      // ИСПРАВЛЕНО: Всегда сохраняем в adminNotifications первым делом
      await this.saveToAdminNotifications(userData);
      
      // ИСПРАВЛЕНО: Проверяем режим работы
      if (this.standaloneMode) {
        console.log('💾 Автономный режим: лид сохранен локально');
        return await this.saveLeadLocally(userData);
      }

      // Если есть основной бот - пытаемся передать
      await this.transferToMainBot(userData);

      // CRM интеграция (если настроена)
      if (config.FEATURES?.enable_crm_integration && this.crmWebhook) {
        await this.transferToCRM(userData);
      } else {
        console.log('⚠️ CRM интеграция отключена или не настроена');
      }

      await this.logLeadSuccess(userData);
      
    } catch (error) {
      console.error('❌ Критическая ошибка обработки лида:', error.message);
      
      // ИСПРАВЛЕНО: В случае ошибки всегда сохраняем локально
      console.log('💾 Сохраняем лид локально из-за ошибки передачи');
      await this.saveToAdminNotifications(userData);
      await this.saveLeadLocally(userData);
      await this.logLeadError(userData, error);
    }
  }

  /**
   * НОВЫЙ МЕТОД: Сохранение в adminNotifications.leadDataStorage
   */
  async saveToAdminNotifications(userData) {
    try {
      if (!this.adminNotifications) {
        console.warn('⚠️ adminNotifications недоступен, пропускаем сохранение');
        return;
      }

      const userId = userData.userInfo?.telegram_id;
      if (!userId) {
        console.error('❌ Отсутствует telegram_id в userData');
        return;
      }

      // Инициализируем leadDataStorage если не существует
      if (!this.adminNotifications.leadDataStorage) {
        console.log('🔧 Инициализация leadDataStorage');
        this.adminNotifications.leadDataStorage = {};
      }

      // Сохраняем полные данные лида
      this.adminNotifications.leadDataStorage[userId] = {
        userInfo: userData.userInfo,
        surveyType: userData.surveyType,
        surveyAnswers: userData.surveyAnswers,
        analysisResult: userData.analysisResult,
        timestamp: new Date().toISOString(),
        saved_via: 'lead_transfer'
      };

      console.log(`✅ Лид ${userId} сохранен в adminNotifications.leadDataStorage`);
      
      // Также обновляем сегмент если есть метод
      if (this.adminNotifications.updateStoredSegment && userData.analysisResult?.segment) {
        this.adminNotifications.updateStoredSegment(userId, userData.analysisResult.segment);
      }

      // Обновляем дневную статистику если есть метод
      if (this.adminNotifications.updateDailyStats && userData.analysisResult?.segment) {
        this.adminNotifications.updateDailyStats(userData.analysisResult.segment);
      }

    } catch (error) {
      console.error('❌ Ошибка сохранения в adminNotifications:', error);
      // Не выбрасываем ошибку, чтобы не останавливать процесс
    }
  }

  async transferToMainBot(userData) {
    if (!this.mainBotWebhook) {
      console.log('⚠️ Main bot webhook не настроен, данные сохраняются локально');
      return this.saveLeadLocally(userData);
    }

    const webhookUrl = `${this.mainBotWebhook}/api/leads/import`;
    console.log(`📤 Передаем лида в основной бот: ${userData.userInfo?.telegram_id}`);

    const payload = {
      timestamp: new Date().toISOString(),
      source: 'lead_bot',
      data: userData
    };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await axios.post(webhookUrl, payload, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'BreathingLeadBot/2.5',
            'X-Source': 'lead-bot'
          }
        });

        if (response.status >= 200 && response.status < 300) {
          console.log('✅ Лид успешно передан в основной бот');
          return response.data;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error(`❌ Попытка ${attempt}/${this.retryAttempts} неудачна:`, error.message);
        
        if (attempt === this.retryAttempts) {
          console.error('💥 Все попытки передачи в основной бот исчерпаны');
          // ИСПРАВЛЕНО: Не выбрасываем ошибку, а сохраняем локально
          return this.saveLeadLocally(userData);
        }
        
        if (this.enableRetries) {
          console.log(`⏳ Ожидание ${this.retryDelay}ms перед повтором...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
  }

  async transferToCRM(userData) {
    if (!this.crmWebhook) {
      console.log('⚠️ CRM webhook не настроен, пропускаем');
      return;
    }

    console.log(`📤 Передаем лида в CRM: ${userData.userInfo?.telegram_id}`);

    const crmPayload = {
      contact: {
        name: userData.userInfo?.first_name || 'Пользователь Telegram',
        telegram_id: userData.userInfo?.telegram_id,
        username: userData.userInfo?.username || '',
        source: 'Telegram Diagnostic Bot'
      },
      lead_info: {
        survey_type: userData.surveyType || 'adult',
        quality: userData.analysisResult?.segment || 'UNKNOWN',
        score: userData.analysisResult?.scores?.total || 0,
        primary_issue: userData.analysisResult?.primaryIssue || 'general_wellness',
        timestamp: new Date().toISOString()
      },
      survey_data: userData.surveyAnswers || {},
      analysis: userData.analysisResult || {}
    };

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await axios.post(this.crmWebhook, crmPayload, {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'BreathingLeadBot/2.5',
            'X-Source': 'telegram-lead-bot'
          }
        });

        if (response.status >= 200 && response.status < 300) {
          console.log('✅ Лид успешно передан в CRM');
          return response.data;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error(`❌ CRM попытка ${attempt}/${this.retryAttempts} неудачна:`, error.message);
        
        if (attempt === this.retryAttempts) {
          console.error('💥 Все попытки передачи в CRM исчерпаны');
          // ИСПРАВЛЕНО: Не останавливаем процесс, просто логируем
        } else if (this.enableRetries) {
          console.log(`⏳ Ожидание ${this.retryDelay}ms перед повтором...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
  }

  async saveLeadLocally(userData) {
    try {
      const leadData = {
        timestamp: new Date().toISOString(),
        telegram_id: userData.userInfo?.telegram_id,
        survey_type: userData.surveyType,
        segment: userData.analysisResult?.segment,
        score: userData.analysisResult?.scores?.total,
        primary_issue: userData.analysisResult?.primaryIssue,
        answers: userData.surveyAnswers,
        trainer_contact: this.trainerContact,
        
        // ИСПРАВЛЕНО: Добавляем дополнительную информацию
        user_info: userData.userInfo,
        analysis_result: userData.analysisResult,
        saved_locally: true,
        processing_mode: this.standaloneMode ? 'standalone' : 'fallback'
      };

      console.log('💾 ЛОКАЛЬНОЕ СОХРАНЕНИЕ ЛИДА:', JSON.stringify({
        telegram_id: leadData.telegram_id,
        segment: leadData.segment,
        score: leadData.score,
        timestamp: leadData.timestamp,
        mode: leadData.processing_mode
      }, null, 2));
      
      return { 
        success: true, 
        stored_locally: true, 
        data: leadData,
        mode: this.standaloneMode ? 'standalone' : 'fallback'
      };
    } catch (error) {
      console.error('❌ Ошибка локального сохранения:', error);
      return { success: false, error: error.message };
    }
  }

  async logLeadSuccess(userData) {
    if (!this.enableLogging) return;

    const logData = {
      event: 'lead_processed_successfully',
      timestamp: new Date().toISOString(),
      telegram_id: userData.userInfo?.telegram_id,
      survey_type: userData.surveyType,
      segment: userData.analysisResult?.segment,
      processing_time: Date.now() - (userData.startTime || Date.now()),
      mode: this.standaloneMode ? 'standalone' : 'integrated',
      saved_in_admin_panel: !!this.adminNotifications
    };

    console.log('✅ УСПЕШНАЯ ОБРАБОТКА ЛИДА:', JSON.stringify(logData, null, 2));
  }

  async logLeadError(userData, error) {
    const errorData = {
      event: 'lead_processing_error',
      timestamp: new Date().toISOString(),
      telegram_id: userData.userInfo?.telegram_id,
      error_message: error.message,
      error_stack: error.stack,
      userData_summary: {
        survey_type: userData.surveyType,
        has_answers: !!userData.surveyAnswers,
        has_analysis: !!userData.analysisResult
      },
      fallback_used: true
    };

    console.error('💥 ОШИБКА ОБРАБОТКИ ЛИДА:', JSON.stringify(errorData, null, 2));
  }

  async testConnections() {
    const results = {
      main_bot: { status: 'not_configured', url: this.mainBotWebhook },
      crm: { status: 'not_configured', url: this.crmWebhook },
      admin_notifications: { status: this.adminNotifications ? 'connected' : 'not_configured' },
      standalone_mode: this.standaloneMode,
      timestamp: new Date().toISOString()
    };

    if (this.mainBotWebhook) {
      try {
        const response = await axios.get(`${this.mainBotWebhook}/api/health`, { 
          timeout: 5000,
          validateStatus: () => true // Принимаем любой статус для диагностики
        });
        
        results.main_bot.status = response.status === 200 ? 'connected' : 'error';
        results.main_bot.response_time = response.headers['x-response-time'] || 'unknown';
        results.main_bot.http_status = response.status;
      } catch (error) {
        results.main_bot.status = 'error';
        results.main_bot.error = error.message;
      }
    }

    if (this.crmWebhook) {
      try {
        const testPayload = { test: true, timestamp: Date.now() };
        const response = await axios.post(this.crmWebhook, testPayload, { 
          timeout: 5000,
          validateStatus: () => true
        });
        results.crm.status = response.status >= 200 && response.status < 300 ? 'connected' : 'error';
        results.crm.http_status = response.status;
      } catch (error) {
        results.crm.status = 'error';
        results.crm.error = error.message;
      }
    }

    return results;
  }

  getStats() {
    return {
      configuration: {
        main_bot_configured: !!this.mainBotWebhook,
        crm_configured: !!this.crmWebhook,
        trainer_contact: this.trainerContact,
        retries_enabled: this.enableRetries,
        retry_attempts: this.retryAttempts,
        retry_delay: this.retryDelay,
        standalone_mode: this.standaloneMode,
        admin_notifications_connected: !!this.adminNotifications // НОВОЕ
      },
      endpoints: {
        main_bot: this.mainBotWebhook ? `${this.mainBotWebhook}/api/leads/import` : null,
        crm: this.crmWebhook,
        trainer: this.trainerContact
      },
      storage: {
        leads_in_admin_panel: this.adminNotifications?.leadDataStorage ? 
          Object.keys(this.adminNotifications.leadDataStorage).length : 0
      },
      version: '2.5.0', // Увеличиваем версию
      last_updated: new Date().toISOString()
    };
  }
}

module.exports = LeadTransferSystem;