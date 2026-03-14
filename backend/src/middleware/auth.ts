import { NextFunction, Request, Response } from "express";
import { db } from "../lib/db";
import { verifyToken } from "../utils/jwt";

export const authRequired = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = verifyToken(token);

    const user = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.role_id as roleId, r.name as roleName
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?`,
      )
      .get(payload.userId) as
      | { id: number; email: string; name: string; roleId: number; roleName: string }
      | undefined;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleName: user.roleName,
    };

    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = verifyToken(token);

    const user = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.role_id as roleId, r.name as roleName
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?`,
      )
      .get(payload.userId) as
      | { id: number; email: string; name: string; roleId: number; roleName: string }
      | undefined;

    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        roleName: user.roleName,
      };
    }

    next();
  } catch {
    next();
  }
};

export const rolesRequired =
  (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!roles.includes(req.user.roleName)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
