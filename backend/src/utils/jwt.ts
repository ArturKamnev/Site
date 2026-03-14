import jwt from "jsonwebtoken";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export type AuthTokenPayload = {
  userId: number;
  roleName: string;
  roleId: number;
};

export const signToken = (payload: AuthTokenPayload): string =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });

export const verifyToken = (token: string): AuthTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & AuthTokenPayload;
  return {
    userId: decoded.userId,
    roleName: decoded.roleName,
    roleId: decoded.roleId,
  };
};
