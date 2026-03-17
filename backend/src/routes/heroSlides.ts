import { Router } from "express";
import { query } from "../lib/db";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const slides = await query(
      `SELECT id, position, label, image_url, title, subtitle, button_text, button_link,
              CASE WHEN is_active THEN 1 ELSE 0 END as is_active,
              created_at, updated_at
       FROM hero_slides
       WHERE is_active = TRUE
       ORDER BY position ASC`,
    );
    res.json(slides);
  } catch (error) {
    next(error);
  }
});

export default router;
