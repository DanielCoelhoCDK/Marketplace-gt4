import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 50 },  // Carga moderada
    { duration: "15s", target: 150 }, // Estresse elevado
    { duration: "15s", target: 250 }, // Ponto de ruptura / Stress extremo
    { duration: "10s", target: 0 }    // Recuperação
  ],
  thresholds: {
    // No estresse medimos o p95 e permitimos taxa de erro para identificar o gargalo
    http_req_duration: ["p(95)<300"],
    http_req_failed: ["rate<0.10"]
  }
};

const BASE_URL = __ENV.API_URL || "http://localhost:3333";

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/products?limit=20`);
  check(res, {
    "status is 200": (r) => r.status === 200
  });

  sleep(0.1);
}

