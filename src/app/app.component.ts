import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

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
export class AppComponent {
  isScrolled = false;
  menuOpen = false;

  ngOnInit() {
    window.addEventListener('scroll', () => {
      this.isScrolled = window.scrollY > 50;
    });
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }
}
