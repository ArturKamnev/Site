import type { PoolClient } from "pg";
import { parse } from "csv-parse/sync";
import { query, queryOne, withTransaction } from "./db";
import { slugify } from "../utils/slugify";

export type ImportMode = "upsert" | "full_sync";

type CsvRecord = Record<string, string | undefined>;

type ImportError = {
  row: number;
  message: string;
};

type ImportSummary = {
  mode: ImportMode;
  totalRows: number;
  createdProducts: number;
  updatedProducts: number;
  createdBrands: number;
  createdCategories: number;
  deactivatedProducts: number;
  errors: ImportError[];
};

type ImportRow = {
  externalId: string | null;
  name: string | null;
  sku: string | null;
  article: string | null;
  partId: string | null;
  brand: string | null;
  brandExternalId: string | null;
  category: string | null;
  categoryExternalId: string | null;
  price: number | null;
  stock: number | null;
  image: string | null;
  description: string | null;
  manufacturer: string | null;
};

type RefResult = {
  id: number;
  created: boolean;
};

type ProductLookup = {
  id: number;
  sku: string;
};

type ProductResult = {
  id: number;
  created: boolean;
  createdBrand: boolean;
  createdCategory: boolean;
};

const FIELD_ALIASES = {
  externalId: ["external_id", "externalId", "1c_id", "id_1c", "код", "код_1с", "guid"],
  name: ["name", "название", "наименование", "товар"],
  sku: ["sku", "артикул_сайта", "код_товара"],
  article: ["article", "артикул"],
  partId: ["part_id", "partId", "номер_детали", "oem"],
  brand: ["brand", "бренд", "производитель_бренд"],
  brandExternalId: [
    "brand_external_id",
    "brandExternalId",
    "brand_1c_id",
    "brand_guid",
    "код_бренда",
    "бренд_id",
    "guid_бренда",
  ],
  category: ["category", "категория", "группа"],
  categoryExternalId: [
    "category_external_id",
    "categoryExternalId",
    "category_1c_id",
    "category_guid",
    "код_категории",
    "категория_id",
    "guid_категории",
  ],
  price: ["price", "цена", "розничная_цена"],
  stock: ["stock", "остаток", "количество", "наличие"],
  image: ["image", "image_url", "картинка", "изображение"],
  description: ["description", "описание"],
  manufacturer: ["manufacturer", "производитель"],
} satisfies Record<keyof ImportRow, string[]>;

const ALIAS_TO_FIELD = new Map<string, keyof ImportRow>(
  Object.entries(FIELD_ALIASES).flatMap(([field, aliases]) =>
    aliases.map((alias) => [normalizeColumnName(alias), field as keyof ImportRow]),
  ),
);

const trimCell = (value: unknown) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

function decodeCsvBuffer(buffer: Buffer) {
  const utf8 = buffer.toString("utf8");
  if (!utf8.includes("\uFFFD")) return utf8;

  try {
    return new TextDecoder("windows-1251").decode(buffer);
  } catch {
    return utf8;
  }
}

