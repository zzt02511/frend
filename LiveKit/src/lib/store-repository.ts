import type { AppStore } from "./domain";
import { defaultStorePath, loadStoreFromFile, normalizeStore, saveStoreToFile } from "./store-persistence";

export interface StoreRepository {
  load(): AppStore;
  save(store: AppStore): void;
  mutate<T>(mutator: (store: AppStore) => T): T;
}

export class JsonStoreRepository implements StoreRepository {
  constructor(private readonly filePath = defaultStorePath) {}

  load(): AppStore {
    return loadStoreFromFile(this.filePath);
  }

  save(store: AppStore): void {
    saveStoreToFile(normalizeStore(store), this.filePath);
  }

  mutate<T>(mutator: (store: AppStore) => T): T {
    const store = this.load();
    const result = mutator(store);
    this.save(store);
    return result;
  }
}

const repositoryGlobal = globalThis as typeof globalThis & {
  __wechatLiveStoreRepository?: StoreRepository;
};

export function getStoreRepository() {
  if (!repositoryGlobal.__wechatLiveStoreRepository) {
    if (isPgStorageEnabled()) throw new Error("POSTGRES_REPOSITORY_NOT_INITIALIZED");
    repositoryGlobal.__wechatLiveStoreRepository = new JsonStoreRepository();
  }
  return repositoryGlobal.__wechatLiveStoreRepository;
}

export function setStoreRepository(nextRepository: StoreRepository | undefined) {
  repositoryGlobal.__wechatLiveStoreRepository = nextRepository;
}

export function isPgStorageEnabled() {
  return ["true", "enabled"].includes(process.env.DATABASE_STORAGE?.trim().toLowerCase() ?? "");
}
