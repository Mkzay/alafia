import { MemoryRepository } from './memory-repository';
import { runRepositoryContract } from './repository-contract';

runRepositoryContract('memory', async (clock) => {
  const repo = new MemoryRepository(clock);
  return {
    repo,
    injectRawLog: async (raw, id) => repo.injectRawLog(raw, id),
    injectRawSetting: async (key, value) => repo.injectRawSetting(key, value),
    close: async () => undefined,
  };
});
