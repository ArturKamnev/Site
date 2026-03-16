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
  isActive: payload.isActive ? 1 : 0,
});

const compactHeroSlidePositions = () => {
  const slides = db.prepare("SELECT id FROM hero_slides ORDER BY position ASC").all() as Array<{ id: number }>;
  const shiftPosition = db.prepare("UPDATE hero_slides SET position = ? WHERE id = ?");

  for (const [index, slide] of slides.entries()) {
    shiftPosition.run(1000 + index, slide.id);
  }
  for (const [index, slide] of slides.entries()) {
    shiftPosition.run(index + 1, slide.id);
  }
};

router.get("/dashboard", (_req, res, next) => {
  try {
    const users = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
    const products = (db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number }).c;
    const brands = (db.prepare("SELECT COUNT(*) as c FROM brands").get() as { c: number }).c;
    const categories = (db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number }).c;
    const orders = (db.prepare("SELECT COUNT(*) as c FROM orders").get() as { c: number }).c;
    const heroSlides = (db.prepare("SELECT COUNT(*) as c FROM hero_slides").get() as { c: number }).c;
    res.json({ users, products, brands, categories, orders, heroSlides });
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
    const pricing = normalizePricing(body.price, body.discountPercent);
    const result = db
      .prepare(
        `INSERT INTO products
         (name, slug, sku, article, part_id, price, old_price, discount_percent, image, description, manufacturer, stock, is_available, brand_id, category_id, specs_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
    const pricing = normalizePricing(body.price, body.discountPercent);
    db.prepare(
      `UPDATE products
       SET name = ?, slug = ?, sku = ?, article = ?, part_id = ?, price = ?, old_price = ?, discount_percent = ?, image = ?, description = ?, manufacturer = ?,
           stock = ?, is_available = ?, brand_id = ?, category_id = ?, specs_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(
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

router.patch("/products/:id/discount", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const body = discountSchema.parse(req.body);
    const product = db.prepare("SELECT id, price FROM products WHERE id = ?").get(id) as
      | { id: number; price: number }
      | undefined;
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const pricing = normalizePricing(product.price, body.discountPercent);
    db.prepare(
      "UPDATE products SET old_price = ?, discount_percent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).run(pricing.oldPrice, pricing.discountPercent, id);

    const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    res.json(updated);
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

router.get("/hero-slides", (_req, res, next) => {
  try {
    const slides = db.prepare("SELECT * FROM hero_slides ORDER BY position ASC").all();
    res.json(slides);
  } catch (error) {
    next(error);
  }
});

router.post("/hero-slides", (req, res, next) => {
  try {
    const payload = normalizeHeroSlidePayload(heroSlideSchema.parse(req.body));
    const maxPosition = db.prepare("SELECT COALESCE(MAX(position), 0) as maxPosition FROM hero_slides").get() as {
      maxPosition: number;
    };
    const nextPosition = maxPosition.maxPosition + 1;

    const result = db
      .prepare(
        `INSERT INTO hero_slides
         (position, label, image_url, title, subtitle, button_text, button_link, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        nextPosition,
        payload.label,
        payload.imageUrl,
        payload.title,
        payload.subtitle,
        payload.buttonText,
        payload.buttonLink,
        payload.isActive,
      );

    const slide = db.prepare("SELECT * FROM hero_slides WHERE id = ?").get(Number(result.lastInsertRowid));
    res.status(201).json(slide);
  } catch (error) {
    next(error);
  }
});

router.put("/hero-slides/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid hero slide id" });
    }

    const slide = db.prepare("SELECT * FROM hero_slides WHERE id = ?").get(id) as
      | {
          id: number;
          label: string;
          image_url: string;
          title: string | null;
          subtitle: string | null;
          button_text: string | null;
          button_link: string | null;
          is_active: number;
        }
      | undefined;
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
      patch.buttonText === undefined
        ? slide.button_text
        : patch.buttonText.trim()
          ? patch.buttonText.trim()
          : null;
    const updatedButtonLink =
      patch.buttonLink === undefined
        ? slide.button_link
        : patch.buttonLink.trim()
          ? patch.buttonLink.trim()
          : null;
    const updatedActive = patch.isActive === undefined ? slide.is_active : patch.isActive ? 1 : 0;

    db.prepare(
      `UPDATE hero_slides
       SET label = ?, image_url = ?, title = ?, subtitle = ?, button_text = ?, button_link = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(
      updatedLabel,
      updatedImage,
      updatedTitle,
      updatedSubtitle,
      updatedButtonText,
      updatedButtonLink,
      updatedActive,
      id,
    );

    const updated = db.prepare("SELECT * FROM hero_slides WHERE id = ?").get(id);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete("/hero-slides/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid hero slide id" });
    }

    const tx = db.transaction((slideId: number) => {
      const existing = db.prepare("SELECT id FROM hero_slides WHERE id = ?").get(slideId) as
        | { id: number }
        | undefined;
      if (!existing) return false;
      db.prepare("DELETE FROM hero_slides WHERE id = ?").run(slideId);
      compactHeroSlidePositions();
      return true;
    });

    const deleted = tx(id);
    if (!deleted) {
      return res.status(404).json({ message: "Hero slide not found" });
    }

    res.json({ message: "Hero slide deleted" });
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
