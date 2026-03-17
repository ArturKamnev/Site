import { Router } from "express";
import { z } from "zod";
import { optionalAuth, authRequired } from "../middleware/auth";
import { query, queryOne, withTransaction } from "../lib/db";

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

router.post("/", optionalAuth, async (req, res, next) => {
  try {
    const body = checkoutSchema.parse(req.body);

    let sourceItems: Array<{ productId: number; quantity: number }> = [];
    if (req.user) {
      const cart = await queryOne<{ id: number }>("SELECT id FROM carts WHERE user_id = $1", [req.user.id]);
      if (cart) {
        sourceItems = await query<{ productId: number; quantity: number }>(
          'SELECT product_id as "productId", quantity FROM cart_items WHERE cart_id = $1',
          [cart.id],
        );
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

    const order = await withTransaction(async (client) => {
      const orderItemRows: Array<{
        productId: number;
        snapshotName: string;
        snapshotSku: string;
        price: number;
        quantity: number;
        lineTotal: number;
      }> = [];

      for (const item of normalizedItems) {
        const product = await queryOne<{
          id: number;
          name: string;
          sku: string;
          price: number;
          stock: number;
          isAvailable: boolean;
        }>(
          'SELECT id, name, sku, price, stock, is_available as "isAvailable" FROM products WHERE id = $1 FOR UPDATE',
          [item.productId],
          client,
        );
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

      const createdOrder = await queryOne<{ id: number }>(
        `INSERT INTO orders (user_id, status, full_name, phone, email, comment, address, pickup_method, total)
         VALUES ($1, 'PENDING', $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          req.user?.id ?? null,
          body.fullName,
          body.phone,
          body.email,
          body.comment ?? null,
          body.address ?? null,
          body.pickupMethod ?? null,
          total,
        ],
        client,
      );

      if (!createdOrder) {
        throw new Error("Could not create order");
      }
      const orderId = createdOrder.id;

      for (const row of orderItemRows) {
        await query(
          `INSERT INTO order_items (order_id, product_id, snapshot_name, snapshot_sku, price, quantity, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
          orderId,
          row.productId,
          row.snapshotName,
          row.snapshotSku,
          row.price,
          row.quantity,
          row.lineTotal,
          ],
          client,
        );
      }

      for (const row of orderItemRows) {
        await query(
          "UPDATE products SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [row.quantity, row.productId],
          client,
        );
      }

      if (req.user) {
        const cart = await queryOne<{ id: number }>("SELECT id FROM carts WHERE user_id = $1", [req.user.id], client);
        if (cart) {
          await query("DELETE FROM cart_items WHERE cart_id = $1", [cart.id], client);
        }
      }

      const order = await queryOne<Record<string, unknown>>("SELECT * FROM orders WHERE id = $1", [orderId], client);
      const items = await query("SELECT * FROM order_items WHERE order_id = $1", [orderId], client);
      return { ...(order ?? {}), items };
    });

    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
});

router.get("/my", authRequired, async (req, res, next) => {
  try {
    const orders = await query<{ id: number }>(
      "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user!.id],
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

export default router;
