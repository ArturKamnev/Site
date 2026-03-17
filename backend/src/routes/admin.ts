import type { PoolClient } from "pg";
import { Router } from "express";
import { z } from "zod";
import { authRequired, rolesRequired } from "../middleware/auth";
import { query, queryOne, withTransaction } from "../lib/db";
import { slugify } from "../utils/slugify";

const router = Router();

const ORDER_STATUS = ["PENDING", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELED"] as const;
const parsePositiveId = (raw: string) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

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
  discountPercent: z.number().min(0).max(95).optional().default(0),
  image: z.string().url().optional().or(z.literal("")),
  description: z.string().optional(),
  manufacturer: z.string().max(120).optional(),
  stock: z.number().int().nonnegative(),
  isAvailable: z.boolean().optional().default(true),
  brandId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  specsJson: z.string().optional(),
});

const discountSchema = z.object({
  discountPercent: z.number().min(0).max(95),
});

const heroSlideSchema = z.object({
  label: z.string().trim().min(1).max(80),
  imageUrl: z.string().trim().url(),
  title: z.string().trim().max(160).optional().or(z.literal("")),
  subtitle: z.string().trim().max(260).optional().or(z.literal("")),
  buttonText: z.string().trim().max(60).optional().or(z.literal("")),
  buttonLink: z.string().trim().max(300).optional().or(z.literal("")),
  isActive: z.boolean().optional().default(true),
});

const heroSlideUpdateSchema = heroSlideSchema.partial();

const normalizeBrandPayload = (body: z.infer<typeof brandSchema>) => {
  const slug = body.slug ? slugify(body.slug) : slugify(body.name);
  return {
    name: body.name.trim(),
    slug,
    logoUrl: body.logoUrl?.trim() ? body.logoUrl.trim() : null,
    description: body.description?.trim() ? body.description.trim() : null,
  };
};

const normalizePricing = (price: number, discountPercent?: number) => {
  if (!discountPercent || discountPercent <= 0) {
    return {
      price,
      oldPrice: null as number | null,
      discountPercent: null as number | null,
    };
  }

  const normalizedDiscount = Number(discountPercent.toFixed(2));
  const oldPrice = Number((price / (1 - normalizedDiscount / 100)).toFixed(2));

  return {
    price,
    oldPrice,
    discountPercent: normalizedDiscount,
  };
};

const normalizeHeroSlidePayload = (payload: z.infer<typeof heroSlideSchema>) => ({
  label: payload.label.trim(),
  imageUrl: payload.imageUrl.trim(),
  title: payload.title?.trim() ? payload.title.trim() : null,
  subtitle: payload.subtitle?.trim() ? payload.subtitle.trim() : null,
  buttonText: payload.buttonText?.trim() ? payload.buttonText.trim() : null,
  buttonLink: payload.buttonLink?.trim() ? payload.buttonLink.trim() : null,
  isActive: payload.isActive,
});

const compactHeroSlidePositions = async (client?: PoolClient) => {
  const slides = await query<{ id: number }>("SELECT id FROM hero_slides ORDER BY position ASC", [], client);
  for (const [index, slide] of slides.entries()) {
    await query("UPDATE hero_slides SET position = $1 WHERE id = $2", [1000 + index, slide.id], client);
  }
  for (const [index, slide] of slides.entries()) {
    await query("UPDATE hero_slides SET position = $1 WHERE id = $2", [index + 1, slide.id], client);
  }
};

