type DatabaseEnvironment = {
  [key: string]: string | undefined;
  DATABASE_URL?: string;
  POSTGRES_PRISMA_URL?: string;
};

function nonEmpty(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function resolveApplicationDatabaseUrl(
  environment: DatabaseEnvironment = process.env,
) {
  return (
    nonEmpty(environment.DATABASE_URL) ??
    nonEmpty(environment.POSTGRES_PRISMA_URL)
  );
}
