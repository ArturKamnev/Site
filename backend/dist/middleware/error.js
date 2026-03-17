"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFoundHandler = void 0;
const pg_1 = require("pg");
const zod_1 = require("zod");
const notFoundHandler = (_req, res) => {
    res.status(404).json({ message: "Route not found" });
};
exports.notFoundHandler = notFoundHandler;
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            message: "Validation error",
            issues: err.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
    }
    if (err instanceof pg_1.DatabaseError) {
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
        const appError = err;
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
exports.errorHandler = errorHandler;