router.get("/dashboard", async (_req, res, next) => {
  try {
    const users = await queryOne<{ c: string }>("SELECT COUNT(*) as c FROM users");
    const products = await queryOne<{ c: string }>("SELECT COUNT(*) as c FROM products");
    const brands = await queryOne<{ c: string }>("SELECT COUNT(*) as c FROM brands");
    const categories = await queryOne<{ c: string }>("SELECT COUNT(*) as c FROM categories");
    const orders = await queryOne<{ c: string }>("SELECT COUNT(*) as c FROM orders");
    const heroSlides = await queryOne<{ c: string }>("SELECT COUNT(*) as c FROM hero_slides");
    res.json({
      users: Number(users?.c ?? 0),
      products: Number(products?.c ?? 0),
      brands: Number(brands?.c ?? 0),
      categories: Number(categories?.c ?? 0),
      orders: Number(orders?.c ?? 0),
      heroSlides: Number(heroSlides?.c ?? 0),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/products", async (_req, res, next) => {
  try {
    const items = await query(
      `SELECT p.*,
              CASE WHEN p.is_available THEN 1 ELSE 0 END as is_available,
              b.name as "brandName",
              c.name as "categoryName"
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       ORDER BY p.created_at DESC`,
    );
    res.json(items);
  } catch (error) {
    next(error);
  }
});

router.post("/products", async (req, res, next) => {
  try {
    const body = productSchema.parse(req.body);
    const pricing = normalizePricing(body.price, body.discountPercent);
    const created = await queryOne<{ id: number }>(
      `INSERT INTO products
       (name, slug, sku, article, part_id, price, old_price, discount_percent, image, description, manufacturer, stock, is_available, brand_id, category_id, specs_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        body.name,
        body.slug ? slugify(body.slug) : slugify(body.name),
        body.sku,
        body.article ?? null,
        body.partId ?? null,
        pricing.price,
        pricing.oldPrice,
        pricing.discountPercent,
        body.image || null,
        body.description ?? null,
        body.manufacturer ?? null,
        body.stock,
        body.isAvailable,
        body.brandId,
        body.categoryId,
        body.specsJson ?? null,
      ],
    );
    if (!created) {
      throw new Error("Could not create product");
    }
    res.status(201).json({ id: created.id });
  } catch (error) {
    next(error);
  }
});

router.put("/products/:id", async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid product id" });
    }
    const body = productSchema.parse(req.body);
    const pricing = normalizePricing(body.price, body.discountPercent);
    await query(
      `UPDATE products
       SET name = $1, slug = $2, sku = $3, article = $4, part_id = $5, price = $6, old_price = $7, discount_percent = $8,
           image = $9, description = $10, manufacturer = $11, stock = $12, is_available = $13, brand_id = $14, category_id = $15,
           specs_json = $16, updated_at = CURRENT_TIMESTAMP
       WHERE id = $17`,
      [
        body.name,
        body.slug ? slugify(body.slug) : slugify(body.name),
        body.sku,
        body.article ?? null,
        body.partId ?? null,
        pricing.price,
        pricing.oldPrice,
        pricing.discountPercent,
        body.image || null,
        body.description ?? null,
        body.manufacturer ?? null,
        body.stock,
        body.isAvailable,
        body.brandId,
        body.categoryId,
        body.specsJson ?? null,
        id,
      ],
    );
    res.json({ message: "Product updated" });
  } catch (error) {
    next(error);
  }
});

router.patch("/products/:id/discount", async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const body = discountSchema.parse(req.body);
    const product = await queryOne<{ id: number; price: number }>("SELECT id, price FROM products WHERE id = $1", [id]);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const pricing = normalizePricing(product.price, body.discountPercent);
    await query(
      "UPDATE products SET old_price = $1, discount_percent = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
      [pricing.oldPrice, pricing.discountPercent, id],
    );

    const updated = await queryOne(
      "SELECT p.*, CASE WHEN p.is_available THEN 1 ELSE 0 END as is_available FROM products p WHERE id = $1",
      [id],
    );
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/products/:id", async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid product id" });
    }
    await query("DELETE FROM products WHERE id = $1", [id]);
    res.json({ message: "Product deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/brands", async (_req, res, next) => {
  try {
    res.json(await query("SELECT * FROM brands ORDER BY name ASC"));
  } catch (error) {
    next(error);
  }
});

router.post("/brands", async (req, res, next) => {
  try {
    const payload = normalizeBrandPayload(brandSchema.parse(req.body));
    const existing = await queryOne<{ id: number }>("SELECT id FROM brands WHERE slug = $1", [payload.slug]);
    if (existing) {
      return res.status(409).json({ message: "Brand slug already exists" });
    }

    const created = await queryOne<{ id: number }>(
      "INSERT INTO brands (name, slug, logo_url, description) VALUES ($1, $2, $3, $4) RETURNING id",
      [payload.name, payload.slug, payload.logoUrl, payload.description],
    );
    if (!created) {
      throw new Error("Could not create brand");
    }
    const brand = await queryOne("SELECT * FROM brands WHERE id = $1", [created.id]);
    res.status(201).json(brand);
  } catch (error) {
    next(error);
  }
});

router.put("/brands/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid brand id" });
    }

    const existingBrand = await queryOne<{ id: number }>("SELECT id FROM brands WHERE id = $1", [id]);
    if (!existingBrand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    const payload = normalizeBrandPayload(brandSchema.parse(req.body));
    const slugConflict = await queryOne<{ id: number }>(
      "SELECT id FROM brands WHERE slug = $1 AND id <> $2",
      [payload.slug, id],
    );
    if (slugConflict) {
      return res.status(409).json({ message: "Brand slug already exists" });
    }

    await query(
      `UPDATE brands
       SET name = $1, slug = $2, logo_url = $3, description = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [payload.name, payload.slug, payload.logoUrl, payload.description, id],
    );

    const brand = await queryOne("SELECT * FROM brands WHERE id = $1", [id]);
    res.json(brand);
  } catch (error) {
    next(error);
  }
});

router.delete("/brands/:id", async (req, res, next) => {
  try {
    await query("DELETE FROM brands WHERE id = $1", [Number(req.params.id)]);
    res.json({ message: "Brand deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/categories", async (_req, res, next) => {
  try {
    res.json(await query("SELECT * FROM categories ORDER BY name ASC"));
  } catch (error) {
    next(error);
  }
});

router.post("/categories", async (req, res, next) => {
  try {
    const body = categorySchema.parse(req.body);
    const created = await queryOne<{ id: number }>(
      "INSERT INTO categories (name, slug, description) VALUES ($1, $2, $3) RETURNING id",
      [body.name, body.slug ? slugify(body.slug) : slugify(body.name), body.description ?? null],
    );
    if (!created) {
      throw new Error("Could not create category");
    }
    res.status(201).json({ id: created.id });
  } catch (error) {
    next(error);
  }
});

router.put("/categories/:id", async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid category id" });
    }
    const body = categorySchema.parse(req.body);
    await query(
      `UPDATE categories
       SET name = $1, slug = $2, description = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [body.name, body.slug ? slugify(body.slug) : slugify(body.name), body.description ?? null, id],
    );
    res.json({ message: "Category updated" });
  } catch (error) {
    next(error);
  }
});

router.delete("/categories/:id", async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid category id" });
    }
    await query("DELETE FROM categories WHERE id = $1", [id]);
    res.json({ message: "Category deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/hero-slides", async (_req, res, next) => {
  try {
    const slides = await query(
      `SELECT id, position, label, image_url, title, subtitle, button_text, button_link,
              CASE WHEN is_active THEN 1 ELSE 0 END as is_active,
              created_at, updated_at
       FROM hero_slides
       ORDER BY position ASC`,
    );
    res.json(slides);
  } catch (error) {
    next(error);
  }
});

router.post("/hero-slides", async (req, res, next) => {
  try {
    const payload = normalizeHeroSlidePayload(heroSlideSchema.parse(req.body));
    const maxPosition = await queryOne<{ maxPosition: number }>(
      'SELECT COALESCE(MAX(position), 0) as "maxPosition" FROM hero_slides',
    );
    const nextPosition = (maxPosition?.maxPosition ?? 0) + 1;

    const created = await queryOne<{ id: number }>(
      `INSERT INTO hero_slides
       (position, label, image_url, title, subtitle, button_text, button_link, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        nextPosition,
        payload.label,
        payload.imageUrl,
        payload.title,
        payload.subtitle,
        payload.buttonText,
        payload.buttonLink,
        payload.isActive,
      ],
    );
    if (!created) {
      throw new Error("Could not create hero slide");
    }
    const slide = await queryOne(
      `SELECT id, position, label, image_url, title, subtitle, button_text, button_link,
              CASE WHEN is_active THEN 1 ELSE 0 END as is_active,
              created_at, updated_at
       FROM hero_slides
       WHERE id = $1`,
      [created.id],
    );
    res.status(201).json(slide);
  } catch (error) {
    next(error);
  }
});

router.put("/hero-slides/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid hero slide id" });
    }

    const slide = await queryOne<{
      id: number;
      label: string;
      image_url: string;
      title: string | null;
      subtitle: string | null;
      button_text: string | null;
      button_link: string | null;
      is_active: boolean;
    }>("SELECT * FROM hero_slides WHERE id = $1", [id]);
    if (!slide) {
      return res.status(404).json({ message: "Hero slide not found" });
    }

    const patch = heroSlideUpdateSchema.parse(req.body);
    const updatedLabel = patch.label?.trim() || slide.label;
    const updatedImage = patch.imageUrl?.trim() || slide.image_url;
    const updatedTitle =
      patch.title === undefined ? slide.title : patch.title.trim() ? patch.title.trim() : null;
    const updatedSubtitle =
      patch.subtitle === undefined ? slide.subtitle : patch.subtitle.trim() ? patch.subtitle.trim() : null;
    const updatedButtonText =
      patch.buttonText === undefined ? slide.button_text : patch.buttonText.trim() ? patch.buttonText.trim() : null;
    const updatedButtonLink =
      patch.buttonLink === undefined ? slide.button_link : patch.buttonLink.trim() ? patch.buttonLink.trim() : null;
    const updatedActive = patch.isActive === undefined ? slide.is_active : patch.isActive;

    await query(
      `UPDATE hero_slides
       SET label = $1, image_url = $2, title = $3, subtitle = $4, button_text = $5, button_link = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [
        updatedLabel,
        updatedImage,
        updatedTitle,
        updatedSubtitle,
        updatedButtonText,
        updatedButtonLink,
        updatedActive,
        id,
      ],
    );

    const updated = await queryOne(
      `SELECT id, position, label, image_url, title, subtitle, button_text, button_link,
              CASE WHEN is_active THEN 1 ELSE 0 END as is_active,
              created_at, updated_at
       FROM hero_slides
       WHERE id = $1`,
      [id],
    );
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/hero-slides/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid hero slide id" });
    }

    const deleted = await withTransaction(async (client) => {
      const existing = await queryOne<{ id: number }>("SELECT id FROM hero_slides WHERE id = $1", [id], client);
      if (!existing) return false;
      await query("DELETE FROM hero_slides WHERE id = $1", [id], client);
      await compactHeroSlidePositions(client);
      return true;
    });

    if (!deleted) {
      return res.status(404).json({ message: "Hero slide not found" });
    }

    res.json({ message: "Hero slide deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/orders", async (_req, res, next) => {
  try {
    const orders = await query<{ id: number }>(
      `SELECT o.*, u.email as "userEmail", u.name as "userName"
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`,
    );
    const data = await Promise.all(
      orders.map(async (order) => ({
        ...order,
        items: await query("SELECT * FROM order_items WHERE order_id = $1", [order.id]),
      })),
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.patch("/orders/:id/status", async (req, res, next) => {
  try {
    const statusSchema = z.object({ status: z.enum(ORDER_STATUS) });
    const { status } = statusSchema.parse(req.body);
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid order id" });
    }
    await query("UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [status, id]);
    const order = await queryOne("SELECT * FROM orders WHERE id = $1", [id]);
    res.json(order);
  } catch (error) {
    next(error);
  }
});

export default router;
