import { FastifyInstance } from "fastify";
import { CatalogController } from "./catalog.controller";

export async function catalogRoutes(app: FastifyInstance) {
  const controller = new CatalogController();

  app.get("/api/v1/products", controller.list.bind(controller));
  app.get("/api/v1/products/:id", controller.getById.bind(controller));
  app.post("/api/v1/products", controller.create.bind(controller));
}

