import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 30 }, // Rampa de subida até 30 usuários simultâneos
    { duration: "20s", target: 30 }, // Carga constante sustentada
    { duration: "5s", target: 0 }    // Rampa de descida
  ],
  thresholds: {
    http_req_duration: ["p(95)<100"], // 95% das requisições sob carga devem responder em < 100ms
    http_req_failed: ["rate<0.02"]    // Menos de 2% de falhas
  }
};

const BASE_URL = __ENV.API_URL || "http://localhost:3333";

export default function () {
  // Teste misto: 70% leitura de catálogo (Redis Cache), 30% consulta a pedidos no banco (100k registros)
  const rand = Math.random();

  if (rand < 0.7) {
    const res = http.get(`${BASE_URL}/api/v1/products?limit=20`);
    check(res, {
      "catalog status is 200": (r) => r.status === 200
    });
  } else {
    const page = Math.floor(Math.random() * 50) + 1;
    const res = http.get(`${BASE_URL}/api/v1/orders?page=${page}&limit=20`);
    check(res, {
      "orders status is 200": (r) => r.status === 200,
      "orders has total": (r) => JSON.parse(r.body).total >= 100000
    });
  }

  sleep(0.2);
}

