import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, 'data');
mkdirSync(dataDir, { recursive: true });

const dbPath = join(dataDir, 'worksets.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS worksets (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#FF8800',
    opacity REAL NOT NULL DEFAULT 0.35,
    express_ids TEXT NOT NULL DEFAULT '[]',
    global_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_worksets_model ON worksets(model_id);
`);

export default db;
