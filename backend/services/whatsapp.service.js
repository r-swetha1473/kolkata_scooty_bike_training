const https = require('https');
const http = require('http');

// WhatsApp notification service
// Supports AiSensy, Pabbly, Twilio, and Official WhatsApp API
class WhatsAppService {
  constructor() {
    this.enabled = !!(
      process.env.WHATSAPP_PROVIDER &&
      (process.env.WHATSAPP_API_KEY || process.env.WHATSAPP_API_URL)
    );
    this.provider = process.env.WHATSAPP_PROVIDER?.toLowerCase() || 'aisensy';
    
    if (!this.enabled) {
      console.warn('WhatsApp service disabled: Configuration missing');
    }
  }

  async sendMessage(phoneNumber, message, templateName = null) {
    if (!this.enabled) {
      console.log(`[WhatsApp] Would send to ${phoneNumber}: ${message.substring(0, 50)}...`);
      return { success: false, message: 'WhatsApp service not configured' };
    }

    // Normalize phone number (remove +, spaces, etc.)
    const normalizedPhone = phoneNumber.replace(/[^\d]/g, '');
    
    try {
      switch (this.provider) {
        case 'aisensy':
          return await this.sendViaAiSensy(normalizedPhone, message, templateName);
        case 'pabbly':
          return await this.sendViaPabbly(normalizedPhone, message, templateName);
        case 'twilio':
          return await this.sendViaTwilio(normalizedPhone, message, templateName);
        case 'whatsapp_api':
          return await this.sendViaOfficialAPI(normalizedPhone, message, templateName);
        default:
          console.error(`[WhatsApp] Unknown provider: ${this.provider}`);
          return { success: false, error: 'Unknown WhatsApp provider' };
      }
    } catch (error) {
      console.error(`[WhatsApp] Failed to send to ${phoneNumber}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendViaAiSensy(phoneNumber, message, templateName) {
    const apiKey = process.env.WHATSAPP_API_KEY;
    const apiUrl = process.env.WHATSAPP_API_URL || 'https://backend.aisensy.com/campaign/v1/send';
    const source = process.env.WHATSAPP_SOURCE || '919876543210'; // Default source number

    const payload = {
      apiKey,
      campaignName: templateName || 'booking_notification',
      destination: phoneNumber,
      userName: source,
      media: {
        url: null,
        filename: null
      },
      data: {
        message: message
      }
    };

    return this.makeRequest(apiUrl, payload, {
      'Content-Type': 'application/json',
      'apiKey': apiKey
    });
  }

  async sendViaPabbly(phoneNumber, message, templateName) {
    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;

    const payload = {
      phone: phoneNumber,
      message: message,
      template: templateName
    };

    return this.makeRequest(apiUrl, payload, {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    });
  }

  async sendViaTwilio(phoneNumber, message, templateName) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.WHATSAPP_API_KEY;
    const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.WHATSAPP_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM || process.env.WHATSAPP_SOURCE;

    const payload = {
      From: `whatsapp:${fromNumber}`,
      To: `whatsapp:${phoneNumber}`,
      Body: message
    };

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    return this.makeRequest(apiUrl, payload, {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`
    }, 'POST', true);
  }

  async sendViaOfficialAPI(phoneNumber, message, templateName) {
    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    const payload = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: {
        body: message
      }
    };

    if (templateName) {
      payload.type = 'template';
      payload.template = {
        name: templateName,
        language: { code: 'en' }
      };
    }

    return this.makeRequest(`${apiUrl}/v1/messages`, payload, {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    });
  }

  makeRequest(url, payload, headers, method = 'POST', isFormData = false) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: headers
      };

      const requestModule = urlObj.protocol === 'https:' ? https : http;
      
      const req = requestModule.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[WhatsApp] Sent successfully to ${payload.destination || payload.To || payload.to}`);
            resolve({ success: true, data: JSON.parse(data || '{}') });
          } else {
            console.error(`[WhatsApp] Failed: ${res.statusCode} - ${data}`);
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error(`[WhatsApp] Request error:`, error);
        reject(error);
      });

      if (isFormData) {
        const formData = new URLSearchParams(payload).toString();
        req.write(formData);
      } else {
        req.write(JSON.stringify(payload));
      }
      
      req.end();
    });
  }

  async sendBookingConfirmation(booking, user, slot, trainer, vehicle) {
    const message = `🎉 Booking Confirmed!\n\n` +
      `Dear ${user.full_name},\n\n` +
      `Your training slot has been confirmed:\n\n` +
      `📅 Date & Time: ${new Date(slot.start_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n` +
      `👨‍🏫 Trainer: ${trainer.full_name}\n` +
      `🏍️ Vehicle: ${vehicle.name}\n` +
      `📱 Status: ${booking.status}\n\n` +
      `Please arrive 10 minutes before your scheduled time.\n\n` +
      `Thank you for choosing Kolkata Scooty Bike Training!`;

    return this.sendMessage(user.phone, message, 'booking_confirmation');
  }

  async sendBookingReminder(booking, user, slot, trainer, vehicle) {
    const message = `⏰ Reminder: Your Training Session Tomorrow!\n\n` +
      `Dear ${user.full_name},\n\n` +
      `This is a reminder for your training session:\n\n` +
      `📅 Date & Time: ${new Date(slot.start_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n` +
      `👨‍🏫 Trainer: ${trainer.full_name}\n` +
      `🏍️ Vehicle: ${vehicle.name}\n\n` +
      `Please arrive 10 minutes before your scheduled time.\n\n` +
      `See you tomorrow!`;

    return this.sendMessage(user.phone, message, 'booking_reminder');
  }

  async sendBookingCancellation(booking, user, slot, trainer, vehicle) {
    const message = `❌ Booking Cancelled\n\n` +
      `Dear ${user.full_name},\n\n` +
      `Your booking has been cancelled:\n\n` +
      `📅 Date & Time: ${new Date(slot.start_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n` +
      `👨‍🏫 Trainer: ${trainer.full_name}\n` +
      `🏍️ Vehicle: ${vehicle.name}\n` +
      (booking.cancellation_reason ? `\nReason: ${booking.cancellation_reason}\n` : '') +
      `\nIf you need to reschedule, please visit our booking page.`;

    return this.sendMessage(user.phone, message, 'booking_cancellation');
  }

  async sendAdminAlert(booking, user, slot, trainer, vehicle) {
    const adminPhone = process.env.ADMIN_PHONE;
    if (!adminPhone) {
      return { success: false, message: 'Admin phone not configured' };
    }

    const message = `🔔 New Booking Alert!\n\n` +
      `A new booking has been made:\n\n` +
      `👤 Customer: ${user.full_name}\n` +
      `📱 Phone: ${user.phone}\n` +
      `📧 Email: ${user.email || 'N/A'}\n` +
      `📅 Date & Time: ${new Date(slot.start_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n` +
      `👨‍🏫 Trainer: ${trainer.full_name}\n` +
      `🏍️ Vehicle: ${vehicle.name}\n` +
      `📊 Booking ID: ${booking.id}`;

    return this.sendMessage(adminPhone, message, 'admin_alert');
  }
}

module.exports = new WhatsAppService();




