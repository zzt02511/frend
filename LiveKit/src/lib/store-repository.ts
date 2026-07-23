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

let repository: StoreRepository | undefined;

export function getStoreRepository() {
  if (!repository) {
    if (isPgStorageEnabled()) throw new Error("POSTGRES_REPOSITORY_NOT_INITIALIZED");
    repository = new JsonStoreRepository();
  }
  return repository;
}

export function setStoreRepository(nextRepository: StoreRepository | undefined) {
  repository = nextRepository;
}

export function isPgStorageEnabled() {
  return process.env.DATABASE_STORAGE === "enabled";
}
