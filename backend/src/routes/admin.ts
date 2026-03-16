import { Router } from "express";
import { z } from "zod";
import { authRequired, rolesRequired } from "../middleware/auth";
import { db } from "../lib/db";
import { slugify } from "../utils/slugify";

const router = Router();

const ORDER_STATUS = ["PENDING", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELED"] as const;

router.use(authRequired, rolesRequired("admin", "employee"));

const brandSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).optional(),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

const categorySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(120).optional(),
  description: z.string().max(400).optional(),
});

const productSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).optional(),
  sku: z.string().min(1).max(100),
  article: z.string().max(120).optional(),
  partId: z.string().max(120).optional(),
  price: z.number().nonnegative(),
  image: z.string().url().optional().or(z.literal("")),
  description: z.string().optional(),
  manufacturer: z.string().max(120).optional(),
  stock: z.number().int().nonnegative(),
  isAvailable: z.boolean().optional().default(true),
  brandId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  specsJson: z.string().optional(),
});

const normalizeBrandPayload = (body: z.infer<typeof brandSchema>) => {
  const slug = body.slug ? slugify(body.slug) : slugify(body.name);
  return {
    name: body.name.trim(),
    slug,
    logoUrl: body.logoUrl?.trim() ? body.logoUrl.trim() : null,
    description: body.description?.trim() ? body.description.trim() : null,
  };
};

router.get("/dashboard", (_req, res, next) => {
  try {
    const users = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
    const products = (db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number }).c;
    const brands = (db.prepare("SELECT COUNT(*) as c FROM brands").get() as { c: number }).c;
    const categories = (db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number }).c;
    const orders = (db.prepare("SELECT COUNT(*) as c FROM orders").get() as { c: number }).c;
    res.json({ users, products, brands, categories, orders });
  } catch (error) {
    next(error);
  }
});

router.get("/products", (_req, res, next) => {
  try {
    const items = db
      .prepare(
        `SELECT p.*,
                b.name as brandName,
                c.name as categoryName
         FROM products p
         JOIN brands b ON b.id = p.brand_id
         JOIN categories c ON c.id = p.category_id
         ORDER BY p.created_at DESC`,
      )
      .all();
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.post("/products", (req, res, next) => {
  try {
    const body = productSchema.parse(req.body);
    const result = db
      .prepare(
        `INSERT INTO products
         (name, slug, sku, article, part_id, price, image, description, manufacturer, stock, is_available, brand_id, category_id, specs_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        body.name,
        body.slug ? slugify(body.slug) : slugify(body.name),
        body.sku,
        body.article ?? null,
        body.partId ?? null,
        body.price,
        body.image || null,
        body.description ?? null,
        body.manufacturer ?? null,
        body.stock,
        body.isAvailable ? 1 : 0,
        body.brandId,
        body.categoryId,
        body.specsJson ?? null,
      );
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch (error) {
    next(error);
  }
});

router.put("/products/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = productSchema.parse(req.body);
    db.prepare(
      `UPDATE products
       SET name = ?, slug = ?, sku = ?, article = ?, part_id = ?, price = ?, image = ?, description = ?, manufacturer = ?,
           stock = ?, is_available = ?, brand_id = ?, category_id = ?, specs_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(
      body.name,
      body.slug ? slugify(body.slug) : slugify(body.name),
      body.sku,
      body.article ?? null,
      body.partId ?? null,
      body.price,
      body.image || null,
      body.description ?? null,
      body.manufacturer ?? null,
      body.stock,
      body.isAvailable ? 1 : 0,
      body.brandId,
      body.categoryId,
      body.specsJson ?? null,
      id,
    );
    res.json({ message: "Product updated" });
  } catch (error) {
    next(error);
  }
});

router.delete("/products/:id", (req, res, next) => {
  try {
    db.prepare("DELETE FROM products WHERE id = ?").run(Number(req.params.id));
    res.json({ message: "Product deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/brands", (_req, res, next) => {
  try {
    res.json(db.prepare("SELECT * FROM brands ORDER BY name ASC").all());
  } catch (error) {
    next(error);
  }
});

router.post("/brands", (req, res, next) => {
  try {
    const payload = normalizeBrandPayload(brandSchema.parse(req.body));
    const existing = db.prepare("SELECT id FROM brands WHERE slug = ?").get(payload.slug) as
      | { id: number }
      | undefined;
    if (existing) {
      return res.status(409).json({ message: "Brand slug already exists" });
    }

    const result = db
      .prepare("INSERT INTO brands (name, slug, logo_url, description) VALUES (?, ?, ?, ?)")
      .run(
        payload.name,
        payload.slug,
        payload.logoUrl,
        payload.description,
      );

    const brand = db.prepare("SELECT * FROM brands WHERE id = ?").get(Number(result.lastInsertRowid));
    res.status(201).json(brand);
  } catch (error) {
    next(error);
  }
});

router.put("/brands/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid brand id" });
    }

    const existingBrand = db.prepare("SELECT id FROM brands WHERE id = ?").get(id) as
      | { id: number }
      | undefined;
    if (!existingBrand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    const payload = normalizeBrandPayload(brandSchema.parse(req.body));
    const slugConflict = db
      .prepare("SELECT id FROM brands WHERE slug = ? AND id <> ?")
      .get(payload.slug, id) as { id: number } | undefined;
    if (slugConflict) {
      return res.status(409).json({ message: "Brand slug already exists" });
    }

    db.prepare(
      `UPDATE brands
       SET name = ?, slug = ?, logo_url = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(
      payload.name,
      payload.slug,
      payload.logoUrl,
      payload.description,
      id,
    );

    const brand = db.prepare("SELECT * FROM brands WHERE id = ?").get(id);
    res.json(brand);
  } catch (error) {
    next(error);
  }
});

router.delete("/brands/:id", (req, res, next) => {
  try {
    db.prepare("DELETE FROM brands WHERE id = ?").run(Number(req.params.id));
    res.json({ message: "Brand deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/categories", (_req, res, next) => {
  try {
    res.json(db.prepare("SELECT * FROM categories ORDER BY name ASC").all());
  } catch (error) {
    next(error);
  }
});

router.post("/categories", (req, res, next) => {
  try {
    const body = categorySchema.parse(req.body);
    const result = db
      .prepare("INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)")
      .run(body.name, body.slug ? slugify(body.slug) : slugify(body.name), body.description ?? null);
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch (error) {
    next(error);
  }
});

router.put("/categories/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = categorySchema.parse(req.body);
    db.prepare(
      `UPDATE categories
       SET name = ?, slug = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(body.name, body.slug ? slugify(body.slug) : slugify(body.name), body.description ?? null, id);
    res.json({ message: "Category updated" });
  } catch (error) {
    next(error);
  }
});

router.delete("/categories/:id", (req, res, next) => {
  try {
    db.prepare("DELETE FROM categories WHERE id = ?").run(Number(req.params.id));
    res.json({ message: "Category deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/orders", (_req, res, next) => {
  try {
    const orders = db
      .prepare(
        `SELECT o.*, u.email as userEmail, u.name as userName
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC`,
      )
      .all() as Array<{ id: number }>;
    const itemsStmt = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
    res.json(orders.map((order) => ({ ...order, items: itemsStmt.all(order.id) })));
  } catch (error) {
    next(error);
  }
});

router.patch("/orders/:id/status", (req, res, next) => {
  try {
    const statusSchema = z.object({ status: z.enum(ORDER_STATUS) });
    const { status } = statusSchema.parse(req.body);
    const id = Number(req.params.id);
    db.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

export default router;