function normalizeColumnName(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseMoney(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseStock(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(",", ".");
  if (["yes", "y", "true", "in_stock", "available", "да", "есть", "в наличии"].includes(normalized)) {
    return 1;
  }
  if (["no", "n", "false", "out_of_stock", "нет", "нет в наличии"].includes(normalized)) {
    return 0;
  }

  const parsed = Number(normalized.replace(/\s/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function mapCsvRow(record: CsvRecord): ImportRow {
  const row: ImportRow = {
    externalId: null,
    name: null,
    sku: null,
    article: null,
    partId: null,
    brand: null,
    brandExternalId: null,
    category: null,
    categoryExternalId: null,
    price: null,
    stock: null,
    image: null,
    description: null,
    manufacturer: null,
  };

  for (const [column, value] of Object.entries(record)) {
    const field = ALIAS_TO_FIELD.get(normalizeColumnName(column));
    if (!field) continue;

    const cell = trimCell(value);
    if (cell === null && row[field] !== null) continue;

    if (field === "price") {
      row.price = parseMoney(cell);
    } else if (field === "stock") {
      row.stock = parseStock(cell);
    } else {
      row[field] = cell as never;
    }
  }

  return row;
}

function validateImportRow(row: ImportRow) {
  const missing: string[] = [];
  if (!row.name) missing.push("name");
  if (!row.externalId && !row.sku && !row.article) missing.push("externalId, sku, or article");
  if (row.price === null) missing.push("price");
  if (row.stock === null) missing.push("stock");
  if (!row.brand) missing.push("brand");
  if (!row.category) missing.push("category");
  return missing;
}

async function ensureUniqueSlug(
  table: "brands" | "categories" | "products",
  value: string,
  client: PoolClient,
  suffixes: Array<string | null> = [],
) {
  const base = slugify(value) || "item";
  const candidates = [
    base,
    ...suffixes
      .map((suffix) => (suffix ? `${base}-${slugify(suffix)}` : null))
      .filter((candidate): candidate is string => Boolean(candidate)),
  ];

  for (const candidate of candidates) {
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM ${table} WHERE slug = $1`,
      [candidate],
      client,
    );
    if (!existing) return candidate;
  }

  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`;
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM ${table} WHERE slug = $1`,
      [candidate],
      client,
    );
    if (!existing) return candidate;
  }
}

async function ensureUniqueGeneratedSku(baseSku: string, client: PoolClient) {
  const base = baseSku.trim() || "product";
  const existing = await queryOne<{ id: number }>("SELECT id FROM products WHERE sku = $1", [base], client);
  if (!existing) return base;

  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`;
    const conflict = await queryOne<{ id: number }>("SELECT id FROM products WHERE sku = $1", [candidate], client);
    if (!conflict) return candidate;
  }
}

async function findOrCreateRef(
  table: "brands" | "categories",
  name: string,
  externalId: string | null,
  client: PoolClient,
): Promise<RefResult> {
  if (externalId) {
    const byExternalId = await queryOne<{ id: number }>(
      `SELECT id FROM ${table} WHERE external_id = $1`,
      [externalId],
      client,
    );
    if (byExternalId) return { id: byExternalId.id, created: false };
  }

  const slug = slugify(name);
  const existing = await queryOne<{ id: number; external_id: string | null }>(
    `SELECT id, external_id FROM ${table} WHERE slug = $1 OR lower(name) = lower($2) ORDER BY id ASC LIMIT 1`,
    [slug, name],
    client,
  );

  if (existing) {
    if (externalId && !existing.external_id) {
      await query(`UPDATE ${table} SET external_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
        externalId,
        existing.id,
      ], client);
    }
    return { id: existing.id, created: false };
  }

  const uniqueSlug = await ensureUniqueSlug(table, name, client, [externalId]);
  const created = await queryOne<{ id: number }>(
    `INSERT INTO ${table} (name, slug, external_id) VALUES ($1, $2, $3) RETURNING id`,
    [name, uniqueSlug, externalId],
    client,
  );
  if (!created) {
    throw new Error(`Could not create ${table.slice(0, -1)}`);
  }

  return { id: created.id, created: true };
}

async function findProduct(row: ImportRow, client: PoolClient) {
  if (row.externalId) {
    const product = await queryOne<ProductLookup>(
      "SELECT id, sku FROM products WHERE external_id = $1",
      [row.externalId],
      client,
    );
    if (product) return product;
  }

  if (row.sku) {
    const product = await queryOne<ProductLookup>("SELECT id, sku FROM products WHERE sku = $1", [row.sku], client);
    if (product) return product;
  }

  if (row.article) {
    const product = await queryOne<ProductLookup>(
      "SELECT id, sku FROM products WHERE article = $1 ORDER BY id ASC LIMIT 1",
      [row.article],
      client,
    );
    if (product) return product;
  }

  return null;
}

async function upsertProductRow(row: ImportRow, client: PoolClient): Promise<ProductResult> {
  if (!row.name || row.price === null || row.stock === null || !row.brand || !row.category) {
    throw new Error("Cannot import an invalid row");
  }

  const brand = await findOrCreateRef("brands", row.brand, row.brandExternalId, client);
  const category = await findOrCreateRef("categories", row.category, row.categoryExternalId, client);
  const product = await findProduct(row, client);
  const isAvailable = row.stock > 0;

  if (product) {
    const finalSku = row.sku ?? product.sku ?? row.externalId ?? row.article;
    if (!finalSku) {
      throw new Error("Missing required field: sku");
    }

    const skuConflict = await queryOne<{ id: number }>(
      "SELECT id FROM products WHERE sku = $1 AND id <> $2",
      [finalSku, product.id],
      client,
    );
    if (skuConflict) {
      throw new Error(`SKU already belongs to another product: ${finalSku}`);
    }

    await query(
      `UPDATE products
       SET external_id = COALESCE($1, external_id),
           name = $2,
           sku = $3,
           article = $4,
           part_id = $5,
           price = $6,
           image = $7,
           description = $8,
           manufacturer = $9,
           stock = $10,
           is_available = $11,
           brand_id = $12,
           category_id = $13,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $14`,
      [
        row.externalId,
        row.name,
        finalSku,
        row.article,
        row.partId,
        row.price,
        row.image,
        row.description,
        row.manufacturer,
        row.stock,
        isAvailable,
        brand.id,
        category.id,
        product.id,
      ],
      client,
    );

    return {
      id: product.id,
      created: false,
      createdBrand: brand.created,
      createdCategory: category.created,
    };
  }

  const rawSku = row.sku ?? row.externalId ?? row.article;
  if (!rawSku) {
    throw new Error("Missing required field: sku");
  }

  const finalSku = row.sku ? rawSku : await ensureUniqueGeneratedSku(rawSku, client);
  const slug = await ensureUniqueSlug("products", row.name, client, [row.sku, row.externalId, row.article]);
  const created = await queryOne<{ id: number }>(
    `INSERT INTO products
     (external_id, name, slug, sku, article, part_id, price, image, description, manufacturer, stock, is_available, brand_id, category_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id`,
    [
      row.externalId,
      row.name,
      slug,
      finalSku,
      row.article,
      row.partId,
      row.price,
      row.image,
      row.description,
      row.manufacturer,
      row.stock,
      isAvailable,
      brand.id,
      category.id,
    ],
    client,
  );

  if (!created) {
    throw new Error("Could not create product");
  }

  return {
    id: created.id,
    created: true,
    createdBrand: brand.created,
    createdCategory: category.created,
  };
}

async function deactivateMissingProducts(
  processedIds: number[],
  identifiers: { externalIds: string[]; skus: string[]; articles: string[] },
) {
  if (!processedIds.length && !identifiers.externalIds.length && !identifiers.skus.length && !identifiers.articles.length) {
    return 0;
  }

  const result = await queryOne<{ count: string }>(
    `WITH updated AS (
       UPDATE products
       SET stock = 0, is_available = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE NOT (
         id = ANY($1::int[])
         OR (external_id IS NOT NULL AND external_id = ANY($2::text[]))
         OR sku = ANY($3::text[])
         OR (article IS NOT NULL AND article = ANY($4::text[]))
       )
       AND (stock <> 0 OR is_available = TRUE)
       RETURNING id
     )
     SELECT COUNT(*) as count FROM updated`,
    [processedIds, identifiers.externalIds, identifiers.skus, identifiers.articles],
  );

  return Number(result?.count ?? 0);
}

export async function importProductsFromCsv(buffer: Buffer, mode: ImportMode): Promise<ImportSummary> {
  const text = decodeCsvBuffer(buffer);
  const records = parse(text, {
    bom: true,
    columns: true,
    delimiter: [",", ";", "\t"],
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[];

  const summary: ImportSummary = {
    mode,
    totalRows: records.length,
    createdProducts: 0,
    updatedProducts: 0,
    createdBrands: 0,
    createdCategories: 0,
    deactivatedProducts: 0,
    errors: [],
  };

  const processedIds: number[] = [];
  const presentExternalIds = new Set<string>();
  const presentSkus = new Set<string>();
  const presentArticles = new Set<string>();

  for (const [index, record] of records.entries()) {
    const rowNumber = index + 2;
    const row = mapCsvRow(record);

    if (row.externalId) presentExternalIds.add(row.externalId);
    if (row.sku) presentSkus.add(row.sku);
    if (row.article) presentArticles.add(row.article);

    const missing = validateImportRow(row);
    if (missing.length) {
      summary.errors.push({
        row: rowNumber,
        message: `Missing required field: ${missing.join(", ")}`,
      });
      continue;
    }

    try {
      const result = await withTransaction((client) => upsertProductRow(row, client));
      processedIds.push(result.id);
      if (result.created) {
        summary.createdProducts += 1;
      } else {
        summary.updatedProducts += 1;
      }
      if (result.createdBrand) summary.createdBrands += 1;
      if (result.createdCategory) summary.createdCategories += 1;
    } catch (error) {
      summary.errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : "Could not import row",
      });
    }
  }

  if (mode === "full_sync") {
    summary.deactivatedProducts = await deactivateMissingProducts(processedIds, {
      externalIds: [...presentExternalIds],
      skus: [...presentSkus],
      articles: [...presentArticles],
    });
  }

  return summary;
}
