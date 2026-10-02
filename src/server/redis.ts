import { Redis, RedisOptions } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const defaultRedisOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  reconnectOnError(err: Error) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  }
};

let sharedRedisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!sharedRedisConnection) {
    sharedRedisConnection = new Redis(redisUrl, defaultRedisOptions);

    sharedRedisConnection.on('error', (err) => {
      console.error('[Redis Error]', err.message);
    });

    sharedRedisConnection.on('connect', () => {
      console.log('[Redis] Conectado ao cluster com sucesso.');
    });
  }

  return sharedRedisConnection;
}

export function createRedisClient(): Redis {
  return new Redis(redisUrl, defaultRedisOptions);
}
