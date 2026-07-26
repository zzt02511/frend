export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ PrismaStoreRepository }, { isPgStorageEnabled, setStoreRepository }] = await Promise.all([
    import("@/lib/store-repository-prisma"),
    import("@/lib/store-repository"),
  ]);
  if (!isPgStorageEnabled()) return;
  const repository = new PrismaStoreRepository();
  await repository.initFromPostgres();
  setStoreRepository(repository);
}
