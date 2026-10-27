import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { startSessionCleanupScheduler } from './services/sessionCleanup.service.js';

async function bootstrap() {
  // Connect database
  await connectDB();

  // Start background workers
  startSessionCleanupScheduler();

  // Start server
  const server = app.listen(env.PORT, () => {
    console.log(`\n🚀 ArchScale Auth Service running in [${env.NODE_ENV}] mode on port ${env.PORT}`);
    console.log(`📡 Healthcheck: http://localhost:${env.PORT}/health`);
    console.log(`🔗 API Base:    http://localhost:${env.PORT}/api/auth\n`);
  });

  // Graceful shutdown
  const handleShutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log('🏁 HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
