"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const required = ["JWT_SECRET", "DATABASE_URL"];
for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Missing required env variable: ${key}`);
    }
}
exports.env = {
    PORT: Number(process.env.PORT ?? 4000),
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
    FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_SSL: process.env.DATABASE_SSL === "true",
    NODE_ENV: process.env.NODE_ENV ?? "development",
};
