import { prisma } from "../../shared/infrastructure/database";
import { redis } from "../../shared/infrastructure/redis";
import { paymentQueue } from "./payment.queue";
import { PaymentStrategyFactory } from "./strategies/payment.strategy";
import { env } from "../../shared/config/env";
import { logger } from "../../shared/observability/logger";
import { withSpan } from "../../shared/observability/tracer";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";

export class PaymentService {
  /**
   * Processa pagamento com proteção estrita de Idempotência.
   * Suporta feature flag FEATURE_ASYNC_PAYMENT para alternar entre
   * processamento assíncrono em fila (BullMQ) ou síncrono.
   */
  async processPayment(orderId: string, method: string, idempotencyKey: string) {
    return withSpan("payment.processPayment", async () => {
      // 1. Verificação de existência do pedido
      const order = await prisma.order.findUnique({
        where: { id: orderId }
      });

      if (!order) {
        throw new Error(`Pedido ${orderId} não encontrado.`);
      }

      if (order.status === OrderStatus.PAID) {
        throw new Error(`O pedido ${orderId} já está pago.`);
      }

      // 2. Proteção de Idempotência via Redis (Lock atômico NX com expiração de 24h)
      const lockKey = `idempotency:${idempotencyKey}`;
      try {
        const lockAcquired = await redis.set(lockKey, orderId, "EX", 86400, "NX");
        if (!lockAcquired) {
          logger.warn({ idempotencyKey, orderId }, "Tentativa de processamento duplicado bloqueada pelo Redis");
          throw new Error("Duplicação detectada: chave de idempotência já utilizada.");
        }
      } catch (err: any) {
        if (err.message.includes("Duplicação detectada")) throw err;
        logger.warn({ error: err.message }, "Aviso: falha ao verificar chave de idempotência no Redis");
      }

      // 3. Verificação de Idempotência persistente no PostgreSQL
      const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey }
      });

      if (existingPayment) {
        throw new Error("Duplicação detectada: pagamento já registrado no banco de dados.");
      }

      // Registra o registro inicial do pagamento
      const payment = await prisma.payment.create({
        data: {
          orderId,
          method: method.toUpperCase() as PaymentMethod,
          status: PaymentStatus.PROCESSING,
          idempotencyKey,
          amount: order.totalAmount
        }
      });

      // 4. Feature Flag: chaveamento de processamento assíncrono vs síncrono
      if (env.FEATURE_ASYNC_PAYMENT) {
        logger.info({ orderId, idempotencyKey }, "Feature Flag ativa: enfileirando pagamento no BullMQ");
        
        await paymentQueue.add(
          "process-payment",
          {
            orderId,
            method,
            idempotencyKey,
            amount: order.totalAmount
          },
          {
            jobId: idempotencyKey // Garante unicidade do job na própria fila
          }
        );

        return {
          async: true,
          status: PaymentStatus.PROCESSING,
          orderId,
          idempotencyKey,
          message: "Pagamento recebido e enfileirado para processamento assíncrono."
        };
      } else {
        // Fallback síncrono se a feature flag estiver desligada
        logger.info({ orderId }, "Feature Flag inativa: executando pagamento de forma síncrona");
        const strategy = PaymentStrategyFactory.getStrategy(method);
        const result = await strategy.process(orderId, order.totalAmount);

        const updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: result.success ? PaymentStatus.PAID : PaymentStatus.FAILED,
            processedAt: new Date()
          }
        });

        if (result.success) {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: OrderStatus.PAID }
          });
        }

        return {
          async: false,
          status: updatedPayment.status,
          orderId,
          idempotencyKey,
          message: result.message
        };
      }
    });
  }

  async getPaymentStatus(orderId: string) {
    return withSpan("payment.getPaymentStatus", async () => {
      const payment = await prisma.payment.findUnique({
        where: { orderId }
      });

      if (!payment) {
        return null;
      }

      return {
        orderId: payment.orderId,
        status: payment.status,
        method: payment.method,
        processedAt: payment.processedAt
      };
    });
  }
}

