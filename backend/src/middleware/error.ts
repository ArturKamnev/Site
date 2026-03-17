import { NextFunction, Request, Response } from "express";
import { DatabaseError } from "pg";
import { ZodError } from "zod";

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation error",
      issues: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (err instanceof DatabaseError) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Resource already exists" });
    }
    if (err.code === "23503") {
      return res.status(409).json({ message: "Referenced resource does not exist" });
    }
    if (err.code === "22P02") {
      return res.status(400).json({ message: "Invalid identifier or payload format" });
    }
  }

  if (err instanceof Error) {
    const appError = err as Error & {
      status?: number;
      code?: string;
      productId?: number;
      requestedQuantity?: number;
      availableStock?: number;
    };
    if (appError.status && appError.status >= 400 && appError.status <= 599) {
      return res.status(appError.status).json({
        message: appError.message,
        code: appError.code,
        productId: appError.productId,
        requestedQuantity: appError.requestedQuantity,
        availableStock: appError.availableStock,
      });
    }
    return res.status(500).json({ message: err.message });
  }

  return res.status(500).json({ message: "Internal server error" });
};
