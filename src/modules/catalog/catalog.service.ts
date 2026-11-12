import { CatalogRepository } from "./catalog.repository";
import { redis } from "../../shared/infrastructure/redis";
import { logger } from "../../shared/observability/logger";
import { withSpan } from "../../shared/observability/tracer";
import { Product } from "@prisma/client";

export class CatalogService {
  constructor(private readonly repository = new CatalogRepository()) {}

  /**
   * Padrão Cache-Aside para listagem de produtos.
   * Reduz latência no p95 para menos de 10ms em leituras repetidas.
   */
  async listProducts(category?: string, limit: number = 20): Promise<Product[]> {
    return withSpan("catalog.listProducts", async () => {
      const cacheKey = `catalog:products:${category || "all"}:${limit}`;

      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug({ cacheKey }, "Cache HIT para listagem de produtos");
          return JSON.parse(cached);
        }
      } catch (err: any) {
        logger.warn({ error: err.message }, "Falha ao consultar cache Redis, caindo para o banco");
      }

      logger.debug({ cacheKey }, "Cache MISS para listagem de produtos. Buscando no PostgreSQL");
      const products = await this.repository.findAll(category, limit);

      try {
        // Armazena no Redis com TTL de 60 segundos
        await redis.set(cacheKey, JSON.stringify(products), "EX", 60);
      } catch (err: any) {
        logger.warn({ error: err.message }, "Falha ao gravar cache no Redis");
      }

      return products;
    });
  }

  async getProductById(id: string): Promise<Product | null> {
    return withSpan("catalog.getProductById", async () => {
      const cacheKey = `catalog:product:${id}`;

      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err: any) {
        logger.warn({ error: err.message }, "Falha ao consultar cache Redis");
      }

      const product = await this.repository.findById(id);
      if (product) {
        try {
          await redis.set(cacheKey, JSON.stringify(product), "EX", 120);
        } catch (err: any) {
          logger.warn({ error: err.message }, "Falha ao gravar cache no Redis");
        }
      }

      return product;
    });
  }

  async createProduct(data: {
    name: string;
    slug: string;
    description?: string;
    price: number;
    category: string;
    stock: number;
  }): Promise<Product> {
    return withSpan("catalog.createProduct", async () => {
      const existing = await this.repository.findBySlug(data.slug);
      if (existing) {
        throw new Error(`Produto com slug "${data.slug}" já existe.`);
      }

      const product = await this.repository.create(data);

      // Invalidação de cache após escrita
      try {
        const keys = await redis.keys("catalog:products:*");
        if (keys.length > 0) {
          await redis.del(...keys);
          logger.debug({ totalKeys: keys.length }, "Caches de catálogo invalidados após criação");
        }
      } catch (err: any) {
        logger.warn({ error: err.message }, "Falha ao invalidar chaves de cache no Redis");
      }

      return product;
    });
  }
}

