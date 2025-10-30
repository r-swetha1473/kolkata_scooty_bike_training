# Kolkata Scotty Bike Training - Full Stack Application

A complete bike training management platform built with Angular, Supabase, and Progressive Web App (PWA) capabilities.

## Features

### Customer Features
- **Google OAuth Authentication**: Secure sign-in using Google accounts
- **Real-time Slot Booking**: View and book available training slots with live updates
- **Trainer Selection**: Browse trainer profiles with ratings and experience
- **Image Captcha**: Bot protection on all booking forms
- **Booking Management**: View, track, and cancel bookings
- **Progressive Web App**: Install on mobile devices for native-like experience
- **Offline Support**: View previously loaded content without internet

### Admin Features
- **Dashboard**: Overview of bookings, slots, trainers, and daily statistics
- **Booking Management**: View, confirm, complete, or cancel bookings with filters
- **Slot Management**: Create, edit, and delete training slots with capacity control
- **Trainer Management**: Add trainers, update profiles, and toggle active status
- **User Management**: View all users and manage roles (superadmin only)
- **Settings**: Configure system-wide settings (cancellation policies, business hours)
- **Audit Logs**: Complete history of all admin actions with timestamps
- **Real-time Updates**: Automatic refresh when data changes

## Tech Stack

### Frontend
- **Angular 20**: Latest Angular framework with standalone components
- **RxJS**: Reactive programming for real-time updates
- **TypeScript**: Type-safe development
- **Progressive Web App**: Service Worker with offline caching

### Backend
- **Supabase**: PostgreSQL database with built-in authentication
- **Supabase Realtime**: WebSocket-based live data updates
- **Row Level Security**: Database-level access control

### Authentication
- **Google OAuth 2.0**: Secure third-party authentication
- **JWT Tokens**: Session management

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

The `.env` file contains Supabase credentials (already configured).

### 3. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials for your domain
3. In Supabase Dashboard: Authentication > Providers > Google
4. Add your Google Client ID and Secret

### 4. Seed Database

Run `supabase/seed.sql` in Supabase SQL Editor to create demo data.

### 5. Run Development Server

```bash
npm start
```

Navigate to `http://localhost:4200/`

### 6. Build for Production

```bash
npm run build
```

## Demo Credentials

- **Superadmin**: superadmin@demo.com
- **Admin**: admin@demo.com
- **Trainer**: trainer1@demo.com
- **Customer**: customer@demo.com

## Project Structure

```
src/app/
├── admin/          # Admin panel pages
├── components/     # Shared components
├── guards/         # Route guards
├── pages/          # Public pages
├── services/       # Services (auth, booking, admin)
└── app.routes.ts   # Routes configuration
```

## Key Features

- **Real-time Updates**: WebSocket subscriptions via Supabase Realtime
- **Concurrency-Safe Booking**: Atomic database operations prevent double-booking
- **Image Captcha**: Custom canvas-based bot protection
- **PWA**: Service Worker with offline support
- **Row Level Security**: Database-level access control

## Security

- Google OAuth 2.0 authentication
- JWT token management
- Row Level Security on all tables
- Input validation and sanitization
- CORS configuration

## Deployment

Deploy to Vercel with environment variables configured.

## License

Proprietary - All rights reserved
