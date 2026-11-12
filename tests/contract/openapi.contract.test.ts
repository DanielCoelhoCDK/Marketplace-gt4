import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { buildApp } from "../../src/app";
import { prisma } from "../../src/shared/infrastructure/database";
import { redis } from "../../src/shared/infrastructure/redis";
import { paymentWorker, paymentQueue } from "../../src/modules/payment/payment.queue";
import fs from "fs";
import yaml from "yaml";
import path from "path";

describe("API Contract Testing (OpenAPI 3.1 Validation)", () => {
  const app = buildApp();
  let openapiSpec: any;

  beforeAll(async () => {
    await app.ready();
    const specPath = path.resolve(__dirname, "../../docs/openapi.yaml");
    const rawYaml = fs.readFileSync(specPath, "utf-8");
    openapiSpec = yaml.parse(rawYaml);
  });

  afterAll(async () => {
    await app.close();
    await paymentWorker.close();
    await paymentQueue.close();
    await redis.quit();
    await prisma.$disconnect();
  });

  it("o contrato OpenAPI deve estar na versão 3.1.0 e conter os 3 módulos", () => {
    expect(openapiSpec.openapi).toBe("3.1.0");
    const paths = Object.keys(openapiSpec.paths);

    expect(paths).toContain("/health");
    expect(paths).toContain("/api/v1/products");
    expect(paths).toContain("/api/v1/orders");
    expect(paths).toContain("/api/v1/payments");
  });

  it("contrato: GET /health deve cumprir a estrutura definida no schema HealthResponse", async () => {
    const res = await request(app.server).get("/health");
    expect(res.status).toBe(200);

    const schema = openapiSpec.components.schemas.HealthResponse;
    const requiredFields = schema.required;

    for (const field of requiredFields) {
      expect(res.body).toHaveProperty(field);
    }

    expect(typeof res.body.status).toBe("string");
    expect(typeof res.body.uptime).toBe("number");
  });

  it("contrato: GET /api/v1/products deve retornar itens que respeitam o schema Product", async () => {
    const res = await request(app.server).get("/api/v1/products?limit=5");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    if (res.body.length > 0) {
      const product = res.body[0];
      const productSchema = openapiSpec.components.schemas.Product;
      for (const field of productSchema.required) {
        expect(product).toHaveProperty(field);
      }
    }
  });

  it("contrato: GET /api/v1/orders deve respeitar a estrutura de OrderListResponse", async () => {
    const res = await request(app.server).get("/api/v1/orders?page=1&limit=5");
    expect(res.status).toBe(200);

    const listSchema = openapiSpec.components.schemas.OrderListResponse;
    for (const field of listSchema.required) {
      expect(res.body).toHaveProperty(field);
    }

    expect(typeof res.body.total).toBe("number");
    expect(typeof res.body.page).toBe("number");
    expect(typeof res.body.limit).toBe("number");
    expect(Array.isArray(res.body.orders)).toBe(true);
  });
});

