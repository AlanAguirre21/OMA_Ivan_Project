// El backend sirve también el frontend compilado (frontend/dist),
// así que basta un solo proceso en el puerto 3000.
module.exports = {
  apps: [
    {
      name: 'oma-digital',
      cwd: './backend',
      script: 'src/app.js',
      autorestart: true,
      max_restarts: 10,
      env: { NODE_ENV: 'production', PORT: 3000 },
    },
  ],
};
