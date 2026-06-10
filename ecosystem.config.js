/**
 * PM2 process config for Hostinger / VPS deployment.
 * Usage: pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [{
    name: 'kolkata-api',
    script: 'server.js',
    cwd: './backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production'
    },
    max_memory_restart: '512M',
    error_file: './logs/api-error.log',
    out_file: './logs/api-out.log',
    merge_logs: true,
    time: true,
    kill_timeout: 10000,
    listen_timeout: 10000,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
