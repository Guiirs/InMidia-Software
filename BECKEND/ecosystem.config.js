module.exports = {
  apps: [
    {
      name: 'api-backend',
      script: 'dist/shared/infra/http/server.js',
      instances: 'max', // Utiliza todos os núcleos disponíveis
      exec_mode: 'cluster', // Modo cluster para balanceamento de carga
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      // Configurações de reinício automático
      autorestart: true,
      max_memory_restart: '1G', // Reinicia se usar mais de 1GB
      // Logs
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Configurações de cluster
      node_args: '--max-old-space-size=4096', // 4GB heap
      // Graceful shutdown
      kill_timeout: 5000, // 5 segundos para finalizar processos
      wait_ready: true,
      listen_timeout: 10000 // 10 segundos para aguardar ready
    }
  ]
};