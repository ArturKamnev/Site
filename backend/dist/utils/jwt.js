"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.signToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const signToken = (payload) => jsonwebtoken_1.default.sign(payload, env_1.env.JWT_SECRET, {
    expiresIn: env_1.env.JWT_EXPIRES_IN,
});
exports.signToken = signToken;
const verifyToken = (token) => {
    const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
    return {
        userId: decoded.userId,
        roleName: decoded.roleName,
        roleId: decoded.roleId,
    };
};
exports.verifyToken = verifyToken;
