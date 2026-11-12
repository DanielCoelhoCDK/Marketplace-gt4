# Registro de Engenharia de Software com IA (`docs/ia.md`)

Este documento registra como ferramentas de Inteligência Artificial foram utilizadas como copiloto de engenharia ao longo do desenvolvimento deste projeto final, destacando as tomadas de decisão, alternativas descartadas e verificação técnica executada pelo autor.

---

## 1. Princípios de Engenharia Adotados com IA

1. **A IA sugere alternativas; a decisão é do engenheiro**: Nenhuma decisão arquitetural foi aceita cegamente sem validação contra os requisitos de robustez, testabilidade e simplicidade operacional.
2. **Código compreensível e explicável**: Todo código gerado ou refatorado foi inspecionado linha por linha para garantir que o autor consiga defendê-lo integralmente na banca e no histórico de commits.
3. **Verificação Executável**: Nenhuma sugestão da IA foi considerada pronta sem passar por testes automatizados (unitários, integração e contrato) e análise estática (lint e Spectral).

---

## 2. Prompts Estratégicos e Decisões de Arquitetura

### Interação 1: Escolha do Padrão Arquitetural e Nível do Projeto
- **Contexto / Problema:** Avaliação entre Projeto A (Avançado) e Projeto B (Simples), considerando a viabilidade de execução com padrão profissional e o medo de complexidade excessiva.
- **Prompt Utilizado:**
  > *"Analise os requisitos do Módulo 1 ao Módulo 4 do curso. Quero realizar o Projeto A (Marketplace Modular), mas preciso garantir que a arquitetura seja enxuta, sem camadas acidentais ou código mágico que eu não consiga explicar na apresentação de 10 minutos. Como estruturar os módulos mantendo fronteiras explícitas e alta performance?"*
- **Alternativas Sugeridas pela IA:**
  1. *Microsserviços completos com gRPC/Kafka*: Descartado por alta complexidade de infraestrutura e transações distribuídas desnecessárias para o escopo.
  2. *Clean Architecture com 6 camadas por rota*: Descartado por gerar boilerplates vazios e dificultar a legibilidade.
  3. *Monólito Modular Enxuto com Fastify, Prisma e Redis*: **Adotado**. Separação por módulos (`catalog`, `orders`, `payment`) com comunicação em memória bem tipada.
- **Decisão do Engenheiro:** Adotou-se o Monólito Modular Enxuto. A decisão foi formalizada na [ADR 0001](adr/0001-monolito-modular-e-banco.md).

---

### Interação 2: Estratégia de Inserção para 100 Mil Pedidos Sintéticos
- **Contexto / Problema:** A documentação exige pelo menos 100 mil pedidos no banco para avaliação de volume e p95. Inserções normais via ORM linha a linha demorariam minutos ou horas.
- **Prompt Utilizado:**
  > *"Como gerar 100.000 pedidos sintéticos no PostgreSQL com Prisma de forma ultra-otimizada em TypeScript, garantindo integridade referencial com clientes e produtos e execução em menos de 15 segundos?"*
- **Alternativas Sugeridas pela IA:**
  1. Loop assíncrono com `prisma.order.create()` (Lento, demoraria mais de 20 minutos).
  2. Inserção em lotes de 1.000 via `prisma.order.createMany()` combinado com chunks transacionais.
  3. Script de SQL nativo com `COPY` ou `generate_series`.
- **Decisão do Engenheiro:** Utilizou-se a abordagem com `prisma.order.createMany()` em blocos parametrizados de 5.000 registros com dados determinísticos. O tempo caiu para menos de 10 segundos, mantendo a compatibilidade estrita com o client do Prisma.

---

### Interação 3: Idempotência no Módulo de Pagamento
- **Contexto / Problema:** Proteger o endpoint e a fila de processamento contra submissões repetidas de pagamento em caso de falha de rede ou retry de cliente.
- **Prompt Utilizado:**
  > *"Desenhe um mecanismo de idempotência para o módulo de pagamentos utilizando Redis e BullMQ, assegurando que o mesmo orderId não processe duas vezes mesmo sob requisições concorrentes."*
- **Alternativas Sugeridas pela IA:**
  1. Constraint única simples no PostgreSQL (Pode gerar lock de linha e erro 500 não tratado).
  2. Chave de lock atômico no Redis (`SET NX EX`) combinada com JobId determinístico no BullMQ (`jobId = orderId`).
- **Decisão do Engenheiro:** Adotou-se o JobId determinístico no BullMQ associado a status no banco de dados. Isso garante que a fila descarte automaticamente mensagens duplicadas antes mesmo de invocar o worker de pagamento.

---

### Interação 4: Otimização de p95 com Cache-Aside e EXPLAIN ANALYZE
- **Contexto / Problema:** A listagem de produtos e pedidos precisa manter p95 inferior a 50ms sob carga de 50 VUs no k6.
- **Prompt Utilizado:**
  > *"Gere os scripts k6 em 3 estágios (smoke, load, stress) com thresholds explícitos de p95 e proponha a estratégia de cache-aside com TTL e índice no Postgres."*
- **Decisão do Engenheiro:** Validou os thresholds (`http_req_duration: ['p(95)<50']`), criou índice composto em `orders(created_at, status)` e validou o plano de execução via `EXPLAIN ANALYZE` antes e depois do índice e do cache Redis.

---

## 3. Conclusão da Avaliação

O uso de IA aumentou a velocidade de prototipação e geração de boilerplate de testes e documentação, permitindo que o foco principal ficasse na **tomada de decisão arquitetural, desenho dos limites de contexto e medição objetiva de desempenho**.

