import type { DbCell, DbColumn, DbDialect, DbObjectItem, DbObjectKind } from '@protocol/db';
import type { DbDriver, DbQueryOptions, DbQueryResult, DbSession, DbTarget } from '../src/db/types';

export interface FakeDbBehavior {
  /** 查询返回的行数 */
  rowCount?: number;
  /** 表总行数（用于分页/截断） */
  totalRows?: number;
  /** 查询时抛出的错误 */
  queryError?: Error;
  /** listObjects 返回的对象 */
  objects?: Partial<Record<DbObjectKind, DbObjectItem[]>>;
  /** connect 时抛出的错误 */
  connectError?: Error;
  /** 记录最近一次 connect 的目标，便于断言参数来源 */
  lastTarget?: DbTarget;
  /** 记录最近一次 query 的 SQL */
  lastSql?: string;
  /** 记录最近一次 query 的选项（含 database） */
  lastOptions?: DbQueryOptions;
  /** 是否被 abort（取消查询） */
  aborted?: boolean;
  /** 是否执行过单元格修改 */
  updated?: boolean;
  /** 最近一次取存储过程定义的对象 */
  lastRoutine?: { kind: string; schema?: string; name: string };
  /** 建连延迟（毫秒），用于模拟慢连接 */
  connectDelayMs?: number;
}

/** 测试用假驱动：不连真实数据库，按脚本返回数据 */
export class FakeDbDriver implements DbDriver {
  readonly dialect: DbDialect;
  readonly behavior: FakeDbBehavior = {};

  constructor(dialect: DbDialect = 'postgres') {
    this.dialect = dialect;
  }

  async connect(target: DbTarget): Promise<DbSession> {
    this.behavior.lastTarget = target;
    if (this.behavior.connectError) throw this.behavior.connectError;
    if (this.behavior.connectDelayMs) {
      await new Promise(resolve => setTimeout(resolve, this.behavior.connectDelayMs));
    }
    const behavior = this.behavior;
    return {
      dialect: this.dialect,
      async query(sql: string, options: DbQueryOptions): Promise<DbQueryResult> {
        behavior.lastSql = sql;
        behavior.lastOptions = options;
        if (behavior.queryError) throw behavior.queryError;
        const total = behavior.totalRows ?? behavior.rowCount ?? 2;
        const offset = options.offset ?? 0;
        const available = Math.max(0, total - offset);
        const take = Math.min(options.maxRows, available);
        const columns: DbColumn[] = [
          { name: 'id', dataType: 'int', ordinal: 1, primary: true },
          { name: 'name', dataType: 'text', ordinal: 2 },
        ];
        const rows: DbCell[][] = [];
        for (let i = 0; i < take; i += 1) rows.push([offset + i, `row-${offset + i}`]);
        return {
          columns,
          rows,
          rowCount: rows.length,
          truncated: offset + rows.length < total,
          elapsedMs: 1,
        };
      },
      async listObjects(kind: DbObjectKind): Promise<DbObjectItem[]> {
        return behavior.objects?.[kind] ?? [];
      },
      async updateCell(): Promise<number> {
        behavior.updated = true;
        return 1;
      },
      async getRoutine(kind, schema, name) {
        behavior.lastRoutine = { kind, schema, name };
        return { definition: 'CREATE PROCEDURE demo()', parameters: [{ name: 'a', type: 'int' }] };
      },
      async describeTable() {
        return [{ name: 'id', dataType: 'int', ordinal: 1, primary: true }];
      },
      async listIndexes() {
        return [{ name: 'idx_id', unique: true, primary: true, columns: ['id'] }];
      },
      async listForeignKeys() {
        return [];
      },
      async listTriggers() {
        return [];
      },
      abort() {
        behavior.aborted = true;
      },
      async close() {},
    };
  }
}
