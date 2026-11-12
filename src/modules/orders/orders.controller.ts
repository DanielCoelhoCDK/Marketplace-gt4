import { FastifyReply, FastifyRequest } from "fastify";
import { OrdersService } from "./orders.service";
import { z } from "zod";

const createOrderSchema = z.object({
  customerEmail: z.string().email(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive()
    })
  ).min(1)
});

export class OrdersController {
  constructor(private readonly service = new OrdersService()) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const parsedPage = page ? Math.max(parseInt(page, 10), 1) : 1;
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 20;

    const result = await this.service.listOrders(parsedPage, parsedLimit);
    return reply.status(200).send({
      total: result.total,
      page: parsedPage,
      limit: parsedLimit,
      orders: result.orders
    });
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const order = await this.service.getOrderById(id);

    if (!order) {
      return reply.status(404).send({
        error: "NotFound",
        message: `Pedido ${id} não encontrado.`
      });
    }

    return reply.status(200).send(order);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const parseResult = createOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Dados de pedido inválidos.",
        details: parseResult.error.format()
      });
    }

    try {
      const order = await this.service.createOrder(
        parseResult.data.customerEmail,
        parseResult.data.items
      );
      return reply.status(201).send(order);
    } catch (err: any) {
      return reply.status(400).send({
        error: "OrderCreationError",
        message: err.message
      });
    }
  }
}

