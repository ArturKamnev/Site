import type { PoolClient } from "pg";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { authRequired, rolesRequired } from "../middleware/auth";
import { query, queryOne, withTransaction } from "../lib/db";
import { importProductsFromCsv, type ImportMode } from "../lib/csvProductImport";
import { slugify } from "../utils/slugify";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const ORDER_STATUS = ["PENDING", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELED"] as const;
const ORDER_STATUS_FILTERS = ["all", ...ORDER_STATUS] as const;
const PRODUCT_AVAILABILITY_FILTERS = ["all", "in_stock", "out_of_stock", "hidden"] as const;
const PRODUCT_DISCOUNT_FILTERS = ["all", "with_discount", "without_discount"] as const;
const PRODUCT_SORTS = [
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
  "price_asc",
  "price_desc",
  "stock_asc",
  "stock_desc",
] as const;
const DIRECTORY_SORTS = ["name_asc", "name_desc", "newest", "oldest"] as const;
const ORDER_SORTS = ["newest", "oldest", "total_asc", "total_desc"] as const;

type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];
type ProductAvailabilityFilter = (typeof PRODUCT_AVAILABILITY_FILTERS)[number];
type ProductDiscountFilter = (typeof PRODUCT_DISCOUNT_FILTERS)[number];
type ProductSort = (typeof PRODUCT_SORTS)[number];
type DirectorySort = (typeof DIRECTORY_SORTS)[number];
type OrderSort = (typeof ORDER_SORTS)[number];

type AdminOrderRow = {
  id: number;
  [key: string]: unknown;
};

type AdminOrderItemRow = {
  order_id: number;
  [key: string]: unknown;
};

