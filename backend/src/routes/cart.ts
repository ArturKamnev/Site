import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth";
import { db } from "../lib/db";

const router = Router();

const addItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive().max(99).default(1),
});

const updateItemSchema = z.object({
  quantity: z.number().int().positive().max(99),
});

const syncSchema = z.object({
  items: z.array(
    z.object({
      productId: z.number().int().positive(),
      quantity: z.number().int().positive().max(99),
    }),
  ),
});

const ensureCart = (userId: number) => {
  const cart = db.prepare("SELECT * FROM carts WHERE user_id = ?").get(userId) as
    | { id: number; user_id: number }
    | undefined;
  if (cart) return cart;
  const result = db.prepare("INSERT INTO carts (user_id) VALUES (?)").run(userId);
  return { id: Number(result.lastInsertRowid), user_id: userId };
};

router.use(authRequired);

router.get("/", (req, res, next) => {
  try {
    const cart = ensureCart(req.user!.id);
    const items = db
      .prepare(
        `SELECT ci.*,
                p.name, p.slug, p.price, p.image, p.sku, p.stock,
                b.name as brandName,
                c.name as categoryName
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
         JOIN brands b ON b.id = p.brand_id
         JOIN categories c ON c.id = p.category_id
         WHERE ci.cart_id = ?
         ORDER BY ci.created_at DESC`,
      )
      .all(cart.id);

    const total = (items as Array<{ price: number; quantity: number }>).reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    res.json({ id: cart.id, userId: req.user!.id, items, total });
  } catch (error) {
    next(error);
  }
});

router.post("/items", (req, res, next) => {
  try {
    const body = addItemSchema.parse(req.body);
    const cart = ensureCart(req.user!.id);

    const product = db.prepare("SELECT id FROM products WHERE id = ?").get(body.productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const existing = db
      .prepare("SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?")
      .get(cart.id, body.productId) as { id: number; quantity: number } | undefined;

    if (existing) {
      db.prepare("UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
        Math.min(existing.quantity + body.quantity, 99),
        existing.id,
      );
    } else {
      db.prepare("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)").run(
        cart.id,
        body.productId,
        body.quantity,
      );
    }

    res.status(201).json({ message: "Added to cart" });
  } catch (error) {
    next(error);
  }
});

router.patch("/items/:itemId", (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    const body = updateItemSchema.parse(req.body);

    const item = db
      .prepare(
        `SELECT ci.id, c.user_id as userId
         FROM cart_items ci
         JOIN carts c ON c.id = ci.cart_id
         WHERE ci.id = ?`,
      )
      .get(itemId) as { id: number; userId: number } | undefined;

    if (!item || item.userId !== req.user!.id) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    db.prepare("UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      body.quantity,
      itemId,
    );
    res.json({ message: "Cart item updated" });
  } catch (error) {
    next(error);
  }
});

router.delete("/items/:itemId", (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    const item = db
      .prepare(
        `SELECT ci.id, c.user_id as userId
         FROM cart_items ci
         JOIN carts c ON c.id = ci.cart_id
         WHERE ci.id = ?`,
      )
      .get(itemId) as { id: number; userId: number } | undefined;

    if (!item || item.userId !== req.user!.id) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    db.prepare("DELETE FROM cart_items WHERE id = ?").run(itemId);
    res.json({ message: "Item removed from cart" });
  } catch (error) {
    next(error);
  }
});

router.post("/sync", (req, res, next) => {
  try {
    const body = syncSchema.parse(req.body);
    const cart = ensureCart(req.user!.id);

    const tx = db.transaction((items: Array<{ productId: number; quantity: number }>) => {
      for (const item of items) {
        const product = db.prepare("SELECT id FROM products WHERE id = ?").get(item.productId);
        if (!product) continue;

        const existing = db
          .prepare("SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?")
          .get(cart.id, item.productId) as { id: number; quantity: number } | undefined;

        if (existing) {
          db.prepare("UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
            Math.min(existing.quantity + item.quantity, 99),
            existing.id,
          );
        } else {
          db.prepare("INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)").run(
            cart.id,
            item.productId,
            item.quantity,
          );
        }
      }
    });

    tx(body.items);
    res.json({ message: "Cart synced" });
  } catch (error) {
    next(error);
  }
});

export default router;
