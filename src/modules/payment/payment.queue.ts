import { Queue, Worker, Job } from "bullmq";
import { env } from "../../shared/config/env";
import { prisma } from "../../shared/infrastructure/database";
import { PaymentStrategyFactory } from "./strategies/payment.strategy";
import { logger } from "../../shared/observability/logger";
import { OrderStatus, PaymentStatus } from "@prisma/client";

export interface PaymentJobData {
  orderId: string;
  method: string;
  idempotencyKey: string;
  amount: number;
}

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT
};

export const paymentQueue = new Queue<PaymentJobData>("payments-queue", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

/**
 * Worker BullMQ que processa pagamentos assíncronos em background.
 */
export const paymentWorker = new Worker<PaymentJobData>(
  "payments-queue",
  async (job: Job<PaymentJobData>) => {
    const { orderId, method, idempotencyKey, amount } = job.data;
    logger.info({ orderId, method, idempotencyKey }, "Iniciando processamento assíncrono de pagamento pelo worker");

    const strategy = PaymentStrategyFactory.getStrategy(method);
    const result = await strategy.process(orderId, amount);

    if (result.success) {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.PAID }
        }),
        prisma.payment.update({
          where: { idempotencyKey },
          data: {
            status: PaymentStatus.PAID,
            processedAt: new Date()
          }
        })
      ]);

      logger.info({ orderId, transactionId: result.transactionId }, "Pagamento concluído com sucesso");
    } else {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.FAILED }
        }),
        prisma.payment.update({
          where: { idempotencyKey },
          data: {
            status: PaymentStatus.FAILED,
            processedAt: new Date()
          }
        })
      ]);

      logger.warn({ orderId }, "Pagamento falhou no processamento");
    }

    return result;
  },
  { connection, concurrency: 5 }
);

paymentWorker.on("error", (err) => {
  logger.error({ error: err.message }, "Erro no worker de pagamento");
});

