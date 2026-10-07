module.exports = {
  apps: [
    {
      name: "oma-digital",
      cwd: "./backend",
      script: "src/app.js",
      autorestart: true,
      max_restarts: 10
    }
  ]
};