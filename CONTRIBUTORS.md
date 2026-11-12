# Contribuidores do Projeto

## Daniel Coelho (@DanielCoelhoCDK)
**Papel:** Engenheiro de Software & Arquiteto (Entrega Individual)

### Módulos e Responsabilidades:
- **Módulo 1 (Design & Fundamentos):**
  - Definição da arquitetura de Monólito Modular (`catalog`, `orders`, `payment`).
  - Modelagem do banco de dados relacional e aplicação de Database Patterns com Prisma ORM.
  - Implementação de Design Patterns: *Strategy Pattern* para processadores de pagamento e *Repository Pattern* para persistência.
  - Configuração do ambiente conteinerizado via Docker Compose.

- **Módulo 2 (Qualidade & Testes):**
  - Implementação da suite de testes unitários com Vitest cobrindo regras de negócio e cálculo de pedidos.
  - Implementação de testes de integração ponta a ponta (E2E) para os endpoints de API.
  - Implementação de testes de contrato de API validando a especificação OpenAPI 3.1.
  - Configuração do pipeline de cobertura de testes (Vitest v8) com thresholds mínimos.

- **Módulo 3 (Operação, DevOps & Observabilidade):**
  - Construção do pipeline de CI no GitHub Actions (`.github/workflows/ci.yml`) integrando lint, testes, coverage e segurança (SCA com Trivy/npm audit e Gitleaks).
  - Implementação de observabilidade: logs estruturados JSON com Pino e correlation ID (`x-request-id`).
  - Métricas RED (Rate, Errors, Duration) expostas para Prometheus e instrumentação básica OpenTelemetry.
  - Implementação de Feature Flag para chaveamento do fluxo assíncrono de pagamentos.

- **Módulo 4 (Arquitetura, Desempenho & Documentação):**
  - Elaboração das ADRs no padrão MADR documentando decisões arquiteturais e alternativas descartadas.
  - Modelagem C4 (diagramas de Contexto e Contêiner) documentados como código.
  - Especificação OpenAPI 3.1 com validação automatizada no pipeline via Spectral.
  - Script gerador de 100.000 pedidos sintéticos (`seed-100k.ts`) para simulação de carga real.
  - Estratégia de cache-aside com Redis para otimização de percentil p95 no catálogo.
  - Processamento assíncrono idempotente de pagamentos com BullMQ para proteção contra concorrência e cobranças duplicadas.
  - Execução e análise dos testes de carga com k6 (3 estágios: smoke, load, stress) com profiling e análise de consultas via `EXPLAIN ANALYZE`.

