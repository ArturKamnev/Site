import { Router } from "express";
import { query } from "../lib/db";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const categories = await query(
      `SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) as "productsCount"
       FROM categories c
       ORDER BY c.name ASC`,
    );
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

export default router;
