"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const router = (0, express_1.Router)();
router.get("/", (_req, res, next) => {
    try {
        const categories = db_1.db
            .prepare(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as productsCount
         FROM categories c
         ORDER BY c.name ASC`)
            .all();
        res.json(categories);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
