"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const getNextUniqueId = async (role) => {
    if (role === 'Student') {
        const count = await mongoose_1.default.model('User').countDocuments({ role: 'Student' });
        return `STU${String(count + 1).padStart(3, '0')}`;
    }
    if (role === 'Teacher') {
        const count = await mongoose_1.default.model('User').countDocuments({ role: 'Teacher' });
        return `T${String(count + 1).padStart(4, '0')}`;
    }
    if (role === 'TA') {
        const count = await mongoose_1.default.model('User').countDocuments({ role: 'TA' });
        return `TECH${String(count + 1).padStart(4, '0')}`;
    }
    return `STU${String(await mongoose_1.default.model('User').countDocuments({ role: 'Student' }) + 1).padStart(3, '0')}`;
};
const UserSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['Student', 'TA', 'Teacher'], default: 'Student' },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    uniqueId: { type: String, unique: true, required: true },
    // For TAs — references the Teacher they operate under
    teacherId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
UserSchema.pre('validate', async function (next) {
    const user = this;
    if (!user.uniqueId) {
        user.uniqueId = await getNextUniqueId(user.role || 'Student');
    }
    next();
});
exports.default = mongoose_1.default.model('User', UserSchema);
