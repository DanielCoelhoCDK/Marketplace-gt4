import { PrismaClient, OrderStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed do catálogo de produtos...");

  const products = [
    {
      name: "Notebook Dell XPS 15",
      slug: "notebook-dell-xps-15",
      description: "Intel i9, 32GB RAM, 1TB SSD NVMe",
      price: 11999.00,
      category: "informatica",
      stock: 50
    },
    {
      name: "Monitor Gamer Curvo 34 144Hz",
      slug: "monitor-gamer-curvo-34",
      description: "Resolução WQHD 3440x1440 1ms HDR",
      price: 3499.00,
      category: "monitores",
      stock: 40
    },
    {
      name: "Teclado Mecânico RGB Hot-Swap",
      slug: "teclado-mecanico-rgb",
      description: "Switches Gateron Yellow com keycaps PBT",
      price: 450.00,
      category: "perifericos",
      stock: 120
    },
    {
      name: "Mouse Sem Fio Ultra-leve 58g",
      slug: "mouse-sem-fio-ultra-leve",
      description: "Sensor óptico 26k DPI, bateria de 80h",
      price: 380.00,
      category: "perifericos",
      stock: 150
    },
    {
      name: "Headset Wireless 7.1 Surround",
      slug: "headset-wireless-71",
      description: "Cancelamento de ruído ativo e drivers de 50mm",
      price: 699.00,
      category: "audio",
      stock: 80
    },
    {
      name: "Cadeira Ergonômica Mesh",
      slug: "cadeira-ergonomica-mesh",
      description: "Apoio lombar 3D e braços ajustáveis",
      price: 1290.00,
      category: "moveis",
      stock: 35
    }
  ];

  for (const item of products) {
    await prisma.product.upsert({
      where: { slug: item.slug },
      update: item,
      create: item
    });
  }

  console.log(`✅ ${products.length} produtos cadastrados com sucesso!`);

  // Cria um pedido inicial de teste
  const firstProduct = await prisma.product.findFirst();
  if (firstProduct) {
    const existingOrder = await prisma.order.findFirst();
    if (!existingOrder) {
      await prisma.order.create({
        data: {
          customerEmail: "aluno@fullcycle.com.br",
          totalAmount: firstProduct.price * 2,
          status: OrderStatus.PENDING,
          items: {
            create: [
              {
                productId: firstProduct.id,
                quantity: 2,
                unitPrice: firstProduct.price
              }
            ]
          }
        }
      });
      console.log("✅ Pedido inicial de demonstração criado.");
    }
  }
}

main()
  .catch((e) => {
    console.error("Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

