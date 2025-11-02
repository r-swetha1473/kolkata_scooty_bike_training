import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService, SiteSettings } from '../../services/settings.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent implements OnInit {
  formData = {
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  };

  showToast = false;
  toastMessage = '';

  contactInfo: any[] = [];
  settings: SiteSettings | null = null;

  constructor(private settingsService: SettingsService) {}

  async ngOnInit() {
    await this.settingsService.loadSettings();
    this.settings = this.settingsService.getSettings();
    this.updateContactInfo();
  }

  updateContactInfo() {
    if (!this.settings) return;
    this.contactInfo = [
      { icon: '📞', title: 'Phone', value: this.settings.contact_phone, link: `tel:${this.settings.contact_phone}` },
      { icon: '📧', title: 'Email', value: this.settings.contact_email, link: `mailto:${this.settings.contact_email}` },
      { icon: '📍', title: 'Location', value: this.settings.contact_address, link: '#' },
      { icon: '🕐', title: 'Hours', value: 'Mon-Sat: 9 AM - 9 PM', link: '#' }
    ];
  }

  branches = [
    { name: 'Salt Lake Branch', address: 'Sector V, Salt Lake, Kolkata - 700091', phone: '+91 98765 43210' },
    { name: 'Park Street Branch', address: 'Park Street, Kolkata - 700016', phone: '+91 98765 43211' },
    { name: 'Howrah Branch', address: 'Shibpur, Howrah - 711102', phone: '+91 98765 43212' }
  ];

  faqs = [
    { question: 'What documents do I need?', answer: 'You need a valid learner\'s license and identity proof (Aadhaar/PAN).' },
    { question: 'Can I reschedule my sessions?', answer: 'Yes, you can reschedule up to 24 hours before your session at no extra cost.' },
    { question: 'Do you provide pick-up service?', answer: 'We provide pick-up service within 5km of our training centers.' },
    { question: 'What is your refund policy?', answer: 'Full refund available if canceled 48 hours before the first session.' }
  ];

  socialLinks = [
    { icon: '📘', name: 'Facebook', url: '#' },
    { icon: '📸', name: 'Instagram', url: '#' },
    { icon: '🐦', name: 'Twitter', url: '#' },
    { icon: '💼', name: 'LinkedIn', url: '#' }
  ];

  onSubmit() {
    if (this.formData.name && this.formData.email && this.formData.message) {
      this.toastMessage = 'Thank you! We will contact you soon.';
      this.showToast = true;

      this.formData = {
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      };

      setTimeout(() => {
        this.showToast = false;
      }, 3000);
    }
  }
}
