import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="app-container">
      <header class="header" [class.scrolled]="isScrolled">
        <div class="container">
          <div class="header-content">
            <div class="logo">
              <h2>Kolkata Scotty</h2>
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
              <a routerLink="/booking" routerLinkActive="active" class="btn-book" (click)="closeMenu()">Book Now</a>

              <div class="user-menu" *ngIf="authService.isAuthenticated$ | async; else loginButton">
                <button class="user-btn" (click)="toggleUserMenu($event)">
                  <span class="user-avatar">{{ getUserInitial() }}</span>
                  <span class="user-name">{{ getUserName() }}</span>
                  <span class="dropdown-arrow">▼</span>
                </button>
                <div class="dropdown-menu" *ngIf="showUserMenu">
                  <a routerLink="/admin" *ngIf="authService.isAdmin()" (click)="closeMenus()">
                    <span class="menu-icon">⚙️</span> Admin Panel
                  </a>
                  <a routerLink="/booking" (click)="closeMenus()">
                    <span class="menu-icon">📅</span> My Bookings
                  </a>
                  <button class="dropdown-item" (click)="signOut()">
                    <span class="menu-icon">🚪</span> Sign Out
                  </button>
                </div>
              </div>
              <ng-template #loginButton>
                <button class="btn-login" (click)="signIn()">
                  <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 8px;">
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

      <main>
        <router-outlet></router-outlet>
      </main>

      <footer class="footer">
        <div class="container">
          <div class="footer-content">
            <div class="footer-col">
              <h3>Kolkata Scotty</h3>
              <p>Professional bike training for all skill levels. Learn from certified trainers in a safe environment.</p>
            </div>
            <div class="footer-col">
              <h4>Quick Links</h4>
              <ul>
                <li><a routerLink="/">Home</a></li>
                <li><a routerLink="/about">About</a></li>
                <li><a routerLink="/courses">Courses</a></li>
                <li><a routerLink="/trainers">Trainers</a></li>
              </ul>
            </div>
            <div class="footer-col">
              <h4>Contact</h4>
              <ul>
                <li>Phone: +91 98765 43210</li>
                <li>Email: info&#64;kolkatascotty.com</li>
                <li>Location: Kolkata, West Bengal</li>
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
            <p>&copy; 2025 Kolkata Scotty Bike Training. All rights reserved.</p>
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
      flex: 1;
      padding-top: 80px;
    }

    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      transition: all 0.3s ease;
    }

    .header.scrolled {
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
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
      padding: 15px 0;
    }

    .logo h2 {
      margin: 0;
      font-size: 24px;
      color: #2c3e50;
      font-weight: 700;
    }

    .logo span {
      font-size: 12px;
      color: #e74c3c;
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
      color: #2c3e50;
      font-weight: 500;
      transition: color 0.3s;
      position: relative;
    }

    .nav a:hover {
      color: #e74c3c;
    }

    .nav a.active::after {
      content: '';
      position: absolute;
      bottom: -5px;
      left: 0;
      right: 0;
      height: 2px;
      background: #e74c3c;
    }

    .btn-book {
      background: #e74c3c;
      color: white !important;
      padding: 10px 25px;
      border-radius: 25px;
      transition: all 0.3s;
    }

    .btn-book:hover {
      background: #c0392b;
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(231, 76, 60, 0.3);
    }

    .btn-login {
      display: flex;
      align-items: center;
      background: white;
      color: #2c3e50;
      border: 2px solid #e74c3c;
      padding: 10px 20px;
      border-radius: 25px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s;
    }

    .btn-login:hover {
      background: #e74c3c;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(231, 76, 60, 0.3);
    }

    .user-menu {
      position: relative;
    }

    .user-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8f9fa;
      border: 2px solid #e74c3c;
      padding: 8px 15px;
      border-radius: 25px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.3s;
    }

    .user-btn:hover {
      background: #e74c3c;
      color: white;
    }

    .user-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: #e74c3c;
      color: white;
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
      background: white;
      border-radius: 10px;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
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
      color: #2c3e50;
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
      background: #f8f9fa;
    }

    .menu-icon {
      font-size: 18px;
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
      background: #2c3e50;
      transition: all 0.3s;
    }

    .footer {
      background: #2c3e50;
      color: white;
      padding: 50px 0 20px;
      margin-top: 80px;
    }

    .footer-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 40px;
      margin-bottom: 30px;
    }

    .footer-col h3 {
      color: #e74c3c;
      margin-bottom: 15px;
    }

    .footer-col h4 {
      margin-bottom: 15px;
      font-size: 18px;
    }

    .footer-col p {
      line-height: 1.6;
      opacity: 0.9;
    }

    .footer-col ul {
      list-style: none;
      padding: 0;
    }

    .footer-col ul li {
      margin-bottom: 10px;
      opacity: 0.9;
    }

    .footer-col a {
      color: white;
      text-decoration: none;
      transition: color 0.3s;
    }

    .footer-col a:hover {
      color: #e74c3c;
    }

    .footer-bottom {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      opacity: 0.8;
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
        background: white;
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
        gap: 30px;
      }
    }
  `]
})
export class AppComponent implements OnInit {
  isScrolled = false;
  menuOpen = false;
  showUserMenu = false;

  constructor(public authService: AuthService) {}

  ngOnInit() {
    window.addEventListener('scroll', () => {
      this.isScrolled = window.scrollY > 50;
    });

    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-menu')) {
        this.showUserMenu = false;
      }
    });
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
    } catch (error) {
      console.error('Sign in error:', error);
    }
  }

  async signOut() {
    try {
      await this.authService.signOut();
      this.showUserMenu = false;
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }
}
