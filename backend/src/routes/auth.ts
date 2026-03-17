import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { queryOne } from "../lib/db";
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
    const exists = await queryOne<{ id: number }>("SELECT id FROM users WHERE email = $1", [body.email]);
    if (exists) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const role = await queryOne<{ id: number; name: string }>(
      "SELECT id, name FROM roles WHERE name = $1",
      ["user"],
    );
    if (!role) {
      return res.status(500).json({ message: "Default role not found. Run seed." });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const created = await queryOne<{ id: number }>(
      "INSERT INTO users (name, email, password_hash, role_id) VALUES ($1, $2, $3, $4) RETURNING id",
      [body.name, body.email, passwordHash, role.id],
    );

    if (!created) {
      return res.status(500).json({ message: "Could not create user" });
    }

    const userId = created.id;
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
    const user = await queryOne<{
      id: number;
      name: string;
      email: string;
      passwordHash: string;
      roleId: number;
      roleName: string;
    }>(
      `SELECT u.id, u.name, u.email, u.password_hash as "passwordHash", u.role_id as "roleId", r.name as "roleName"
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.email = $1`,
      [body.email],
    );

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
