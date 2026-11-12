import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  duration: "10s",
  thresholds: {
    http_req_duration: ["p(95)<50"], // 95% das requisições devem responder em < 50ms
    http_req_failed: ["rate<0.01"]   // Menos de 1% de erro
  }
};

const BASE_URL = __ENV.API_URL || "http://localhost:3333";

export default function () {
  // 1. Healthcheck
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    "health status is 200": (r) => r.status === 200
  });

  // 2. Consulta Catálogo de Produtos (Cache-Aside)
  const productsRes = http.get(`${BASE_URL}/api/v1/products?limit=10`);
  check(productsRes, {
    "products status is 200": (r) => r.status === 200,
    "products array returned": (r) => JSON.parse(r.body).length > 0
  });

  sleep(0.5);
}

