import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-captcha',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="captcha-container">
      <div class="captcha-challenge">
        <canvas #captchaCanvas width="200" height="60"></canvas>
      </div>
      <div class="captcha-input-group">
        <input
          type="text"
          [(ngModel)]="userInput"
          (input)="onInputChange()"
          placeholder="Enter the code"
          class="captcha-input"
          [class.error]="showError"
          maxlength="6">
        <button type="button" class="captcha-refresh" (click)="generateCaptcha()">↻</button>
      </div>
      <p class="captcha-error" *ngIf="showError">Incorrect code. Please try again.</p>
    </div>
  `,
  styles: [`
    .captcha-container {
      margin: 20px 0;
    }

    .captcha-challenge {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 8px;
      display: inline-block;
      margin-bottom: 10px;
    }

    canvas {
      display: block;
      border-radius: 4px;
    }

    .captcha-input-group {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .captcha-input {
      flex: 1;
      padding: 12px;
      border: 2px solid var(--border-primary);
      border-radius: var(--border-radius-md);
      font-size: 16px;
      transition: all var(--transition-base);
    }

    .captcha-input:focus {
      outline: none;
      border-color: var(--border-accent);
      box-shadow: var(--shadow-focus);
    }

    .captcha-input.error {
      border-color: var(--status-error);
      background-color: var(--status-error-bg);
    }

    .captcha-refresh {
      padding: 12px 16px;
      background: var(--bmw-primary);
      color: var(--text-on-blue);
      border: none;
      border-radius: var(--border-radius-md);
      font-size: 20px;
      cursor: pointer;
      transition: all var(--transition-base);
    }

    .captcha-refresh:hover {
      background: var(--bmw-secondary);
      transform: rotate(180deg);
    }

    .captcha-error {
      color: var(--status-error);
      font-size: 14px;
      margin-top: 5px;
    }
  `]
})
export class CaptchaComponent implements OnInit {
  @Output() verified = new EventEmitter<boolean>();

  private captchaText = '';
  userInput = '';
  showError = false;

  ngOnInit() {
    this.generateCaptcha();
  }

  generateCaptcha() {
    this.captchaText = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.userInput = '';
    this.showError = false;
    this.drawCaptcha();
    this.verified.emit(false);
  }

  private drawCaptcha() {
    setTimeout(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 50; i++) {
        ctx.strokeStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.3)`;
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.stroke();
      }

      ctx.font = 'bold 32px Arial';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < this.captchaText.length; i++) {
        const char = this.captchaText[i];
        const x = 20 + i * 30;
        const y = 30 + (Math.random() * 10 - 5);
        const rotation = (Math.random() * 0.4 - 0.2);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        const colors = ['#333', '#666', '#999', '#667eea', '#764ba2'];
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillText(char, 0, 0);

        ctx.restore();
      }

      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(0, 0, 0, 0.2)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, Math.random() * canvas.height);
        ctx.bezierCurveTo(
          canvas.width * 0.33, Math.random() * canvas.height,
          canvas.width * 0.66, Math.random() * canvas.height,
          canvas.width, Math.random() * canvas.height
        );
        ctx.stroke();
      }
    });
  }

  onInputChange() {
    this.showError = false;

    if (this.userInput.length === 6) {
      if (this.userInput.toUpperCase() === this.captchaText) {
        this.verified.emit(true);
      } else {
        this.showError = true;
        this.verified.emit(false);
        setTimeout(() => this.generateCaptcha(), 1500);
      }
    } else {
      this.verified.emit(false);
    }
  }
}
