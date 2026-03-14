"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const db_1 = require("../lib/db");
const auth_1 = require("../middleware/auth");
const jwt_1 = require("../utils/jwt");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(2).max(100),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6).max(64),
    confirmPassword: zod_1.z.string().min(6).max(64),
})
    .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6).max(64),
});
router.post("/register", async (req, res, next) => {
    try {
        const body = registerSchema.parse(req.body);
        const exists = db_1.db.prepare("SELECT id FROM users WHERE email = ?").get(body.email);
        if (exists) {
            return res.status(409).json({ message: "Email already in use" });
        }
        const role = db_1.db.prepare("SELECT id, name FROM roles WHERE name = ?").get("user");
        if (!role) {
            return res.status(500).json({ message: "Default role not found. Run seed." });
        }
        const passwordHash = await bcryptjs_1.default.hash(body.password, 10);
        const result = db_1.db
            .prepare("INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)")
            .run(body.name, body.email, passwordHash, role.id);
        const userId = Number(result.lastInsertRowid);
        const token = (0, jwt_1.signToken)({ userId, roleId: role.id, roleName: role.name });
        return res.status(201).json({
            token,
            user: {
                id: userId,
                name: body.name,
                email: body.email,
                role: role.name,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.post("/login", async (req, res, next) => {
    try {
        const body = loginSchema.parse(req.body);
        const user = db_1.db
            .prepare(`SELECT u.id, u.name, u.email, u.password_hash as passwordHash, u.role_id as roleId, r.name as roleName
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.email = ?`)
            .get(body.email);
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const ok = await bcryptjs_1.default.compare(body.password, user.passwordHash);
        if (!ok) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const token = (0, jwt_1.signToken)({ userId: user.id, roleId: user.roleId, roleName: user.roleName });
        return res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.roleName,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
router.get("/me", auth_1.authRequired, (req, res) => {
    res.json({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.roleName,
    });
});
exports.default = router;
