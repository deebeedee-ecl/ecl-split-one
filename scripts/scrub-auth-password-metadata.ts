import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const before = await prisma.$queryRaw<{ id: string; email: string }[]>`
    select id, email
    from auth.users
    where
      raw_user_meta_data ? 'password'
      or raw_user_meta_data #> '{ecl_profile,password}' is not null
    order by created_at desc
  `;

  const updated = await prisma.$executeRaw`
    update auth.users
    set raw_user_meta_data = (raw_user_meta_data - 'password') #- '{ecl_profile,password}'
    where
      raw_user_meta_data ? 'password'
      or raw_user_meta_data #> '{ecl_profile,password}' is not null
  `;

  const after = await prisma.$queryRaw<{ count: bigint }[]>`
    select count(*)::bigint as count
    from auth.users
    where
      raw_user_meta_data ? 'password'
      or raw_user_meta_data #> '{ecl_profile,password}' is not null
  `;

  console.log(
    JSON.stringify(
      {
        matchedBefore: before.length,
        updated,
        remaining: Number(after[0]?.count ?? 0),
        users: before.map((user) => ({ id: user.id, email: user.email })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
