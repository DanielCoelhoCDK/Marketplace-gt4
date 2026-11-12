import { FastifyInstance } from "fastify";
import { OrdersController } from "./orders.controller";

export async function ordersRoutes(app: FastifyInstance) {
  const controller = new OrdersController();

  app.get("/api/v1/orders", controller.list.bind(controller));
  app.get("/api/v1/orders/:id", controller.getById.bind(controller));
  app.post("/api/v1/orders", controller.create.bind(controller));
}

