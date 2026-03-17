"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../lib/db");
const router = (0, express_1.Router)();
router.get("/", async (_req, res, next) => {
    try {
        const categories = await (0, db_1.query)(`SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) as "productsCount"
       FROM categories c
       ORDER BY c.name ASC`);
        res.json(categories);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
