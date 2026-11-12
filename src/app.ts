import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { logger } from "./shared/observability/logger";
import {
  register,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestsErrorsTotal
} from "./shared/observability/metrics";
import { prisma } from "./shared/infrastructure/database";
import { redis } from "./shared/infrastructure/redis";
import { catalogRoutes } from "./modules/catalog/catalog.routes";
import { ordersRoutes } from "./modules/orders/orders.routes";
import { paymentRoutes } from "./modules/payment/payment.routes";
import { randomUUID } from "crypto";

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: false, // Usamos o Pino customizado via hooks para maior controle dos campos
    disableRequestLogging: true
  });

  // CORS
  app.register(cors, { origin: "*" });

  // OpenAPI Swagger UI
  app.register(swagger, {
    openapi: {
      info: {
        title: "Marketplace Modular API",
        version: "1.0.0",
        description: "API de Marketplace Modular - Projeto Final Full Cycle com IA"
      }
    }
  });

  app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false
    }
  });

  // Hook: Correlation ID e Início de Tempo
  app.addHook("onRequest", async (req, reply) => {
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();
    req.headers["x-request-id"] = requestId;
    reply.header("x-request-id", requestId);
    (req as any).startTime = process.hrtime();
  });

  // Hook: Métricas RED e Log Estruturado Pino na Resposta
  app.addHook("onResponse", async (req, reply) => {
    const startTime = (req as any).startTime;
    const diff = process.hrtime(startTime);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    const route = req.routeOptions?.url || req.url;
    const method = req.method;
    const statusCode = reply.statusCode.toString();

    // Incrementa métricas RED no Prometheus
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method, route, status_code: statusCode }, durationSeconds);

    if (reply.statusCode >= 400) {
      httpRequestsErrorsTotal.inc({
        method,
        route,
        error_type: reply.statusCode >= 500 ? "5xx" : "4xx"
      });
    }

    // Log estruturado com correlation ID
    logger.info(
      {
        requestId: req.headers["x-request-id"],
        method,
        url: req.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(durationSeconds * 1000)
      },
      `HTTP ${method} ${req.url} -> ${reply.statusCode} em ${(durationSeconds * 1000).toFixed(2)}ms`
    );
  });

  // Rota Healthcheck
  app.get("/health", async (_req, reply) => {
    let dbStatus = "connected";
    let redisStatus = "connected";

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "disconnected";
    }

    try {
      await redis.ping();
    } catch {
      redisStatus = "disconnected";
    }

    const isHealthy = dbStatus === "connected" && redisStatus === "connected";

    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      redis: redisStatus
    });
  });

  // Rota de Métricas Prometheus
  app.get("/metrics", async (_req, reply) => {
    const metricsData = await register.metrics();
    return reply.header("Content-Type", register.contentType).send(metricsData);
  });

  // Registro das rotas dos 3 Módulos
  app.register(catalogRoutes);
  app.register(ordersRoutes);
  app.register(paymentRoutes);

  return app;
}

