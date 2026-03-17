import { Router } from "express";
import { z } from "zod";
import { optionalAuth, authRequired } from "../middleware/auth";
import { db } from "../lib/db";

const router = Router();

const checkoutSchema = z.object({
  fullName: z.string().min(3).max(120),
  phone: z.string().min(6).max(30),
  email: z.string().email(),
  comment: z.string().max(500).optional(),
  address: z.string().max(500).optional(),
  pickupMethod: z.string().max(120).optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .optional(),
});

router.post("/", optionalAuth, (req, res, next) => {
  try {
    const body = checkoutSchema.parse(req.body);

    let sourceItems: Array<{ productId: number; quantity: number }> = [];
    if (req.user) {
      const cart = db.prepare("SELECT id FROM carts WHERE user_id = ?").get(req.user.id) as
        | { id: number }
        | undefined;
      if (cart) {
        sourceItems = db
          .prepare("SELECT product_id as productId, quantity FROM cart_items WHERE cart_id = ?")
          .all(cart.id) as Array<{ productId: number; quantity: number }>;
      }
    } else {
      sourceItems = body.items ?? [];
    }

    if (!sourceItems.length) {
      return res.status(400).json({ message: "No items to checkout" });
    }

    const normalizedItemsMap = new Map<number, number>();
    for (const item of sourceItems) {
      normalizedItemsMap.set(item.productId, (normalizedItemsMap.get(item.productId) ?? 0) + item.quantity);
    }
    const normalizedItems = Array.from(normalizedItemsMap.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    const tx = db.transaction(() => {
      const orderItemRows: Array<{
        productId: number;
        snapshotName: string;
        snapshotSku: string;
        price: number;
        quantity: number;
        lineTotal: number;
      }> = [];

      for (const item of normalizedItems) {
        const product = db
          .prepare("SELECT id, name, sku, price, stock, is_available as isAvailable FROM products WHERE id = ?")
          .get(item.productId) as
          | { id: number; name: string; sku: string; price: number; stock: number; isAvailable: number }
          | undefined;
        if (!product) continue;

        const availableStock = product.isAvailable ? Math.max(product.stock, 0) : 0;
        if (item.quantity > availableStock) {
          const error = new Error("Requested quantity exceeds available stock") as Error & {
            status: number;
            code: string;
            productId: number;
            requestedQuantity: number;
            availableStock: number;
          };
          error.status = 409;
          error.code = "STOCK_EXCEEDED";
          error.productId = item.productId;
          error.requestedQuantity = item.quantity;
          error.availableStock = availableStock;
          throw error;
        }

        orderItemRows.push({
          productId: product.id,
          snapshotName: product.name,
          snapshotSku: product.sku,
          price: product.price,
          quantity: item.quantity,
          lineTotal: product.price * item.quantity,
        });
      }

      if (!orderItemRows.length) {
        throw new Error("No valid products for checkout");
      }

      const total = orderItemRows.reduce((sum, entry) => sum + entry.lineTotal, 0);

      const orderResult = db
        .prepare(
          `INSERT INTO orders (user_id, status, full_name, phone, email, comment, address, pickup_method, total)
           VALUES (?, 'PENDING', ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          req.user?.id ?? null,
          body.fullName,
          body.phone,
          body.email,
          body.comment ?? null,
          body.address ?? null,
          body.pickupMethod ?? null,
          total,
        );

      const orderId = Number(orderResult.lastInsertRowid);
      const insertOrderItem = db.prepare(
        `INSERT INTO order_items (order_id, product_id, snapshot_name, snapshot_sku, price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );

      for (const row of orderItemRows) {
        insertOrderItem.run(
          orderId,
          row.productId,
          row.snapshotName,
          row.snapshotSku,
          row.price,
          row.quantity,
          row.lineTotal,
        );
      }

      const decreaseStock = db.prepare(
        "UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      );
      for (const row of orderItemRows) {
        decreaseStock.run(row.quantity, row.productId);
      }

      if (req.user) {
        const cart = db.prepare("SELECT id FROM carts WHERE user_id = ?").get(req.user.id) as
          | { id: number }
          | undefined;
        if (cart) {
          db.prepare("DELETE FROM cart_items WHERE cart_id = ?").run(cart.id);
        }
      }

      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as Record<string, unknown>;
      const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderId);
      return { ...order, items };
    });

    const order = tx();
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

router.get("/my", authRequired, (req, res, next) => {
  try {
    const orders = db
      .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC")
      .all(req.user!.id) as Array<{ id: number }>;

    const itemsStmt = db.prepare("SELECT * FROM order_items WHERE order_id = ?");
    const data = orders.map((order) => ({
      ...order,
      items: itemsStmt.all(order.id),
    }));

    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
