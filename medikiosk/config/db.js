const mongoose = require('mongoose');

// In-memory Mock Store for fallback when MongoDB daemon is offline
class MemoryStore {
  constructor() {
    this.collections = {
      ProvisionalIntake: new Map(),
      HprAuthToken: new Map(),
      AuditLog: new Map()
    };
  }

  getCollection(name) {
    if (!this.collections[name]) {
      this.collections[name] = new Map();
    }
    return this.collections[name];
  }

  async save(collectionName, doc) {
    const col = this.getCollection(collectionName);
    const id = (collectionName === 'AuditLog' ? (doc.logId || `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`) : null) || doc.intakeId || doc.hprId || doc.token || doc._id || `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record = { ...doc, _id: id, createdAt: doc.createdAt || new Date(), updatedAt: new Date() };
    col.set(id, record);
    return record;
  }

  matchesQuery(item, query = {}) {
    if (!query || Object.keys(query).length === 0) return true;

    if (query.$or && Array.isArray(query.$or)) {
      const orMatched = query.$or.some(subQuery => this.matchesQuery(item, subQuery));
      if (!orMatched) return false;
    }

    for (const key of Object.keys(query)) {
      if (key === '$or') continue;
      if (item[key] !== query[key]) {
        return false;
      }
    }
    return true;
  }

  async findOne(collectionName, query) {
    const results = await this.find(collectionName, query);
    return results.length > 0 ? results[0] : null;
  }

  async find(collectionName, query = {}) {
    const col = this.getCollection(collectionName);
    const results = [];
    for (const item of col.values()) {
      if (this.matchesQuery(item, query)) {
        results.push(item);
      }
    }

    // Prefer more specific match if $or query checks both intakeId and sessionId
    if (query.$or && Array.isArray(query.$or)) {
      const hasIntakeCheck = query.$or.some(q => q.intakeId);
      const hasSessionCheck = query.$or.some(q => q.sessionId);
      if (hasIntakeCheck && hasSessionCheck) {
        results.sort((a, b) => {
          const aIsIntake = query.$or.some(q => q.intakeId && a.intakeId === q.intakeId);
          const bIsIntake = query.$or.some(q => q.intakeId && b.intakeId === q.intakeId);
          if (aIsIntake && !bIsIntake) return -1;
          if (!aIsIntake && bIsIntake) return 1;
          return 0;
        });
      }
    }

    return results;
  }

  async updateOne(collectionName, query, update) {
    const item = await this.findOne(collectionName, query);
    if (!item) return null;
    const updated = { ...item, ...update, updatedAt: new Date() };
    const col = this.getCollection(collectionName);
    col.set(item._id, updated);
    return updated;
  }
}

const memoryStore = new MemoryStore();
let isMongoConnected = false;

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medikiosk';
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 2000
    });
    isMongoConnected = true;
    console.log(`[Database] MongoDB connected successfully: ${mongoURI}`);
  } catch (err) {
    isMongoConnected = false;
    console.log(`[Database] MongoDB connection bypassed (${err.message}). Using high-performance in-memory persistence fallback engine.`);
  }
};

module.exports = {
  connectDB,
  isMongoConnected: () => isMongoConnected,
  memoryStore
};
