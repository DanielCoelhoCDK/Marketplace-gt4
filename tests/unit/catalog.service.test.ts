import { describe, it, expect, vi, beforeEach } from "vitest";
import { CatalogService } from "../../src/modules/catalog/catalog.service";
import { redis } from "../../src/shared/infrastructure/redis";

vi.mock("../../src/shared/infrastructure/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    keys: vi.fn().mockResolvedValue([]),
    del: vi.fn()
  }
}));

describe("Catalog Service - Cache-Aside (Unit)", () => {
  let mockRepo: any;
  let service: CatalogService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      create: vi.fn()
    };
    service = new CatalogService(mockRepo);
  });

  it("deve retornar do Redis quando houver Cache HIT", async () => {
    const cachedProducts = [{ id: "p1", name: "Produto Cacheado", price: 100 }];
    (redis.get as any).mockResolvedValue(JSON.stringify(cachedProducts));

    const result = await service.listProducts("informatica", 10);

    expect(result).toEqual(cachedProducts);
    expect(redis.get).toHaveBeenCalledWith("catalog:products:informatica:10");
    expect(mockRepo.findAll).not.toHaveBeenCalled();
  });

  it("deve consultar banco e salvar no Redis em caso de Cache MISS", async () => {
    (redis.get as any).mockResolvedValue(null);
    const dbProducts = [{ id: "p2", name: "Produto Banco", price: 200 }];
    mockRepo.findAll.mockResolvedValue(dbProducts);

    const result = await service.listProducts("informatica", 10);

    expect(result).toEqual(dbProducts);
    expect(mockRepo.findAll).toHaveBeenCalledWith("informatica", 10);
    expect(redis.set).toHaveBeenCalledWith(
      "catalog:products:informatica:10",
      JSON.stringify(dbProducts),
      "EX",
      60
    );
  });

  it("deve rejeitar criação de produto com slug duplicado", async () => {
    mockRepo.findBySlug.mockResolvedValue({ id: "p-existente", slug: "mouse-sem-fio" });

    await expect(
      service.createProduct({
        name: "Mouse",
        slug: "mouse-sem-fio",
        price: 50,
        category: "perifericos",
        stock: 10
      })
    ).rejects.toThrow('Produto com slug "mouse-sem-fio" já existe.');
  });
});

