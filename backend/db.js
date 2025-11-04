const { Pool } = require('pg');
require('dotenv').config();

// Support both DATABASE_URL and individual connection parameters
let pool;

if (process.env.DATABASE_URL) {
  // Use connection string if available
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('Database Configuration: Using DATABASE_URL');
} else {
  // Use individual parameters
  const dbConfig = {
    host: String(process.env.DB_HOST || 'localhost'),
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: String(process.env.DB_NAME || 'biketraining'),
    user: String(process.env.DB_USER || 'postgres'),
    password: process.env.DB_PASSWORD ? String(process.env.DB_PASSWORD) : undefined,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };

  // Log configuration (without password) for debugging
  console.log('Database Configuration:');
  console.log(`  Host: ${dbConfig.host}`);
  console.log(`  Port: ${dbConfig.port}`);
  console.log(`  Database: ${dbConfig.database}`);
  console.log(`  User: ${dbConfig.user}`);
  console.log(`  Password: ${dbConfig.password ? '***' : '(empty - ensure PostgreSQL allows passwordless connection or set DB_PASSWORD)'}`);

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
