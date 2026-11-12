import { PrismaClient, OrderStatus } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const TARGET_ORDERS = 100_000;
const BATCH_SIZE = 5_000;

async function main() {
  console.log(`🚀 Iniciando verificação e geração de ${TARGET_ORDERS.toLocaleString()} pedidos sintéticos...`);

  // Garante que exista ao menos 1 produto no banco
  let product = await prisma.product.findFirst();
  if (!product) {
    product = await prisma.product.create({
      data: {
        name: "Produto Padrão de Carga",
        slug: "produto-padrao-carga",
        price: 99.90,
        category: "geral",
        stock: 1_000_000
      }
    });
  }

  const currentCount = await prisma.order.count();
  console.log(`📊 Total atual de pedidos no banco: ${currentCount.toLocaleString()}`);

  if (currentCount >= TARGET_ORDERS) {
    console.log(`✅ Base já possui ${currentCount.toLocaleString()} pedidos (meta de 100k atingida).`);
    return;
  }

  const needed = TARGET_ORDERS - currentCount;
  console.log(`⏳ Gerando ${needed.toLocaleString()} pedidos sintéticos adicionais em lotes de ${BATCH_SIZE}...`);

  const statuses: OrderStatus[] = [
    OrderStatus.PAID,
    OrderStatus.PAID,
    OrderStatus.PENDING,
    OrderStatus.CANCELLED
  ];

  const startTime = Date.now();
  let inserted = 0;

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  while (inserted < needed) {
    const currentBatchSize = Math.min(BATCH_SIZE, needed - inserted);
    const ordersBatch: {
      id: string;
      customerEmail: string;
      totalAmount: number;
      status: OrderStatus;
      createdAt: Date;
      updatedAt: Date;
    }[] = [];

    for (let i = 0; i < currentBatchSize; i++) {
      const orderIndex = currentCount + inserted + i;
      const status = statuses[orderIndex % statuses.length];
      const randomTimeOffset = Math.floor(Math.random() * thirtyDaysMs);
      const createdAt = new Date(now - randomTimeOffset);
      const amount = Math.round((20 + (orderIndex % 500) * 4.5) * 100) / 100;

      ordersBatch.push({
        id: randomUUID(),
        customerEmail: `cliente_${(orderIndex % 5000) + 1}@exemplo.com`,
        totalAmount: amount,
        status,
        createdAt,
        updatedAt: createdAt
      });
    }

    await prisma.order.createMany({
      data: ordersBatch,
      skipDuplicates: true
    });

    inserted += currentBatchSize;
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    const percent = ((inserted / needed) * 100).toFixed(1);
    console.log(`⚡ Inseridos: ${inserted.toLocaleString()} / ${needed.toLocaleString()} (${percent}%) em ${elapsedSeconds}s`);
  }

  const finalTotal = await prisma.order.count();
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`🎉 Sucesso! Banco de dados agora possui ${finalTotal.toLocaleString()} pedidos.`);
  console.log(`⏱️ Tempo total de geração de lote: ${totalElapsed} segundos.`);
}

main()
  .catch((e) => {
    console.error("Erro na geração de 100k pedidos:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

