import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { SettingsService, SiteSettings } from './services/settings.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="app-container">
      <header class="header" *ngIf="!isAdminRoute" [class.scrolled]="isScrolled">
        <div class="container">
          <div class="header-content">
            <div class="logo">
              <h2>{{ settings.site_name }}</h2>
              <span>Bike Training</span>
            </div>
            <button class="menu-toggle" (click)="toggleMenu()">
              <span></span>
              <span></span>
              <span></span>
            </button>
            <nav class="nav" [class.active]="menuOpen">
              <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="closeMenu()">Home</a>
              <a routerLink="/about" routerLinkActive="active" (click)="closeMenu()">About</a>
              <a routerLink="/courses" routerLinkActive="active" (click)="closeMenu()">Courses</a>
              <a routerLink="/trainers" routerLinkActive="active" (click)="closeMenu()">Trainers</a>
              <a routerLink="/contact" routerLinkActive="active" (click)="closeMenu()">Contact</a>
              <a routerLink="/booking" routerLinkActive="active" class="btn-login btn-book" (click)="closeMenu()">Book Now</a>

              <div class="user-menu" *ngIf="authService.isAuthenticated$ | async; else loginButton">
                <button class="user-btn" (click)="toggleUserMenu($event)">
                  <span class="user-avatar">{{ getUserInitial() }}</span>
                  <span class="user-name">{{ getUserName() }}</span>
                  <span class="dropdown-arrow">▼</span>
                </button>
                <div class="dropdown-menu" *ngIf="showUserMenu">
                  <a routerLink="/profile" (click)="closeMenus()">
                    <span class="menu-icon">👤</span> My Profile
                  </a>
                  <a routerLink="/my-bookings" (click)="closeMenus()">
                    <span class="menu-icon">📅</span> My Bookings
                  </a>
                  <button class="dropdown-item" (click)="signOut()">
                    <span class="menu-icon">🚪</span> Sign Out
                  </button>
                </div>
              </div>
              <ng-template #loginButton>
                <button class="btn-login" (click)="signIn()">
                  <svg width="18" height="18" viewBox="0 0 24 24" class="icon-spacing">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign In
                </button>
              </ng-template>
            </nav>
          </div>
        </div>
      </header>

      <main [class.no-padding-top]="isAdminRoute">
        <router-outlet></router-outlet>
      </main>

      <footer class="footer" *ngIf="!isAdminRoute">
        <div class="container">
          <div class="footer-content">
            <div class="footer-col">
              <h3>{{ settings.site_name }}</h3>
              <p>{{ settings.about_text }}</p>
              <div class="social-links" *ngIf="hasSocialLinks()">
                <a *ngIf="settings.social_facebook" [href]="settings.social_facebook" target="_blank" rel="noopener" class="social-link">Facebook</a>
                <a *ngIf="settings.social_instagram" [href]="settings.social_instagram" target="_blank" rel="noopener" class="social-link">Instagram</a>
                <a *ngIf="settings.social_youtube" [href]="settings.social_youtube" target="_blank" rel="noopener" class="social-link">YouTube</a>
              </div>
            </div>
            <div class="footer-col">
              <h4>Quick Links</h4>
              <ul>
                <li><a routerLink="/">Home</a></li>
                <li><a routerLink="/about">About</a></li>
                <li><a routerLink="/courses">Courses</a></li>
                <li><a routerLink="/trainers">Trainers</a></li>
                <li><a routerLink="/contact">Contact</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>Contact</h4>
              <ul>
                <li>Phone: {{ settings.contact_phone }}</li>
                <li>Email: {{ settings.contact_email }}</li>
                <li>{{ settings.contact_address }}</li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>Hours</h4>
              <ul>
                <li>Mon - Sat: 9 AM - 9 PM</li>
                <li>Sunday: 10 AM - 6 PM</li>
              </ul>
            </div>
          </div>
          <div class="footer-bottom">
            <p>{{ settings.footer_copyright }}</p>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    main {
      flex: 1 0 auto;
      display: flex;
      flex-direction: column;
      padding-top: 80px;
      min-height: 0;
    }

    main.no-padding-top {
      padding-top: 0;
    }

    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: var(--bg-primary);
      backdrop-filter: blur(10px);
      box-shadow: none;
      border-bottom: 1px solid var(--border-primary);
      z-index: 1000;
      transition: all var(--transition-slow);
    }

    .header.scrolled {
      box-shadow: var(--shadow-lg);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 0;
    }

    .logo h2 {
      margin: 0;
      font-size: 24px;
      color: var(--text-primary);
      font-weight: 700;
    }

    .logo span {
      font-size: 12px;
      color: var(--text-secondary);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .nav {
      display: flex;
      gap: 30px;
      align-items: center;
    }

    .nav a {
      text-decoration: none;
      color: var(--text-secondary);
      font-weight: 500;
      transition: color var(--transition-base);
      position: relative;
    }

    .nav a:hover {
      color: var(--primary-blue);
    }

    .nav a.active {
      color: var(--primary-blue);
    }

    .nav a.active::after {
      content: '';
      position: absolute;
      bottom: -5px;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--bmw-primary);
    }

    .btn-book {
      background: var(--bg-white);
      color: var(--primary-blue) !important;
      padding: 10px 25px;
      border-radius: 8px;
      border: 2px solid var(--primary-blue);
      transition: all var(--transition-base);
      font-weight: 600;
    }

    .btn-book:hover {
      background: var(--primary-blue);
      color: var(--text-on-blue) !important;
      transform: translateY(-2px);
      box-shadow: var(--shadow-blue);
    }

    .icon-spacing {
      margin-right: var(--spacing-sm);
    }

    .btn-login {
      display: flex;
      align-items: center;
      background: var(--bg-primary);
      color: var(--bmw-primary);
      border: 2px solid var(--primary-blue);
      padding: 10px 20px;
      border-radius: var(--border-radius-3xl);
      cursor: pointer;
      font-weight: 600;
      transition: all var(--transition-base);
    }

    .btn-login:hover {
      background: var(--bmw-secondary);
      color: var(--text-on-blue);
      border-color: var(--bmw-secondary);
      transform: translateY(-2px);
      box-shadow: var(--shadow-blue);
    }

    .user-menu {
      position: relative;
    }

    .user-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-white);
      color: var(--text-primary);
      border: 1px solid var(--border-light);
      padding: 8px 15px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      transition: all var(--transition-base);
    }

    .user-btn:hover {
      background: var(--bg-light);
      border-color: var(--border-light);
    }

    .user-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: var(--primary-blue);
      color: var(--text-on-blue);
      border-radius: 50%;
      font-weight: 600;
      font-size: 14px;
    }

    .user-name {
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .dropdown-arrow {
      font-size: 10px;
      transition: transform 0.3s;
    }

    .dropdown-menu {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      background: var(--bg-primary);
      border-radius: var(--border-radius-md);
      box-shadow: var(--shadow-lg);
      min-width: 200px;
      overflow: hidden;
      animation: slideDown 0.3s ease;
      z-index: 1001;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dropdown-menu a,
    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      color: var(--text-primary);
      text-decoration: none;
      transition: background 0.2s;
      width: 100%;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    .dropdown-menu a:hover,
    .dropdown-item:hover {
      background: var(--bg-hover);
    }

    .menu-icon {
      width: 16px;
      height: 16px;
      stroke-width: 2;
      flex-shrink: 0;
    }

    .menu-toggle {
      display: none;
      flex-direction: column;
      gap: 5px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 5px;
    }

    .menu-toggle span {
      width: 25px;
      height: 3px;
      background: var(--text-primary);
      transition: all 0.3s;
    }

    .footer {
      flex-shrink: 0;
      background: #1F2937;
      color: #FFFFFF;
      padding: 60px 0 30px;
      margin-top: auto;
    }

    .footer-content {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 48px;
      margin-bottom: 40px;
    }

    .footer-col:first-child {
      max-width: 350px;
    }

    .footer-col h3 {
      color: #FFFFFF;
      margin-bottom: 20px;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .footer-col h4 {
      margin-bottom: 20px;
      font-size: 14px;
      font-weight: 600;
      color: #FFFFFF;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .footer-col p {
      line-height: 1.7;
      color: #9CA3AF;
      font-size: 15px;
      margin-bottom: 16px;
    }

    .footer-col ul {
      list-style: none;
      padding: 0;
    }

    .footer-col ul li {
      margin-bottom: 12px;
      color: #9CA3AF;
      font-size: 15px;
    }

    .footer-col a {
      color: #9CA3AF;
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .footer-col a:hover {
      color: #FFFFFF;
    }

    .social-links {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }

    .social-link {
      display: inline-block;
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      transition: all 0.2s ease;
      font-size: 14px;
      color: #9CA3AF;
    }

    .social-link:hover {
      background: var(--primary-blue);
      color: #FFFFFF !important;
      border-color: var(--primary-blue);
    }

    .footer-bottom {
      text-align: center;
      padding-top: 30px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      color: #6B7280;
      font-size: 14px;
    }

    @media (max-width: 768px) {
      .menu-toggle {
        display: flex;
      }

      .nav {
        position: fixed;
        top: 70px;
        left: -100%;
        width: 100%;
        height: calc(100vh - 70px);
        background: var(--primary-color);
        flex-direction: column;
        padding: 40px 20px;
        transition: left 0.3s;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
      }

      .nav.active {
        left: 0;
      }

      .footer-content {
        grid-template-columns: 1fr;
        gap: 40px;
      }

      .footer-col:first-child {
        max-width: 100%;
      }
    }
  `]
})
export class AppComponent implements OnInit {
  isScrolled = false;
  menuOpen = false;
  showUserMenu = false;
  isAdminRoute = false;
  settings: SiteSettings = {
    site_name: 'Kolkata Scotty',
    site_logo: '',
    contact_email: 'info@kolkatascotty.com',
    contact_phone: '+91 98765 43210',
    contact_address: 'Kolkata, West Bengal',
    social_facebook: '',
    social_instagram: '',
    social_youtube: '',
    footer_copyright: '© 2025 Kolkata Scotty. All rights reserved.',
    about_text: 'Professional bike training for all skill levels.'
  };

  constructor(
    public authService: AuthService,
    private router: Router,
    private settingsService: SettingsService
  ) {}

  async ngOnInit() {
    // Subscribe to settings observable instead of calling loadSettings
    this.settingsService.settings$.subscribe(settings => {
      this.settings = settings;
    });

    this.checkAdminRoute(this.router.url);

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.checkAdminRoute(event.url);
        // After OAuth redirect to /profile, reload user profile if not loaded
        if (event.url === '/profile' && !this.authService.isAuthenticated()) {
          // Try to load user from httpOnly cookie
          this.authService.reloadUserProfile();
        }
      });

    window.addEventListener('scroll', () => {
      if (!this.isAdminRoute) {
        this.isScrolled = window.scrollY > 50;
      }
    });

    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-menu')) {
        this.showUserMenu = false;
      }
    });
  }


  hasSocialLinks(): boolean {
    return !!(this.settings.social_facebook || this.settings.social_instagram || this.settings.social_youtube);
  }

  private checkAdminRoute(url: string) {
    // Check if route starts with /admin but not /admin/login
    this.isAdminRoute = url.startsWith('/admin') && url !== '/admin/login' && !url.startsWith('/admin/login');
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  toggleUserMenu(event: Event) {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
  }

  closeMenus() {
    this.menuOpen = false;
    this.showUserMenu = false;
  }

  getUserName(): string {
    const profile = this.authService.getUserProfile();
    return profile?.full_name || profile?.email || 'User';
  }

  getUserInitial(): string {
    const name = this.getUserName();
    return name.charAt(0).toUpperCase();
  }

  async signIn() {
    try {
      await this.authService.signInWithGoogle();
    } catch {
      /* sign-in redirect handles errors */
    }
  }

  async signOut() {
    try {
      await this.authService.signOut();
      this.showUserMenu = false;
    } catch {
      /* session cleared in AuthService.finally */
    }
  }
}
