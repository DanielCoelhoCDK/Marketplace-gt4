import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrdersService } from "../../src/modules/orders/orders.service";

describe("Orders Service (Unit)", () => {
  let mockOrdersRepo: any;
  let mockCatalogRepo: any;
  let service: OrdersService;

  beforeEach(() => {
    mockOrdersRepo = {
      findManyPaginated: vi.fn(),
      findById: vi.fn(),
      createOrderWithItems: vi.fn()
    };

    mockCatalogRepo = {
      findById: vi.fn()
    };

    service = new OrdersService(mockOrdersRepo, mockCatalogRepo);
  });

  it("deve rejeitar pedido sem itens", async () => {
    await expect(service.createOrder("cliente@exemplo.com", [])).rejects.toThrow(
      "O pedido deve conter ao menos um item."
    );
  });

  it("deve rejeitar item com quantidade menor ou igual a zero", async () => {
    await expect(
      service.createOrder("cliente@exemplo.com", [{ productId: "p1", quantity: 0 }])
    ).rejects.toThrow("Quantidade inválida para o item p1.");
  });

  it("deve rejeitar pedido se produto não for encontrado no catálogo", async () => {
    mockCatalogRepo.findById.mockResolvedValue(null);

    await expect(
      service.createOrder("cliente@exemplo.com", [{ productId: "p_inexistente", quantity: 1 }])
    ).rejects.toThrow("Produto p_inexistente não encontrado.");
  });

  it("deve rejeitar pedido se estoque for insuficiente", async () => {
    mockCatalogRepo.findById.mockResolvedValue({
      id: "p1",
      name: "Mouse Gamer",
      price: 150.0,
      stock: 2
    });

    await expect(
      service.createOrder("cliente@exemplo.com", [{ productId: "p1", quantity: 5 }])
    ).rejects.toThrow('Estoque insuficiente para o produto "Mouse Gamer". Disponível: 2');
  });

  it("deve calcular o totalAmount corretamente e invocar o repositório", async () => {
    mockCatalogRepo.findById.mockResolvedValueOnce({
      id: "p1",
      name: "Mouse",
      price: 100.0,
      stock: 10
    }).mockResolvedValueOnce({
      id: "p2",
      name: "Teclado",
      price: 250.0,
      stock: 5
    });

    mockOrdersRepo.createOrderWithItems.mockResolvedValue({
      id: "ord-999",
      customerEmail: "cliente@exemplo.com",
      totalAmount: 450.0,
      status: "PENDING"
    });

    const result = await service.createOrder("cliente@exemplo.com", [
      { productId: "p1", quantity: 2 }, // 200
      { productId: "p2", quantity: 1 }  // 250 -> Total = 450
    ]);

    expect(result.id).toBe("ord-999");
    expect(mockOrdersRepo.createOrderWithItems).toHaveBeenCalledWith(
      "cliente@exemplo.com",
      [
        { productId: "p1", quantity: 2, unitPrice: 100.0 },
        { productId: "p2", quantity: 1, unitPrice: 250.0 }
      ],
      450.0
    );
  });
});

