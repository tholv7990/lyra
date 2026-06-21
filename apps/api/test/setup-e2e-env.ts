// Runs before every e2e spec (jest setupFiles), so it lands before AppModule's
// ConfigModule loads .env. dotenv never overrides an already-set key, so forcing
// SMTP_HOST empty here keeps MailerService on its console-stub transport — e2e
// must never send real mail (it was hitting a live relay and getting 554-rate-
// limited, which also masked failures in the log).
process.env.SMTP_HOST = '';
