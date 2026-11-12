import { prisma } from "../../shared/infrastructure/database";
import { Order, OrderStatus } from "@prisma/client";

export class OrdersRepository {
  async findManyPaginated(page: number = 1, limit: number = 20): Promise<{ orders: Order[]; total: number }> {
    const skip = (page - 1) * limit;

    // Utiliza transaction para leitura paralela de contagem e registros
    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: true
        }
      }),
      prisma.order.count()
    ]);

    return { orders, total };
  }

  async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true
          }
        },
        payment: true
      }
    });
  }

  async createOrderWithItems(
    customerEmail: string,
    items: { productId: string; quantity: number; unitPrice: number }[],
    totalAmount: number
  ): Promise<Order> {
    return prisma.$transaction(async (tx) => {
      // Criação atômica do pedido e itens
      const order = await tx.order.create({
        data: {
          customerEmail,
          totalAmount,
          status: OrderStatus.PENDING,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            }))
          }
        },
        include: {
          items: true
        }
      });

      // Atualiza estoque dos produtos na mesma transação atômica
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        });
      }

      return order;
    });
  }

  async updateStatus(orderId: string, status: OrderStatus): Promise<Order> {
    return prisma.order.update({
      where: { id: orderId },
      data: { status }
    });
  }
}

