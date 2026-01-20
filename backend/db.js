const { Pool } = require('pg');
require('dotenv').config();

// Support both DATABASE_URL and individual connection parameters
let pool;

const isDevelopment = process.env.NODE_ENV !== 'production';

if (process.env.DATABASE_URL) {
  // Use connection string if available (Neon PostgreSQL uses DATABASE_URL)
  // Neon requires SSL connections, so we enable SSL for production
  const sslConfig = process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } // Required for Neon and most cloud PostgreSQL
    : (process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false);
  
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig,
    // Connection pool settings for production
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  if (isDevelopment) {
    console.log('Database: Connected using DATABASE_URL');
  }
} else {
  // Use individual parameters
  const dbConfig = {
    host: String(process.env.DB_HOST || 'localhost'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: String(process.env.DB_NAME || 'biketraining'),
    user: String(process.env.DB_USER || 'postgres'),
    password: process.env.DB_PASSWORD ? String(process.env.DB_PASSWORD) : undefined,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : (process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false),
    // Connection pool settings
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  // Log configuration (without password) for debugging in development only
  if (isDevelopment) {
    console.log('Database Configuration:');
    console.log(`  Host: ${dbConfig.host}`);
    console.log(`  Port: ${dbConfig.port}`);
    console.log(`  Database: ${dbConfig.database}`);
    console.log(`  User: ${dbConfig.user}`);
    console.log(`  Password: ${dbConfig.password ? '***' : '(empty - ensure PostgreSQL allows passwordless connection or set DB_PASSWORD)'}`);
  }

  pool = new Pool(dbConfig);
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};
