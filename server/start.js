require('dotenv').config();
const { app, initPostgres, ensureDemoUser } = require('./app');

(async () => {
  try {
    await initPostgres();
    await ensureDemoUser();
  } catch (err) {
    console.error('Failed to initialize Postgres:', err.message);
    process.exit(1);
  }

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
})();
