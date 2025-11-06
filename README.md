# Kolkata Scotty Bike Training - Full Stack Application

A complete bike training management platform built with Angular, Node.js/Express, and PostgreSQL. Production-ready with comprehensive admin panel, real-time booking system, and email notifications.

## 🚀 Features

### Customer Features
- **Google OAuth Authentication**: Secure sign-in using Google accounts
- **Real-time Slot Booking**: View and book available training slots
- **Trainer Selection**: Browse trainer profiles with ratings and experience
- **Vehicle Selection**: Choose between Scooty and Bike training
- **Booking Management**: View, track, and cancel bookings
- **Email Notifications**: Automatic booking confirmation emails
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### Admin Features
- **Dashboard**: Overview of bookings, slots, trainers, and daily statistics
- **Booking Management**: View, confirm, complete, or cancel bookings with advanced filters
- **Slot Management**: Create, edit, delete, and generate daily slots with capacity control
- **Trainer Management**: Add trainers, update profiles, toggle active status, and manage specializations
- **User Management**: View all users and manage roles (superadmin only)
- **Settings**: Configure system-wide settings
- **Toast Notifications**: User-friendly success/error notifications for all actions
- **Advanced Pagination**: Modern pill-style pagination with page numbers

## 🛠️ Tech Stack

### Frontend
- **Angular 17+**: Modern Angular framework with standalone components
- **RxJS**: Reactive programming for data management
- **TypeScript**: Type-safe development
- **CSS3**: Modern responsive design with gradients and animations

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web application framework
- **PostgreSQL**: Relational database
- **Passport.js**: Authentication middleware
- **JWT**: JSON Web Tokens for session management
- **Nodemailer**: Email service for notifications

### Authentication
- **Google OAuth 2.0**: Secure third-party authentication
- **JWT Tokens**: Stateless session management
- **Role-based Access Control**: Admin, trainer, and customer roles

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Google OAuth 2.0 credentials
- SMTP server credentials (for email notifications)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/AnnaSwetha/biketraining.git
cd biketraining
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 3. Database Setup

#### Create PostgreSQL Database

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE biketraining;
CREATE USER biketraining_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE biketraining TO biketraining_user;
\q
```

#### Apply Migrations

**Option A: Using PowerShell (Windows)**
```powershell
.\apply_postgresql_migration.ps1
```

**Option B: Using Bash (Linux/macOS)**
```bash
bash ./apply_postgresql_migration.sh
```

**Option C: Manual Migration**
```bash
cd backend
node apply_migration.js
```

### 4. Environment Configuration

1. Copy the example environment file:
   ```bash
   cd backend
   cp env.example.txt .env
   ```

2. Edit `backend/.env` with your configuration:
   - Database credentials (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
   - Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
   - JWT and session secrets
   - SMTP settings for email notifications
   - Frontend URL for OAuth redirects

**See [backend/ENV_SETUP.md](./backend/ENV_SETUP.md) for complete environment variable documentation.**

### 5. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback` (development)
6. Copy Client ID and Secret to `backend/.env`

### 6. Run Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Backend runs on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
npm start
# Frontend runs on http://localhost:4200
```

### 7. Access the Application

- **Customer Portal**: http://localhost:4200
- **Admin Panel**: http://localhost:4200/admin/login
- **API**: http://localhost:3000/api

## 📁 Project Structure

```
biketraining/
├── backend/                 # Node.js/Express backend
│   ├── config/             # Configuration files
│   ├── middleware/        # Express middleware
│   ├── routes/             # API routes
│   ├── services/         # Business logic services
│   ├── db.js              # Database connection
│   ├── server.js          # Express server
│   └── .env               # Environment variables (not in git)
├── src/                    # Angular frontend
│   ├── app/
│   │   ├── admin/         # Admin panel components
│   │   ├── components/    # Shared components
│   │   ├── guards/       # Route guards
│   │   ├── pages/        # Public pages
│   │   └── services/     # Angular services
│   └── environments/     # Environment configurations
├── supabase/
│   └── migrations/        # Database migration files
├── DEPLOYMENT.md          # Production deployment guide
└── README.md              # This file
```

## 🔐 Security Features

- Google OAuth 2.0 authentication
- JWT token-based session management
- Role-based access control (RBAC)
- Input validation and sanitization
- CORS configuration
- SQL injection prevention with parameterized queries
- Environment variable protection

## 📧 Email Notifications

The system sends automatic email notifications for:
- Booking confirmations
- Booking cancellations
- Status updates

Configure SMTP settings in `backend/.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@kolkatascotty.com
```

## 🚀 Production Deployment

For detailed deployment instructions, see **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

Quick overview:
1. Set up production PostgreSQL database
2. Configure environment variables
3. Build Angular frontend: `ng build --configuration production`
4. Deploy backend with PM2 or similar process manager
5. Configure Nginx reverse proxy
6. Set up SSL with Let's Encrypt
7. Update Google OAuth redirect URIs

## 📚 API Documentation

See **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** for complete API endpoint documentation.

## 🧪 Testing

### Backend Health Check
```bash
curl http://localhost:3000/api/health
```

### Test API Endpoints
```bash
# Get trainers
curl http://localhost:3000/api/trainers

# Get slots for a date
curl http://localhost:3000/api/slots/date/2025-01-15
```

## 🐛 Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check database credentials in `backend/.env`
- Ensure database exists and user has proper permissions

### OAuth Redirect Issues
- Verify `FRONTEND_URL` in `backend/.env` matches your frontend URL
- Check Google OAuth redirect URI matches exactly
- Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct

### Email Notifications Not Working
- Verify SMTP credentials in `backend/.env`
- Check SMTP server allows connections from your server
- For Gmail, use App Password instead of regular password

## 📝 License

Proprietary - All rights reserved

## 👥 Support

For issues and questions, please open an issue on GitHub or contact the development team.

---

**Built with ❤️ for Kolkata Scotty Bike Training**
