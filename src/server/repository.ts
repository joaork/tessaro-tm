import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { CatalogKind, Machine, MtmElement, Origin, PoPreview, ProcessOperation, Workspace } from '../shared/contracts';
import type { PlanPreview, SavedPlan } from '../shared/workflow';
import { demoMachines, demoMtm, hasDemoCode } from './demo';
import { AppError } from './errors';

type NewReference<T extends Machine | MtmElement> = Omit<T, 'version' | 'origin' | 'updatedAt' | 'source'>;
export type ReferenceInput = NewReference<Machine> | NewReference<MtmElement>;
export type CatalogEntry = Machine | MtmElement;

interface OperationRow {
  number: number;
  id: string;
  createdAt: string;
  snapshot: string;
  previousId: string | null;
  supersededBy: string | null;
}

function operationFromRow(row: OperationRow): ProcessOperation {
  const { id, number, createdAt, snapshot } = row;
  return {
    ...(JSON.parse(snapshot) as PoPreview), id, number, createdAt,
    ...(row.previousId ? { previousId: row.previousId } : {}),
    ...(row.supersededBy ? { supersededBy: row.supersededBy } : {}),
  };
}

const operationQuery = [
  'SELECT o.number, o.id, o.created_at AS createdAt, o.snapshot,',
  'parent.previous_id AS previousId, successor.revision_id AS supersededBy',
  'FROM operations o',
  'LEFT JOIN revision_links parent ON parent.revision_id = o.id',
  'LEFT JOIN revision_links successor ON successor.previous_id = o.id',
].join(' ');

