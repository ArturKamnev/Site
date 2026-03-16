import { Router } from "express";
import { db } from "../lib/db";

const router = Router();

router.get("/", (_req, res, next) => {
  try {
    const slides = db
      .prepare("SELECT * FROM hero_slides WHERE is_active = 1 ORDER BY position ASC")
      .all();
    res.json(slides);
  } catch (error) {
    next(error);
  }
});

export default router;
