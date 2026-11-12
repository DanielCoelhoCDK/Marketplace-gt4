import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { buildApp } from "../../src/app";
import { prisma } from "../../src/shared/infrastructure/database";
import { redis } from "../../src/shared/infrastructure/redis";
import { paymentWorker, paymentQueue } from "../../src/modules/payment/payment.queue";
import { randomUUID } from "crypto";

describe("Marketplace Modular API (Integration)", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await paymentWorker.close();
    await paymentQueue.close();
    await redis.quit();
    await prisma.$disconnect();
  });

  it("GET /health deve responder 200 com status ok e conexões ativas", async () => {
    const res = await request(app.server).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.database).toBe("connected");
    expect(res.body.redis).toBe("connected");
  });

  it("GET /metrics deve expor métricas no formato do Prometheus", async () => {
    const res = await request(app.server).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("http_requests_total");
    expect(res.text).toContain("http_request_duration_seconds");
  });

  it("GET /api/v1/products deve listar produtos do catálogo", async () => {
    const res = await request(app.server).get("/api/v1/products");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("POST /api/v1/products deve criar novo produto", async () => {
    const uniqueSlug = `prod-teste-${Date.now()}`;
    const res = await request(app.server)
      .post("/api/v1/products")
      .send({
        name: "Produto Teste Integração",
        slug: uniqueSlug,
        price: 89.90,
        category: "testes",
        stock: 50
      });

    expect(res.status).toBe(201);
    expect(res.body.slug).toBe(uniqueSlug);
    expect(res.body.price).toBe(89.90);
  });

  it("GET /api/v1/orders deve retornar pedidos paginados (suporta 100k)", async () => {
    const res = await request(app.server).get("/api/v1/orders?page=1&limit=10");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page", 1);
    expect(res.body).toHaveProperty("limit", 10);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

  it("POST /api/v1/orders deve criar pedido e atualizar estoque atômico", async () => {
    // 1. Cria produto com estoque 10
    const slug = `prod-order-${Date.now()}`;
    const prodRes = await request(app.server)
      .post("/api/v1/products")
      .send({
        name: "Item Para Pedido",
        slug,
        price: 150.00,
        category: "checkout",
        stock: 10
      });

    const productId = prodRes.body.id;

    // 2. Cria pedido com 2 unidades
    const orderRes = await request(app.server)
      .post("/api/v1/orders")
      .send({
        customerEmail: "comprador@teste.com",
        items: [{ productId, quantity: 2 }]
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.totalAmount).toBe(300.00);
    expect(orderRes.body.status).toBe("PENDING");

    // 3. Verifica se estoque foi decrementado de 10 para 8
    const updatedProdRes = await request(app.server).get(`/api/v1/products/${productId}`);
    expect(updatedProdRes.body.stock).toBe(8);
  });

  it("POST /api/v1/payments deve processar pagamento com idempotência e rejeitar duplicação (409)", async () => {
    // 1. Cria produto e pedido
    const prod = await prisma.product.create({
      data: {
        name: "Produto Idempotência",
        slug: `prod-idemp-${Date.now()}`,
        price: 200.0,
        category: "idempotencia",
        stock: 100
      }
    });

    const order = await prisma.order.create({
      data: {
        customerEmail: "pagador@teste.com",
        totalAmount: 200.0,
        status: "PENDING",
        items: {
          create: [{ productId: prod.id, quantity: 1, unitPrice: 200.0 }]
        }
      }
    });

    const idempotencyKey = `idemp_${randomUUID()}`;

    // 2. Primeira submissão: Sucesso (202 Accepted no modo async ou 200 no síncrono)
    const payRes1 = await request(app.server)
      .post("/api/v1/payments")
      .send({
        orderId: order.id,
        method: "PIX",
        idempotencyKey
      });

    expect([200, 202]).toContain(payRes1.status);
    expect(payRes1.body.orderId).toBe(order.id);

    // 3. Segunda submissão com a MESMA chave: Rejeição com 409 Conflict
    const payRes2 = await request(app.server)
      .post("/api/v1/payments")
      .send({
        orderId: order.id,
        method: "PIX",
        idempotencyKey
      });

    expect(payRes2.status).toBe(409);
    expect(payRes2.body.error).toBe("ConflictError");
  });
});

