import { FastifyInstance } from "fastify";
import { PaymentController } from "./payment.controller";

export async function paymentRoutes(app: FastifyInstance) {
  const controller = new PaymentController();

  app.post("/api/v1/payments", controller.process.bind(controller));
  app.get("/api/v1/payments/:orderId", controller.getStatus.bind(controller));
}

