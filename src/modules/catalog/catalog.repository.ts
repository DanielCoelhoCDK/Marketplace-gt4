import { prisma } from "../../shared/infrastructure/database";
import { Product } from "@prisma/client";

export class CatalogRepository {
  async findAll(category?: string, limit: number = 20): Promise<Product[]> {
    return prisma.product.findMany({
      where: category ? { category } : undefined,
      take: limit,
      orderBy: { createdAt: "desc" }
    });
  }

  async findById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { id }
    });
  }

  async findBySlug(slug: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { slug }
    });
  }

  async create(data: {
    name: string;
    slug: string;
    description?: string;
    price: number;
    category: string;
    stock: number;
  }): Promise<Product> {
    return prisma.product.create({
      data
    });
  }
}