export class Repository {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  private migrate(): void {
    const version = this.db.prepare('PRAGMA user_version').get()?.user_version;
    if (version === 2) return;
    if (version === 1) return this.migrateWorkflow();
    if (version !== 0) throw new Error(`Versão de banco incompatível: ${version}.`);
    this.transaction(() => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS catalog (
          kind TEXT NOT NULL CHECK(kind IN ('machines', 'mtm')),
          code TEXT NOT NULL,
          payload TEXT NOT NULL CHECK(json_valid(payload)),
          PRIMARY KEY (kind, code)
        ) STRICT;
        CREATE TABLE IF NOT EXISTS import_batches (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK(kind IN ('machines', 'mtm')),
          filename TEXT NOT NULL,
          sheet TEXT NOT NULL,
          imported_at TEXT NOT NULL,
          item_count INTEGER NOT NULL CHECK(item_count > 0)
        ) STRICT;
        CREATE TABLE IF NOT EXISTS operations (
          number INTEGER PRIMARY KEY,
          id TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          snapshot TEXT NOT NULL CHECK(json_valid(snapshot))
        ) STRICT;
        PRAGMA user_version = 1;
      `);
    });
    this.migrateWorkflow();
  }

  private migrateWorkflow(): void {
    this.transaction(() => this.db.exec([
      'CREATE TABLE revision_links (previous_id TEXT PRIMARY KEY REFERENCES operations(id),',
      'revision_id TEXT NOT NULL UNIQUE REFERENCES operations(id)) STRICT;',
      'CREATE TABLE production_plans (id TEXT PRIMARY KEY, created_at TEXT NOT NULL,',
      'payload TEXT NOT NULL CHECK(json_valid(payload))) STRICT;',
      'PRAGMA user_version = 2;',
    ].join(' ')));
  }

  close(): void {
    this.db.close();
  }

  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  catalog(kind: 'machines'): Machine[];
  catalog(kind: 'mtm'): MtmElement[];
  catalog(kind: CatalogKind): CatalogEntry[];
  catalog(kind: CatalogKind): CatalogEntry[] {
    return this.db.prepare('SELECT payload FROM catalog WHERE kind = ? ORDER BY code').all(kind)
      .map((row) => JSON.parse(String(row.payload)) as CatalogEntry);
  }

  workspace(): Workspace {
    const operations = this.db.prepare(operationQuery + ' ORDER BY o.number DESC').all();
    return {
      machines: this.catalog('machines'),
      mtm: this.catalog('mtm'),
      operations: operations.map((row) => operationFromRow(row as unknown as OperationRow)),
    };
  }

  writeReference(kind: CatalogKind, input: ReferenceInput, expectedVersion?: number): CatalogEntry {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT payload FROM catalog WHERE kind = ? AND code = ?').get(kind, input.code);
      const existing = row ? JSON.parse(String(row.payload)) as CatalogEntry : undefined;

      if (existing?.version !== expectedVersion) {
        const message = expectedVersion === undefined
          ? `O código “${input.code}” já está cadastrado. Edite o item na lista.`
          : 'O cadastro mudou desde que foi aberto. Atualize a página e revise a edição.';
        throw new AppError(message, 409, [{ field: 'code', message }]);
      }

      const entry: CatalogEntry = {
        ...input,
        version: (existing?.version ?? 0) + 1,
        origin: existing?.origin ?? (hasDemoCode(input.code) ? 'demo' : 'manual'),
        source: existing?.source,
        updatedAt: new Date().toISOString(),
      };
      this.db.prepare(`INSERT INTO catalog (kind, code, payload) VALUES (?, ?, ?)
        ON CONFLICT (kind, code) DO UPDATE SET payload = excluded.payload`).run(kind, input.code, JSON.stringify(entry));
      return entry;
    });
  }

  seedDemo(): Workspace {
    this.transaction(() => {
      const insert = this.db.prepare('INSERT OR IGNORE INTO catalog (kind, code, payload) VALUES (?, ?, ?)');
      const now = new Date().toISOString();
      for (const [kind, rows] of [['machines', demoMachines], ['mtm', demoMtm]] as const) {
        for (const row of rows) {
          insert.run(kind, row.code, JSON.stringify({ ...row, origin: 'demo', version: 1, updatedAt: now }));
        }
      }
    });
    return this.workspace();
  }

  insertImport(kind: CatalogKind, filename: string, sheet: string, rows: { line: number; values: ReferenceInput }[]): string {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.prepare('INSERT INTO import_batches VALUES (?, ?, ?, ?, ?, ?)').run(id, kind, filename, sheet, now, rows.length);
    const insert = this.db.prepare('INSERT INTO catalog (kind, code, payload) VALUES (?, ?, ?)');
    for (const { line, values } of rows) {
      const origin: Origin = hasDemoCode(values.code) ? 'demo' : 'imported';
      insert.run(kind, values.code, JSON.stringify({
        ...values, version: 1, origin, updatedAt: now, source: { filename, sheet, line, batchId: id },
      }));
    }
    return id;
  }

  insertOperation(snapshot: PoPreview): ProcessOperation {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const { lastInsertRowid } = this.db.prepare('INSERT INTO operations (id, created_at, snapshot) VALUES (?, ?, ?)')
      .run(id, createdAt, JSON.stringify(snapshot));
    return { ...snapshot, id, createdAt, number: Number(lastInsertRowid) };
  }

  getOperation(id: string): ProcessOperation {
    const row = this.db.prepare(operationQuery + ' WHERE o.id = ?').get(id);
    if (!row) throw new AppError('Ficha de Processo Operacional não encontrada.', 404);
    return operationFromRow(row as unknown as OperationRow);
  }

  insertRevision(previousId: string, snapshot: PoPreview): ProcessOperation {
    const operation = this.insertOperation(snapshot);
    this.db.prepare('INSERT INTO revision_links (previous_id, revision_id) VALUES (?, ?)').run(previousId, operation.id);
    return { ...operation, previousId };
  }

  savePlan(preview: PlanPreview): SavedPlan {
    const plan = { ...preview, id: randomUUID(), createdAt: new Date().toISOString() };
    this.db.prepare('INSERT INTO production_plans (id, created_at, payload) VALUES (?, ?, ?)').run(plan.id, plan.createdAt, JSON.stringify(plan));
    return plan;
  }

  plans(): SavedPlan[] {
    return this.db.prepare('SELECT payload FROM production_plans ORDER BY created_at DESC, rowid DESC').all()
      .map((row) => JSON.parse(String(row.payload)) as SavedPlan);
  }

  getPlan(id: string): SavedPlan {
    const row = this.db.prepare('SELECT payload FROM production_plans WHERE id = ?').get(id);
    if (!row) throw new AppError('Plano de produção não encontrado.', 404);
    return JSON.parse(String(row.payload)) as SavedPlan;
  }
}
