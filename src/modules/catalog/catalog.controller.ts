import { FastifyReply, FastifyRequest } from "fastify";
import { CatalogService } from "./catalog.service";
import { z } from "zod";

const createProductSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  price: z.number().positive(),
  category: z.string().min(2),
  stock: z.number().int().nonnegative().default(0)
});

export class CatalogController {
  constructor(private readonly service = new CatalogService()) {}

  async list(req: FastifyRequest, reply: FastifyReply) {
    const { category, limit } = req.query as { category?: string; limit?: string };
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 20;

    const products = await this.service.listProducts(category, parsedLimit);
    return reply.status(200).send(products);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const product = await this.service.getProductById(id);

    if (!product) {
      return reply.status(404).send({
        error: "NotFound",
        message: `Produto com ID ${id} não foi encontrado.`
      });
    }

    return reply.status(200).send(product);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const parseResult = createProductSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Dados do produto inválidos.",
        details: parseResult.error.format()
      });
    }

    try {
      const product = await this.service.createProduct(parseResult.data);
      return reply.status(201).send(product);
    } catch (err: any) {
      return reply.status(409).send({
        error: "Conflict",
        message: err.message
      });
    }
  }
}