const parsePositiveId = (raw: string) => {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const getQueryValue = (raw: unknown) => (typeof raw === "string" ? raw.trim() : undefined);

const parsePositiveIntegerQuery = (raw: unknown, fallback: number, max?: number) => {
  const value = Number(getQueryValue(raw) ?? fallback);
  const parsed = Number.isInteger(value) && value > 0 ? value : fallback;
  return max ? Math.min(parsed, max) : parsed;
};

const isProductAvailabilityFilter = (value: string): value is ProductAvailabilityFilter =>
  PRODUCT_AVAILABILITY_FILTERS.includes(value as ProductAvailabilityFilter);

const isProductDiscountFilter = (value: string): value is ProductDiscountFilter =>
  PRODUCT_DISCOUNT_FILTERS.includes(value as ProductDiscountFilter);

const isProductSort = (value: string): value is ProductSort => PRODUCT_SORTS.includes(value as ProductSort);

const isDirectorySort = (value: string): value is DirectorySort => DIRECTORY_SORTS.includes(value as DirectorySort);

const isOrderStatusFilter = (value: string): value is OrderStatusFilter =>
  ORDER_STATUS_FILTERS.includes(value as OrderStatusFilter);

const isOrderSort = (value: string): value is OrderSort => ORDER_SORTS.includes(value as OrderSort);

const PRODUCT_SORT_SQL: Record<ProductSort, string> = {
  newest: "p.created_at DESC, p.id DESC",
  oldest: "p.created_at ASC, p.id ASC",
  name_asc: "LOWER(p.name) ASC, p.id ASC",
  name_desc: "LOWER(p.name) DESC, p.id DESC",
  price_asc: "p.price ASC, p.id ASC",
  price_desc: "p.price DESC, p.id DESC",
  stock_asc: "p.stock ASC, p.id ASC",
  stock_desc: "p.stock DESC, p.id DESC",
};

const BRAND_SORT_SQL: Record<DirectorySort, string> = {
  name_asc: "LOWER(b.name) ASC, b.id ASC",
  name_desc: "LOWER(b.name) DESC, b.id DESC",
  newest: "b.created_at DESC, b.id DESC",
  oldest: "b.created_at ASC, b.id ASC",
};

const CATEGORY_SORT_SQL: Record<DirectorySort, string> = {
  name_asc: "LOWER(c.name) ASC, c.id ASC",
  name_desc: "LOWER(c.name) DESC, c.id DESC",
  newest: "c.created_at DESC, c.id DESC",
  oldest: "c.created_at ASC, c.id ASC",
};

const ORDER_SORT_SQL: Record<OrderSort, string> = {
  newest: "o.created_at DESC, o.id DESC",
  oldest: "o.created_at ASC, o.id ASC",
  total_asc: "o.total ASC, o.id ASC",
  total_desc: "o.total DESC, o.id DESC",
};

router.use(authRequired, rolesRequired("admin", "employee"));

router.post("/import/csv", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    const rawMode = typeof req.body.mode === "string" ? req.body.mode : "upsert";
    if (rawMode !== "upsert" && rawMode !== "full_sync") {
      return res.status(400).json({ message: "Unsupported import mode" });
    }

    const summary = await importProductsFromCsv(req.file.buffer, rawMode as ImportMode);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

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

router.get("/products", async (req, res, next) => {
  try {
    const page = parsePositiveIntegerQuery(req.query.page, 1);
    const pageSize = parsePositiveIntegerQuery(req.query.pageSize, 25, 100);
    const offset = (page - 1) * pageSize;
    const search = getQueryValue(req.query.search);
    const brandId = parsePositiveIntegerQuery(req.query.brandId, 0);
    const categoryId = parsePositiveIntegerQuery(req.query.categoryId, 0);
    const availabilityParam = getQueryValue(req.query.availability) ?? "all";
    const discountParam = getQueryValue(req.query.discount) ?? "all";
    const sortParam = getQueryValue(req.query.sort) ?? "newest";
    const availability = isProductAvailabilityFilter(availabilityParam) ? availabilityParam : "all";
    const discount = isProductDiscountFilter(discountParam) ? discountParam : "all";
    const sort = isProductSort(sortParam) ? sortParam : "newest";
    const params: unknown[] = [];
    const whereParts: string[] = [];
    const addParam = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (search) {
      const searchParam = addParam(`%${search}%`);
      whereParts.push(`(
        p.name ILIKE ${searchParam}
        OR p.sku ILIKE ${searchParam}
        OR p.article ILIKE ${searchParam}
        OR p.part_id ILIKE ${searchParam}
        OR p.manufacturer ILIKE ${searchParam}
        OR b.name ILIKE ${searchParam}
        OR c.name ILIKE ${searchParam}
        OR p.external_id ILIKE ${searchParam}
      )`);
    }

    if (brandId > 0) {
      whereParts.push(`p.brand_id = ${addParam(brandId)}`);
    }

    if (categoryId > 0) {
      whereParts.push(`p.category_id = ${addParam(categoryId)}`);
    }

    if (availability === "in_stock") {
      whereParts.push("p.is_available = TRUE AND p.stock > 0");
    } else if (availability === "out_of_stock") {
      whereParts.push("p.is_available = TRUE AND p.stock <= 0");
    } else if (availability === "hidden") {
      whereParts.push("p.is_available = FALSE");
    }

    if (discount === "with_discount") {
      whereParts.push("COALESCE(p.discount_percent, 0) > 0");
    } else if (discount === "without_discount") {
      whereParts.push("COALESCE(p.discount_percent, 0) <= 0");
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const total = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       ${whereSql}`,
      params,
    );
    const limitParam = addParam(pageSize);
    const offsetParam = addParam(offset);
    const items = await query(
      `SELECT p.*,
              CASE WHEN p.is_available THEN 1 ELSE 0 END as is_available,
              b.name as "brandName",
              c.name as "categoryName"
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
       ${whereSql}
       ORDER BY ${PRODUCT_SORT_SQL[sort]}
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params,
    );

    const totalCount = Number(total?.count ?? 0);
    res.json({
      items,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
      },
    });
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
    const updated = await queryOne(
      `WITH updated AS (
         UPDATE products
       SET name = $1, slug = $2, sku = $3, article = $4, part_id = $5, price = $6, old_price = $7, discount_percent = $8,
           image = $9, description = $10, manufacturer = $11, stock = $12, is_available = $13, brand_id = $14, category_id = $15,
           specs_json = $16, updated_at = CURRENT_TIMESTAMP
         WHERE id = $17
         RETURNING *
       )
       SELECT p.*,
              CASE WHEN p.is_available THEN 1 ELSE 0 END as is_available,
              b.name as "brandName",
              c.name as "categoryName"
       FROM updated p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id`,
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
    if (!updated) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(updated);
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

router.get("/brands", async (req, res, next) => {
  try {
    const page = parsePositiveIntegerQuery(req.query.page, 1);
    const pageSize = parsePositiveIntegerQuery(req.query.pageSize, 25, 100);
    const offset = (page - 1) * pageSize;
    const search = getQueryValue(req.query.search);
    const sortParam = getQueryValue(req.query.sort) ?? "name_asc";
    const sort = isDirectorySort(sortParam) ? sortParam : "name_asc";
    const params: unknown[] = [];
    const whereParts: string[] = [];
    const addParam = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (search) {
      const searchParam = addParam(`%${search}%`);
      whereParts.push(`(b.name ILIKE ${searchParam} OR b.slug ILIKE ${searchParam} OR b.description ILIKE ${searchParam})`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const total = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM brands b
       ${whereSql}`,
      params,
    );
    const limitParam = addParam(pageSize);
    const offsetParam = addParam(offset);
    const items = await query(
      `SELECT b.*, COUNT(p.id)::int as "productsCount"
       FROM brands b
       LEFT JOIN products p ON p.brand_id = b.id
       ${whereSql}
       GROUP BY b.id
       ORDER BY ${BRAND_SORT_SQL[sort]}
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params,
    );

    const totalCount = Number(total?.count ?? 0);
    res.json({
      items,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/brands/options", async (_req, res, next) => {
  try {
    res.json(await query("SELECT id, name, slug FROM brands ORDER BY LOWER(name) ASC, id ASC"));
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
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid brand id" });
    }

    const linkedProducts = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM products WHERE brand_id = $1",
      [id],
    );
    const productsCount = Number(linkedProducts?.count ?? 0);
    if (productsCount > 0) {
      return res.status(409).json({
        message: "Cannot delete brand because it has linked products",
        productsCount,
      });
    }

    const deleted = await queryOne<{ id: number }>("DELETE FROM brands WHERE id = $1 RETURNING id", [id]);
    if (!deleted) {
      return res.status(404).json({ message: "Brand not found" });
    }
    res.json({ message: "Brand deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/categories", async (req, res, next) => {
  try {
    const page = parsePositiveIntegerQuery(req.query.page, 1);
    const pageSize = parsePositiveIntegerQuery(req.query.pageSize, 25, 100);
    const offset = (page - 1) * pageSize;
    const search = getQueryValue(req.query.search);
    const sortParam = getQueryValue(req.query.sort) ?? "name_asc";
    const sort = isDirectorySort(sortParam) ? sortParam : "name_asc";
    const params: unknown[] = [];
    const whereParts: string[] = [];
    const addParam = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (search) {
      const searchParam = addParam(`%${search}%`);
      whereParts.push(`(c.name ILIKE ${searchParam} OR c.slug ILIKE ${searchParam} OR c.description ILIKE ${searchParam})`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const total = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM categories c
       ${whereSql}`,
      params,
    );
    const limitParam = addParam(pageSize);
    const offsetParam = addParam(offset);
    const items = await query(
      `SELECT c.*, COUNT(p.id)::int as "productsCount"
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       ${whereSql}
       GROUP BY c.id
       ORDER BY ${CATEGORY_SORT_SQL[sort]}
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params,
    );

    const totalCount = Number(total?.count ?? 0);
    res.json({
      items,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/categories/options", async (_req, res, next) => {
  try {
    res.json(await query("SELECT id, name, slug FROM categories ORDER BY LOWER(name) ASC, id ASC"));
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

    const linkedProducts = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM products WHERE category_id = $1",
      [id],
    );
    const productsCount = Number(linkedProducts?.count ?? 0);
    if (productsCount > 0) {
      return res.status(409).json({
        message: "Cannot delete category because it has linked products",
        productsCount,
      });
    }

    const deleted = await queryOne<{ id: number }>("DELETE FROM categories WHERE id = $1 RETURNING id", [id]);
    if (!deleted) {
      return res.status(404).json({ message: "Category not found" });
    }
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

router.get("/orders", async (req, res, next) => {
  try {
    const page = parsePositiveIntegerQuery(req.query.page, 1);
    const pageSize = parsePositiveIntegerQuery(req.query.pageSize, 25, 100);
    const offset = (page - 1) * pageSize;
    const search = getQueryValue(req.query.search);
    const statusParam = getQueryValue(req.query.status) ?? "all";
    const sortParam = getQueryValue(req.query.sort) ?? "newest";
    const status = isOrderStatusFilter(statusParam) ? statusParam : "all";
    const sort = isOrderSort(sortParam) ? sortParam : "newest";
    const params: unknown[] = [];
    const whereParts: string[] = [];
    const addParam = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (search) {
      const searchParam = addParam(`%${search}%`);
      const searchParts = [
        `o.full_name ILIKE ${searchParam}`,
        `o.phone ILIKE ${searchParam}`,
        `o.email ILIKE ${searchParam}`,
        `u.email ILIKE ${searchParam}`,
        `u.name ILIKE ${searchParam}`,
      ];
      const orderId = parsePositiveId(search);
      if (orderId) {
        searchParts.push(`o.id = ${addParam(orderId)}`);
      }
      whereParts.push(`(${searchParts.join(" OR ")})`);
    }

    if (status !== "all") {
      whereParts.push(`o.status = ${addParam(status)}`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const total = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ${whereSql}`,
      params,
    );
    const limitParam = addParam(pageSize);
    const offsetParam = addParam(offset);
    const orders = await query<AdminOrderRow>(
      `SELECT o.*, u.email as "userEmail", u.name as "userName"
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ${whereSql}
       ORDER BY ${ORDER_SORT_SQL[sort]}
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params,
    );

    const orderIds = orders.map((order) => order.id);
    const orderItems = orderIds.length
      ? await query<AdminOrderItemRow>(
          "SELECT * FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id ASC",
          [orderIds],
        )
      : [];
    const itemsByOrderId = new Map<number, AdminOrderItemRow[]>();
    for (const item of orderItems) {
      const items = itemsByOrderId.get(item.order_id) ?? [];
      items.push(item);
      itemsByOrderId.set(item.order_id, items);
    }

    const items = orders.map((order) => ({
        ...order,
        items: itemsByOrderId.get(order.id) ?? [],
      }));
    const totalCount = Number(total?.count ?? 0);
    res.json({
      items,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
      },
    });
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
