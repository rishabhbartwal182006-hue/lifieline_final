/**
 * Persistence & Database Client (Dual-Mode Adapter)
 *
 * Supports MongoDB when MONGODB_URI is provided and accessible,
 * with zero-config in-memory fallback store for offline/demo operation.
 */
export interface DbStatus {
    connected: boolean;
    mode: 'MONGODB' | 'IN_MEMORY_FALLBACK';
    uri?: string;
    databaseName: string;
}
export declare function connectDb(uri?: string): Promise<DbStatus>;
export declare function getDbStatus(): DbStatus;
export declare function disconnectDb(): Promise<void>;
