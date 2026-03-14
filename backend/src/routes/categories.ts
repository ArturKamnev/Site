import { Router } from "express";
import { db } from "../lib/db";

const router = Router();

router.get("/", (_req, res, next) => {
  try {
    const categories = db
      .prepare(
        `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as productsCount
         FROM categories c
         ORDER BY c.name ASC`,
      )
      .all();
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

export default router;
