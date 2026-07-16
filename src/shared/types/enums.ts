export type MiddlewareType =
  | 'mysql' | 'redis' | 'rabbitmq' | 'kafka' | 'nacos'
  | 'apollo' | 'minio' | 'elasticsearch' | 'clickhouse' | 'mongodb' | 'rocketmq';

export const ENVIRONMENTS = [
  { value: 'production', label: '生产', color: '#d1fae5', textColor: '#047857' },
  { value: 'development', label: '开发', color: '#dbeafe', textColor: '#1d4ed8' },
  { value: 'test', label: '测试', color: '#fef3c7', textColor: '#b45309' },
  { value: 'staging', label: '预发布', color: '#ede9fe', textColor: '#6d28d9' },
] as const;

export const MIDDLEWARE_TYPES: Array<{ value: MiddlewareType; label: string; icon: string; color: string }> = [
  { value: 'mysql', label: 'MySQL', icon: 'fa-database', color: '#00758f' },
  { value: 'redis', label: 'Redis', icon: 'fa-bolt', color: '#dc382d' },
  { value: 'rabbitmq', label: 'RabbitMQ', icon: 'fa-message', color: '#ff6600' },
  { value: 'kafka', label: 'Kafka', icon: 'fa-stream', color: '#000000' },
  { value: 'nacos', label: 'Nacos', icon: 'fa-gear', color: '#3b82f6' },
  { value: 'apollo', label: 'Apollo', icon: 'fa-rocket', color: '#2196f3' },
  { value: 'minio', label: 'MinIO', icon: 'fa-cube', color: '#c72e29' },
  { value: 'elasticsearch', label: 'Elasticsearch', icon: 'fa-magnifying-glass-chart', color: '#005571' },
  { value: 'clickhouse', label: 'ClickHouse', icon: 'fa-database', color: '#ffcc00' },
  { value: 'mongodb', label: 'MongoDB', icon: 'fa-leaf', color: '#009639' },
  { value: 'rocketmq', label: 'RocketMQ', icon: 'fa-paper-plane', color: '#d77a3b' },
];

export function getMiddlewareMeta(type: MiddlewareType) {
  return MIDDLEWARE_TYPES.find(m => m.value === type) ?? MIDDLEWARE_TYPES[0];
}

export function getEnvironmentMeta(env: string) {
  return ENVIRONMENTS.find(e => e.value === env) ?? ENVIRONMENTS[1];
}
