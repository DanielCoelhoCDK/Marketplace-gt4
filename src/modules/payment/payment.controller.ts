import { FastifyReply, FastifyRequest } from "fastify";
import { PaymentService } from "./payment.service";
import { z } from "zod";

const processPaymentSchema = z.object({
  orderId: z.string().min(1),
  method: z.enum(["PIX", "CREDIT_CARD", "BOLETO"]),
  idempotencyKey: z.string().min(8)
});

export class PaymentController {
  constructor(private readonly service = new PaymentService()) {}

  async process(req: FastifyRequest, reply: FastifyReply) {
    const parseResult = processPaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Dados de pagamento inválidos.",
        details: parseResult.error.format()
      });
    }

    const { orderId, method, idempotencyKey } = parseResult.data;

    try {
      const result = await this.service.processPayment(orderId, method, idempotencyKey);
      const statusCode = result.async ? 202 : 200;
      return reply.status(statusCode).send(result);
    } catch (err: any) {
      const isConflict = err.message.includes("Duplicação") || err.message.includes("já está pago");
      const statusCode = isConflict ? 409 : 400;

      return reply.status(statusCode).send({
        error: isConflict ? "ConflictError" : "PaymentError",
        message: err.message
      });
    }
  }

  async getStatus(req: FastifyRequest, reply: FastifyReply) {
    const { orderId } = req.params as { orderId: string };
    const payment = await this.service.getPaymentStatus(orderId);

    if (!payment) {
      return reply.status(404).send({
        error: "NotFound",
        message: `Pagamento para o pedido ${orderId} não encontrado.`
      });
    }

    return reply.status(200).send(payment);
  }
}

