"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const zod_1 = require("zod");
const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    }
    catch (err) {
        if (err instanceof zod_1.ZodError) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
            });
        }
        next(err);
    }
};
exports.validate = validate;
