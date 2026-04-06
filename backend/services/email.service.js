const nodemailer = require('nodemailer');

// Email service for sending notifications
// Configure using environment variables:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
class EmailService {
  constructor() {
    this.transporter = null;
    this.enabled = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    );

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      console.warn('Email service disabled: SMTP configuration missing');
    }
  }

  async sendEmail(to, subject, html, text) {
    if (!this.enabled) {
      console.log(`[Email] Would send to ${to}: ${subject}`);
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text: text || html.replace(/<[^>]*>/g, ''),
        html
      });

      console.log(`[Email] Sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`[Email] Failed to send to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendBookingConfirmation(booking, user, slot, trainer, vehicle) {
    const subject = 'Booking Confirmed - Kolkata Scotty Bike Training';
    const html = `
      <h2>Booking Confirmed!</h2>
      <p>Dear ${user.full_name},</p>
      <p>Your training slot has been confirmed:</p>
      <ul>
        <li><strong>Date & Time:</strong> ${new Date(slot.start_time).toLocaleString()}</li>
        <li><strong>Trainer:</strong> ${trainer.full_name}</li>
        <li><strong>Vehicle:</strong> ${vehicle.name}</li>
        <li><strong>Status:</strong> ${booking.status}</li>
      </ul>
      <p>Please arrive 10 minutes before your scheduled time.</p>
      <p>Thank you for choosing Kolkata Scotty Bike Training!</p>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendBookingCancellation(booking, user, slot, trainer, vehicle) {
    const subject = 'Booking Cancelled - Kolkata Scotty Bike Training';
    const html = `
      <h2>Booking Cancelled</h2>
      <p>Dear ${user.full_name},</p>
      <p>Your booking has been cancelled:</p>
      <ul>
        <li><strong>Date & Time:</strong> ${new Date(slot.start_time).toLocaleString()}</li>
        <li><strong>Trainer:</strong> ${trainer.full_name}</li>
        <li><strong>Vehicle:</strong> ${vehicle.name}</li>
        ${booking.cancellation_reason ? `<li><strong>Reason:</strong> ${booking.cancellation_reason}</li>` : ''}
      </ul>
      <p>If you need to reschedule, please visit our booking page.</p>
    `;

    return this.sendEmail(user.email, subject, html);
  }

  async sendAdminInactivityBlockAlert(users, days) {
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER;
    if (!adminEmail) {
      if (!this.enabled) {
        console.log(`[Email] Inactivity block: ${users.length} user(s); set ADMIN_ALERT_EMAIL to notify`);
      }
      return { success: false, message: 'No ADMIN_ALERT_EMAIL' };
    }

    const lines = users
      .map(
        (u) =>
          `<li>${u.full_name} &lt;${u.email}&gt; — last booking: ${u.last_booking_date || 'never'} — joined: ${u.created_at}</li>`
      )
      .join('');

    const subject = `[Kolkata Scotty] ${users.length} customer(s) blocked for ${days}-day inactivity`;
    const html = `
      <h2>Inactive customer accounts blocked</h2>
      <p>The following customers had no booking activity for at least <strong>${days}</strong> days and were marked <code>inactive_blocked</code>:</p>
      <ul>${lines}</ul>
      <p>They can be reactivated from Admin → Users (clear inactive flag).</p>
    `;

    return this.sendEmail(adminEmail, subject, html);
  }

  async sendTrainerChangeNotification(booking, user, slot, oldTrainer, newTrainer, vehicle) {
    const subject = 'Trainer Changed - Kolkata Scotty Bike Training';
    const html = `
      <h2>Trainer Update</h2>
      <p>Dear ${user.full_name},</p>
      <p>Your trainer has been changed for the following booking:</p>
      <ul>
        <li><strong>Date & Time:</strong> ${new Date(slot.start_time).toLocaleString()}</li>
        <li><strong>Previous Trainer:</strong> ${oldTrainer.full_name}</li>
        <li><strong>New Trainer:</strong> ${newTrainer.full_name}</li>
        <li><strong>Vehicle:</strong> ${vehicle.name}</li>
      </ul>
      <p>Thank you for your understanding.</p>
    `;

    return this.sendEmail(user.email, subject, html);
  }
}

module.exports = new EmailService();

