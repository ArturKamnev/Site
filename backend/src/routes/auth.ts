import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../lib/db";
import { authRequired } from "../middleware/auth";
import { signToken } from "../utils/jwt";

const router = Router();

const registerSchema = z
  .object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(6).max(64),
    confirmPassword: z.string().min(6).max(64),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(64),
});

router.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(body.email) as
      | { id: number }
      | undefined;
    if (exists) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const role = db.prepare("SELECT id, name FROM roles WHERE name = ?").get("user") as
      | { id: number; name: string }
      | undefined;
    if (!role) {
      return res.status(500).json({ message: "Default role not found. Run seed." });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const result = db
      .prepare("INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)")
      .run(body.name, body.email, passwordHash, role.id);

    const userId = Number(result.lastInsertRowid);
    const token = signToken({ userId, roleId: role.id, roleName: role.name });

    return res.status(201).json({
      token,
      user: {
        id: userId,
        name: body.name,
        email: body.email,
        role: role.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.password_hash as passwordHash, u.role_id as roleId, r.name as roleName
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.email = ?`,
      )
      .get(body.email) as
      | { id: number; name: string; email: string; passwordHash: string; roleId: number; roleName: string }
      | undefined;

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken({ userId: user.id, roleId: user.roleId, roleName: user.roleName });
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.roleName,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authRequired, (req, res) => {
  res.json({
    id: req.user!.id,
    name: req.user!.name,
    email: req.user!.email,
    role: req.user!.roleName,
  });
});

export default router;
