export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DATABASE_STORAGE !== "enabled") return;

  const [{ PrismaStoreRepository }, { setStoreRepository }] = await Promise.all([
    import("@/lib/store-repository-prisma"),
    import("@/lib/store-repository"),
  ]);
  const repository = new PrismaStoreRepository();
  await repository.initFromPostgres();
  setStoreRepository(repository);
}
