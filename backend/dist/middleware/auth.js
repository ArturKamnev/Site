"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rolesRequired = exports.optionalAuth = exports.authRequired = void 0;
const db_1 = require("../lib/db");
const jwt_1 = require("../utils/jwt");
const authRequired = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const token = authHeader.replace("Bearer ", "");
        const payload = (0, jwt_1.verifyToken)(token);
        const user = await (0, db_1.queryOne)(`SELECT u.id, u.email, u.name, u.role_id as "roleId", r.name as "roleName"
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`, [payload.userId]);
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
    }
    catch {
        return res.status(401).json({ message: "Invalid token" });
    }
};
exports.authRequired = authRequired;
const optionalAuth = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return next();
        }
        const token = authHeader.replace("Bearer ", "");
        const payload = (0, jwt_1.verifyToken)(token);
        const user = await (0, db_1.queryOne)(`SELECT u.id, u.email, u.name, u.role_id as "roleId", r.name as "roleName"
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`, [payload.userId]);
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
    }
    catch {
        next();
    }
};
exports.optionalAuth = optionalAuth;
const rolesRequired = (...roles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    if (!roles.includes(req.user.roleName)) {
        return res.status(403).json({ message: "Forbidden" });
    }
    next();
};
exports.rolesRequired = rolesRequired;
