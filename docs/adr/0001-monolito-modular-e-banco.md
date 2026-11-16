# ADR 0001: Adoção de Monólito Modular e Estratégia de Persistência com Prisma

## Status
Aceito

## Contexto e Definição do Problema
O marketplace requer alta coesão e velocidade de evolução nos domínios de Catálogo, Pedidos e Pagamentos, além de capacidade para suportar mais de 100.000 pedidos com baixa latência (p95 sob controle).
Precisávamos decidir a arquitetura do sistema (monólito tradicional vs. microsserviços vs. monólito modular) e a estratégia de acesso e persistência a dados relacionais.

## Fatores de Decisão (Decision Drivers)
- Complexidade operacional: manter deploy e execução local simples (`docker compose up` em 1 comando).
- Consistência transacional: pedidos e reservas exigem garantias ACID no fechamento do carrinho.
- Custo de manutenção e latência de rede: evitar overhead de chamadas HTTP/gRPC entre serviços internos na mesma transação.
- Isolamento de domínio e limites explícitos: permitir que os módulos possam ser desacoplados no futuro sem acoplamento a tabelas alheias.

## Opções Consideradas
1. **Microsserviços distribuídos** (serviço de catálogo, serviço de pedidos e serviço de pagamento isolados com bancos próprios).
2. **Monólito Modular com Fastify e Pino** (um único processo de runtime em Fastify, módulos isolados por limites explícitos em código, logs estruturados nativos em JSON com Pino, banco de dados compartilhado logicamente com schemas/tabelas delimitadas).
3. **Monólito Clássico (Big Ball of Mud) com Express** (todas as regras misturadas em controladores globais, dependência de middlewares pesados externos para logs).

## Decisão Tomada
Optamos pela **Opção 2: Monólito Modular** desenvolvido sobre o framework **Fastify**, com **Prisma ORM** e **PostgreSQL**, complementado por **Redis** para cache-aside e **BullMQ** para processamento assíncrono.

### Justificativa
- **Monólito Modular:** Elimina a falácia da rede e a complexidade de transações distribuídas (Saga/2PC) na criação do pedido, mantendo a integridade referencial ACID.
- **Adoção do Fastify e Pino Nativo:** Ao contrário do Express, o Fastify integra nativamente o **Pino** como seu mecanismo de logging. Isso traz duas vantagens fundamentais para os requisitos de observabilidade e desempenho:
  1. **Logs estruturados em JSON de fábrica:** Todas as requisições e respostas já são serializadas em JSON padronizado com campos essenciais (`reqId`, `method`, `url`, `statusCode`, `responseTime`), atendendo diretamente ao requisito M3 de observabilidade sem necessidade de middlewares lentos de terceiros.
  2. **Baixo overhead e alta vazão:** O Pino é o logger mais rápido do ecossistema Node.js, operando de forma assíncrona e sem bloquear o Event Loop, o que é crucial para sustentar os SLOs de baixa latência (p95 < 50ms) durante os testes de carga com o k6.
- **Fronteiras Explícitas:** As fronteiras entre `catalog`, `orders` e `payment` são forçadas em nível de código (módulos exportam apenas contratos/serviços de domínio públicos).
- **Prisma ORM:** Fornece type safety de ponta a ponta, migrations declarativas e queries parametrizadas de alta performance (`createMany` para carga em lote).

### Consequências Positivas
- **Operação simples:** 1 único artefato executável (`dist/server.js`), facilitando pipelines de CI e deploy conteinerizado.
- **Transações ACID:** Criação de pedido e itens de pedido ocorrem em bloco atômico no PostgreSQL.
- **Caminho para migração futura:** Se um módulo (ex: `payment`) necessitar de escalabilidade independente, sua interface pública já está desacoplada.

### Consequências Negativas e Mitigações
- *Risco de acoplamento acidental no banco:* Mitigado pelo lint e revisão de arquitetura, garantindo que o módulo de pedidos não faça queries diretas nas tabelas privadas do módulo de catálogo sem passar pela camada de serviço.
- *Processo único pode ser ponto único de falha:* Mitigado pela conteinerização com healthchecks e reinicialização automática.

## Comparação das Alternativas

| Critério | Microsserviços | Monólito Clássico | Monólito Modular (Escolhido) |
| :--- | :--- | :--- | :--- |
| **Complexidade Operacional** | Alta (múltiplos deploys, rede) | Baixa | Baixa (1 deploy, 1 container) |
| **Integridade de Dados** | Complexa (consistência eventual) | Alta | Alta (transacional no Postgres) |
| **Fronteiras de Código** | Rígidas (físicas) | Inexistentes | Rígidas (lógicas em TypeScript) |
| **Latência Interna** | Alta (overhead de rede) | Baixa | Baixa (chamada em memória) |

