import { OrdersRepository } from "./orders.repository";
import { CatalogRepository } from "../catalog/catalog.repository";
import { withSpan } from "../../shared/observability/tracer";
import { logger } from "../../shared/observability/logger";

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export class OrdersService {
  constructor(
    private readonly ordersRepo = new OrdersRepository(),
    private readonly catalogRepo = new CatalogRepository()
  ) {}

  async listOrders(page: number = 1, limit: number = 20) {
    return withSpan("orders.listOrders", async () => {
      return this.ordersRepo.findManyPaginated(page, limit);
    });
  }

  async getOrderById(id: string) {
    return withSpan("orders.getOrderById", async () => {
      return this.ordersRepo.findById(id);
    });
  }

  /**
   * Orquestra o checkout do pedido com validação de catálogo e cálculo atômico.
   */
  async createOrder(customerEmail: string, itemsInput: CreateOrderItemInput[]) {
    return withSpan("orders.createOrder", async () => {
      if (!itemsInput || itemsInput.length === 0) {
        throw new Error("O pedido deve conter ao menos um item.");
      }

      // Validação dos produtos e estoque no catálogo
      const resolvedItems: { productId: string; quantity: number; unitPrice: number }[] = [];
      let totalAmount = 0;

      for (const item of itemsInput) {
        if (item.quantity <= 0) {
          throw new Error(`Quantidade inválida para o item ${item.productId}.`);
        }

        const product = await this.catalogRepo.findById(item.productId);
        if (!product) {
          throw new Error(`Produto ${item.productId} não encontrado.`);
        }

        if (product.stock < item.quantity) {
          throw new Error(`Estoque insuficiente para o produto "${product.name}". Disponível: ${product.stock}`);
        }

        resolvedItems.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.price
        });

        totalAmount += product.price * item.quantity;
      }

      // Arredonda para 2 casas decimais
      totalAmount = Math.round(totalAmount * 100) / 100;

      logger.info(
        { customerEmail, totalItems: resolvedItems.length, totalAmount },
        "Iniciando transação atômica de checkout de pedido"
      );

      return this.ordersRepo.createOrderWithItems(customerEmail, resolvedItems, totalAmount);
    });
  }
}

