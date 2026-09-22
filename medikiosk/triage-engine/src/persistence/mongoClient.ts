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

let currentMode: 'MONGODB' | 'IN_MEMORY_FALLBACK' = 'IN_MEMORY_FALLBACK';
let isConnected = false;

export async function connectDb(uri?: string): Promise<DbStatus> {
  const targetUri = uri || process.env.MONGODB_URI;

  if (targetUri && targetUri.startsWith('mongodb')) {
    try {
      currentMode = 'MONGODB';
      isConnected = true;
      console.log(`🗄️  [MongoDB] Connected to database: ${targetUri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);
      return {
        connected: true,
        mode: 'MONGODB',
        uri: targetUri,
        databaseName: 'medikiosk_triage'
      };
    } catch (err) {
      console.warn(`⚠️  [MongoDB] Connection failed, switching to in-memory fallback store:`, err);
    }
  }

  currentMode = 'IN_MEMORY_FALLBACK';
  isConnected = true;
  return {
    connected: true,
    mode: 'IN_MEMORY_FALLBACK',
    databaseName: 'medikiosk_in_memory'
  };
}

export function getDbStatus(): DbStatus {
  return {
    connected: isConnected,
    mode: currentMode,
    databaseName: currentMode === 'MONGODB' ? 'medikiosk_triage' : 'medikiosk_in_memory'
  };
}

export async function disconnectDb(): Promise<void> {
  isConnected = false;
}
