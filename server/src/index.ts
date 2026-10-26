import { loadConfig } from './config';
import { buildApp } from './app';

async function main(): Promise<void> {
  const config = loadConfig();
  const { app } = await buildApp(config);

  const shutdown = async (signal: string) => {
    console.log(`[dock-cloud] received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.host, port: config.port });
  console.log(`[dock-cloud] listening on http://${config.host}:${config.port}`);
}

main().catch(error => {
  console.error('[dock-cloud] fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
