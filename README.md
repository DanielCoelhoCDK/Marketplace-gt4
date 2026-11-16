# Projeto A — Marketplace Modular (Avançado)

> **Projeto Final de Engenharia de Software Full Cycle com IA**  
> **Autor:** Daniel Coelho ([@DanielCoelhoCDK](https://github.com/DanielCoelhoCDK))  
> **Status da CI:** [![CI Pipeline](https://github.com/DanielCoelhoCDK/Marketplace-gt4/actions/workflows/ci.yml/badge.svg)](https://github.com/DanielCoelhoCDK/Marketplace-gt4/actions/workflows/ci.yml)

---

## 1. Visão Geral da Arquitetura

O sistema é um **Monólito Modular** em TypeScript que simula um Marketplace de alta performance com três domínios bem delimitados:

1. **Catálogo (`src/modules/catalog`)**: Gestão de produtos e categorias, com padrão **Cache-Aside** no Redis para otimização do p95 de leitura sob alta concorrência.
2. **Pedidos (`src/modules/orders`)**: Orquestração do checkout transacional atômico no PostgreSQL com suporte a volume massivo (> 100.000 pedidos sintéticos) e paginação eficiente por cursor.
3. **Pagamento (`src/modules/payment`)**: Processamento assíncrono com **BullMQ** (Redis) e garantia estrita de **Idempotência** via chaves de transação para evitar cobranças duplicadas. Utiliza o **Strategy Pattern** para suportar múltiplos gateways e métodos (Pix, Cartão, Boleto).

```mermaid
graph TD
    Client(["Cliente / k6"]) -->|HTTP / JSON| API["Fastify API (Monólito Modular)"]
    
    subgraph Modulos["Módulos Internos"]
        API --> Cat["Módulo Catálogo"]
        API --> Ord["Módulo Pedidos"]
        API --> Pay["Módulo Pagamento"]
    end
    
    Cat -->|Cache-Aside (TTL 60s)| Redis[(Redis Cache)]
    Cat -->|Leitura Primária| PG[(PostgreSQL)]
    Ord -->|Transação Atômica (100k+ registros)| PG
    Pay -->|Enfileiramento & Idempotência| Bull[(Redis / BullMQ)]
    Pay -->|Atualização de Status| PG
    
    API -.->|Métricas RED (:9090)| Prom["Prometheus Server"]
    API -.->|Logs JSON Estruturados Nativos| Pino["Pino Logger (Nativo Fastify)"]
```

### Por que Fastify + Pino?
A escolha do **Fastify** como framework web e servidor HTTP se deu por sua alta performance e pelo fato de **trazer o logger Pino integrado nativamente**. Isso garante que todas as requisições gerem **logs estruturados em JSON** por padrão (incluindo `reqId`, `level`, `time`, `pid`), permitindo ingestão direta por coletores de logs sem a sobrecarga de middlewares pesados e sem bloquear o *Event Loop* do Node.js.

---

## 2. Como Subir o Projeto (1 Comando)

### Pré-requisitos
- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/) instalados.
- Node.js 18+ (opcional para desenvolvimento local sem container).

### Execução via Docker Compose
Para subir toda a infraestrutura (PostgreSQL, Redis, Aplicação e Prometheus):

```bash
docker compose up --build -d
```

A aplicação estará disponível em:
- **API:** `http://localhost:3333`
- **Healthcheck:** `http://localhost:3333/health`
- **Métricas Prometheus:** `http://localhost:3333/metrics`
- **Documentação OpenAPI:** `http://localhost:3333/docs`

---

## 3. Como Rodar os Testes

O projeto conta com pirâmide completa de testes utilizando **Vitest**:

```bash
# Instalação das dependências
npm install

# Testes unitários (regras de negócio e isolamento de módulos)
npm run test:unit

# Testes de integração (rotas HTTP ponta a ponta)
npm run test:integration

# Testes de contrato de API (validação contra OpenAPI 3.1)
npm run test:contract

# Suite completa com cobertura de código (v8)
npm run test:coverage

# Validação da documentação OpenAPI com Spectral
npm run lint:openapi
```

---

## 4. Volume de Dados (100 mil pedidos) & k6

Para gerar a base com mais de **100.000 pedidos sintéticos** e executar os testes de carga:

```bash
# Gera os 100 mil pedidos sintéticos no banco em segundos (bulk insert)
npm run seed:100k

# Executa os 3 estágios de testes com k6 (Smoke, Load e Stress)
npm run test:k6:smoke
npm run test:k6:load
npm run test:k6:stress
```

---

## 5. Documentação Adicional

Todos os artefatos de engenharia exigidos encontram-se na pasta `docs/`:
- [ADR 0001 — Monólito Modular e Estratégia de Persistência](docs/adr/0001-monolito-modular-e-banco.md)
- [C4 Model — Diagramas de Contexto e Contêiner](docs/c4/contexto.md)
- [Contrato OpenAPI 3.1](docs/openapi.yaml)
- [Relatório de Desempenho k6, p95 e EXPLAIN ANALYZE](docs/desempenho.md)
- [Registro de Engenharia e Prompts com IA](docs/ia.md)
- [Contribuidores e Divisão de Responsabilidades](CONTRIBUTORS.md)

