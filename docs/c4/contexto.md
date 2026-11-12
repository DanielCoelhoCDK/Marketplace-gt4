# Modelagem C4 — Marketplace Modular

Este documento descreve os diagramas de **Contexto do Sistema (Nível 1)** e **Contêineres (Nível 2)** do Modelo C4 para o Marketplace Modular.

---

## Nível 1: Diagrama de Contexto (System Context)

O diagrama de contexto apresenta os atores externos (Clientes e Operadores) e a fronteira do sistema com gateways externos.

```mermaid
graph TD
    User["👤 Cliente do Marketplace<br/>(Navegador / App Mobile)"]
    Admin["👤 Operador / Administrador<br/>(Gestão de Produtos e Estoque)"]
    Gateway["💳 Gateway de Pagamento Externo<br/>(Processador Pix / Cartão / Boleto)"]
    
    Marketplace["📦 Sistema Marketplace<br/>[Monólito Modular Fastify]<br/>Fornece catálogo, pedidos e orquestração de pagamento"]

    User -->|Consulta produtos, cria pedidos e consulta status [HTTPS]| Marketplace
    Admin -->|Cadastra e atualiza produtos do catálogo [HTTPS]| Marketplace
    Marketplace -->|Envia autorização e recebe webhooks de cobrança [HTTPS]| Gateway
```

---

## Nível 2: Diagrama de Contêineres (Container Diagram)

O diagrama de contêineres detalha as unidades de execução implantadas via Docker Compose.

```mermaid
graph TD
    Client["👤 Cliente HTTP / k6"]
    
    subgraph Host["Ambiente Docker Compose"]
        subgraph AppContainer["Contêiner da Aplicação (:3333)"]
            Fastify["Fastify HTTP Server<br/>(TypeScript / Node.js)"]
            
            subgraph Modulos["Módulos Internos (Fronteiras Explícitas)"]
                ModCat["src/modules/catalog<br/>(Busca e Detalhes)"]
                ModOrd["src/modules/orders<br/>(Checkout e 100k+ Pedidos)"]
                ModPay["src/modules/payment<br/>(BullMQ Worker + Idempotência)"]
            end
            
            Fastify --> ModCat
            Fastify --> ModOrd
            Fastify --> ModPay
        end

        PG[("PostgreSQL 16 (:5433 host / 5432 net)<br/>Tabelas: Products, Categories, Orders, OrderItems, Payments")]
        RedisDB[("Redis 7 (:6379)<br/>Cache-Aside (Catálogo) & Fila BullMQ (Pagamentos)")]
        Prometheus["Prometheus (:9090)<br/>Coleta de Métricas RED a cada 5s"]
    end

    Client -->|Requisições REST / JSON| Fastify
    
    ModCat -->|Cache read/write| RedisDB
    ModCat -->|Query fallback| PG
    
    ModOrd -->|Transações ACID| PG
    
    ModPay -->|Push / Pop jobs idempotentes| RedisDB
    ModPay -->|Atualização de status| PG
    
    Prometheus -->|Scrape /metrics| Fastify
```

---

## Resumo das Fronteiras e Responsabilidades

| Contêiner / Módulo | Tecnologia | Responsabilidade Principal |
| :--- | :--- | :--- |
| **Catalog Module** | TypeScript + Redis Cache-Aside | Consulta de produtos com sub-10ms no p95 para requisições em cache. |
| **Orders Module** | TypeScript + Prisma + PostgreSQL | Registro atômico de pedidos com volume sintético de 100.000 registros e paginação por cursor. |
| **Payment Module** | TypeScript + BullMQ + Strategy Pattern | Processamento desacoplado em background com proteção estrita contra duplicação de transação. |
| **PostgreSQL** | Relational Database (16-alpine) | Persistência confiável com constraints de integridade e índices otimizados. |
| **Redis** | In-Memory Data Store (7-alpine) | Cache distribuído com TTL e backend da fila de alta vazão. |
| **Prometheus** | Time-series Database | Monitoramento em tempo real das métricas RED (Taxa, Erro e Duração). |

