import { Router } from "express";
import { db } from "../lib/db";

const router = Router();

router.get("/", (req, res, next) => {
  try {
    const search = (req.query.search as string | undefined)?.trim();
    const stmt = search
      ? db.prepare(
          `SELECT b.*,
                  (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) as productsCount
           FROM brands b
           WHERE b.name LIKE ? OR b.description LIKE ?
           ORDER BY b.name ASC`,
        )
      : db.prepare(
          `SELECT b.*,
                  (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) as productsCount
           FROM brands b
           ORDER BY b.name ASC`,
        );
    const brands = search ? stmt.all(`%${search}%`, `%${search}%`) : stmt.all();
    res.json(brands);
  } catch (error) {
    next(error);
  }
});

router.get("/:slug", (req, res, next) => {
  try {
    const brand = db
      .prepare(
        `SELECT b.*,
                (SELECT COUNT(*) FROM products p WHERE p.brand_id = b.id) as productsCount
         FROM brands b
         WHERE b.slug = ?`,
      )
      .get(req.params.slug);

    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }
    res.json(brand);
  } catch (error) {
    next(error);
  }
});

router.get("/:slug/products", (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 12), 1), 60);
    const search = (req.query.search as string | undefined)?.trim();
    const inStock = req.query.inStock === "true";
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const manufacturer = (req.query.manufacturer as string | undefined)?.trim();
    const sort = (req.query.sort as string | undefined) ?? "new";

    const brand = db.prepare("SELECT * FROM brands WHERE slug = ?").get(req.params.slug) as
      | { id: number; slug: string }
      | undefined;
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    const where: string[] = ["p.brand_id = ?"];
    const params: unknown[] = [brand.id];

    if (search) {
      where.push("(p.name LIKE ? OR p.sku LIKE ? OR p.article LIKE ? OR p.part_id LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (inStock) {
      where.push("p.stock > 0 AND p.is_available = 1");
    }
    if (categoryId) {
      where.push("p.category_id = ?");
      params.push(categoryId);
    }
    if (manufacturer) {
      where.push("LOWER(p.manufacturer) = LOWER(?)");
      params.push(manufacturer);
    }

    const orderBy =
      sort === "price_asc"
        ? "p.price ASC"
        : sort === "price_desc"
          ? "p.price DESC"
          : sort === "name_asc"
            ? "p.name ASC"
            : "p.created_at DESC";

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const total = db
      .prepare(`SELECT COUNT(*) as count FROM products p ${whereSql}`)
      .get(...params) as { count: number };

    const items = db
      .prepare(
        `SELECT p.*,
                b.name as brandName, b.slug as brandSlug,
                c.name as categoryName, c.slug as categorySlug
         FROM products p
         JOIN brands b ON b.id = p.brand_id
         JOIN categories c ON c.id = p.category_id
         ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
      )
      .all(...params, pageSize, (page - 1) * pageSize);

    const categories = db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.brand_id = ?) as productsCount
         FROM categories c
         WHERE EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id AND p.brand_id = ?)
         ORDER BY c.name ASC`,
      )
      .all(brand.id, brand.id);

    const manufacturers = db
      .prepare("SELECT DISTINCT manufacturer FROM products WHERE brand_id = ? AND manufacturer IS NOT NULL ORDER BY manufacturer ASC")
      .all(brand.id)
      .map((row) => (row as { manufacturer: string }).manufacturer);

    res.json({
      brand,
      filters: { categories, manufacturers },
      pagination: {
        total: total.count,
        page,
        pageSize,
        totalPages: Math.max(Math.ceil(total.count / pageSize), 1),
      },
      items,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
