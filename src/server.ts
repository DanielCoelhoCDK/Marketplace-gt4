import { buildApp } from "./app";
import { env } from "./shared/config/env";
import { logger } from "./shared/observability/logger";
import { redis } from "./shared/infrastructure/redis";
import { prisma } from "./shared/infrastructure/database";
import { paymentWorker, paymentQueue } from "./modules/payment/payment.queue";

const app = buildApp();

async function start() {
  try {
    // Conecta Redis se necessário
    try {
      await redis.connect();
    } catch {
      // Lazy connect já gerencia reconexão
    }

    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, featureAsyncPayment: env.FEATURE_ASYNC_PAYMENT },
      `🚀 Servidor Marketplace Modular iniciado com sucesso na porta ${env.PORT}`
    );
  } catch (err) {
    logger.fatal({ err }, "Erro fatal ao iniciar a aplicação");
    process.exit(1);
  }
}

// Graceful Shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, "Recebido sinal de encerramento. Fechando conexões graciosamente...");
  try {
    await app.close();
    await paymentWorker.close();
    await paymentQueue.close();
    await redis.quit();
    await prisma.$disconnect();
    logger.info("Todas as conexões foram encerradas com sucesso.");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Erro durante encerramento gracioso");
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();

