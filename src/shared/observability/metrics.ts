import client from "prom-client";

// Inicializa coleta padrão de métricas do Node.js (CPU, Memória, Event Loop)
client.collectDefaultMetrics({ prefix: "marketplace_" });

// Métricas RED (Rate, Errors, Duration)
export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total de requisições HTTP recebidas (Rate)",
  labelNames: ["method", "route", "status_code"]
});

export const httpRequestsErrorsTotal = new client.Counter({
  name: "http_requests_errors_total",
  help: "Total de requisições HTTP com erro 4xx ou 5xx (Errors)",
  labelNames: ["method", "route", "error_type"]
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duração das requisições HTTP em segundos (Duration / Percentis p95)",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5]
});

// SLO Declarado: % de requisições atendidas em menos de 100ms
export const sloTargetDurationSeconds = 0.100; // 100ms

export const register = client.register;

