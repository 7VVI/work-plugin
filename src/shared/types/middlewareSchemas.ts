import type { MiddlewareType } from './enums';

export interface MiddlewareFieldSchema {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
}

export const MIDDLEWARE_EXTRA_SCHEMAS: Record<MiddlewareType, MiddlewareFieldSchema[]> = {
  mysql: [
    { key: 'charset', label: 'Charset', type: 'string', defaultValue: 'utf8mb4' },
    { key: 'collation', label: 'Collation', type: 'string' },
  ],
  redis: [
    { key: 'db', label: 'DB Index', type: 'number', defaultValue: 0 },
  ],
  rabbitmq: [
    { key: 'vhost', label: 'VHost', type: 'string', defaultValue: '/' },
  ],
  mongodb: [
    { key: 'authSource', label: 'Auth Source', type: 'string', defaultValue: 'admin' },
    { key: 'replicaSet', label: 'Replica Set', type: 'string' },
  ],
  kafka: [
    { key: 'brokerId', label: 'Broker ID', type: 'number' },
  ],
  nacos: [
    { key: 'namespace', label: 'Namespace', type: 'string' },
    { key: 'group', label: 'Group', type: 'string', defaultValue: 'DEFAULT_GROUP' },
  ],
  apollo: [
    { key: 'appId', label: 'App ID', type: 'string', required: true },
    { key: 'cluster', label: 'Cluster', type: 'string', defaultValue: 'default' },
  ],
  minio: [
    { key: 'bucket', label: 'Bucket', type: 'string' },
    { key: 'useSSL', label: 'Use SSL', type: 'boolean', defaultValue: true },
  ],
  elasticsearch: [
    { key: 'index', label: 'Index', type: 'string' },
  ],
  clickhouse: [
    { key: 'cluster', label: 'Cluster', type: 'string' },
  ],
  rocketmq: [
    { key: 'topic', label: 'Default Topic', type: 'string' },
  ],
};
