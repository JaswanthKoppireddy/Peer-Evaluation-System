"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * clearDatabase.ts
 * Run this script once to wipe all data from the portal (fresh start).
 * Usage: npx ts-node src/clearDatabase.ts
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
const MONGO_URI = process.env.MONGO_URI || '';
async function clearAll() {
    if (!MONGO_URI) {
        console.error('❌  MONGO_URI is not set in .env');
        process.exit(1);
    }
    await mongoose_1.default.connect(MONGO_URI);
    console.log('✅  Connected to MongoDB');
    const db = mongoose_1.default.connection.db;
    const collections = await db.listCollections().toArray();
    if (collections.length === 0) {
        console.log('ℹ️   No collections found — database already empty.');
    }
    else {
        for (const col of collections) {
            await db.collection(col.name).deleteMany({});
            console.log(`🗑️   Cleared collection: ${col.name}`);
        }
        console.log('\n✅  All data cleared. The portal is now fresh.');
    }
    await mongoose_1.default.disconnect();
    process.exit(0);
}
clearAll().catch(err => {
    console.error('❌  Error clearing database:', err);
    process.exit(1);
});
