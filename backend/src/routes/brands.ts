import { Router } from "express";
import { query, queryOne } from "../lib/db";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const search = (req.query.search as string | undefined)?.trim();
    const brands = search
      ? await query(
          `SELECT b.*,
                  (SELECT COUNT(*)::int FROM products p WHERE p.brand_id = b.id) as "productsCount"
           FROM brands b
           WHERE b.name ILIKE $1 OR b.description ILIKE $2
           ORDER BY b.name ASC`,
          [`%${search}%`, `%${search}%`],
        )
      : await query(
          `SELECT b.*,
                  (SELECT COUNT(*)::int FROM products p WHERE p.brand_id = b.id) as "productsCount"
           FROM brands b
           ORDER BY b.name ASC`,
        );
    res.json(brands);
  } catch (error) {
    next(error);
  }
});

router.get("/:slug", async (req, res, next) => {
  try {
    const brand = await queryOne(
      `SELECT b.*,
              (SELECT COUNT(*)::int FROM products p WHERE p.brand_id = b.id) as "productsCount"
       FROM brands b
       WHERE b.slug = $1`,
      [req.params.slug],
    );

    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }
    res.json(brand);
  } catch (error) {
    next(error);
  }
});

router.get("/:slug/products", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 12), 1), 60);
    const search = (req.query.search as string | undefined)?.trim();
    const inStock = req.query.inStock === "true";
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const manufacturer = (req.query.manufacturer as string | undefined)?.trim();
    const sort = (req.query.sort as string | undefined) ?? "new";

    const brand = await queryOne<{ id: number; slug: string }>(
      "SELECT * FROM brands WHERE slug = $1",
      [req.params.slug],
    );
    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    const where: string[] = ["p.brand_id = $1"];
    const params: unknown[] = [brand.id];

    if (search) {
      const base = params.length + 1;
      where.push(
        `(p.name ILIKE $${base} OR p.sku ILIKE $${base + 1} OR p.article ILIKE $${base + 2} OR p.part_id ILIKE $${base + 3})`,
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (inStock) {
      where.push("p.stock > 0 AND p.is_available = TRUE");
    }
    if (categoryId) {
      where.push(`p.category_id = $${params.length + 1}`);
      params.push(categoryId);
    }
    if (manufacturer) {
      where.push(`LOWER(p.manufacturer) = LOWER($${params.length + 1})`);
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
    const total = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM products p ${whereSql}`,
      params,
    );

    const items = await query(
      `SELECT p.*,
              CASE WHEN p.is_available THEN 1 ELSE 0 END as is_available,
              b.name as "brandName", b.slug as "brandSlug",
              c.name as "categoryName", c.slug as "categorySlug"
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    );

    const categories = await query(
      `SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.brand_id = $1) as "productsCount"
       FROM categories c
       WHERE EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id AND p.brand_id = $2)
       ORDER BY c.name ASC`,
      [brand.id, brand.id],
    );

    const manufacturers = (await query<{ manufacturer: string }>(
      "SELECT DISTINCT manufacturer FROM products WHERE brand_id = $1 AND manufacturer IS NOT NULL ORDER BY manufacturer ASC",
      [brand.id],
    ))
      .map((row) => (row as { manufacturer: string }).manufacturer);

    const totalCount = Number(total?.count ?? 0);

    res.json({
      brand,
      filters: { categories, manufacturers },
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
      },
      items,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
