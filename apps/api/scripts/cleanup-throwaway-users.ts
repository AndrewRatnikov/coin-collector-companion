import { PrismaClient } from '@prisma/client';

// A structural subset of PrismaClient -- lets tests pass a plain mock object with
// only these four properties instead of a full PrismaClient (and no `as any` cast).
export type CleanupPrismaClient = Pick<PrismaClient, 'user' | 'userSet' | 'userSetCoin' | 'ownership'>;

export function parseEmailArgs(argv: string[]): string[] {
  if (argv.length === 0) {
    throw new Error('Usage: cleanup-throwaway-users.ts <email> [email...]');
  }
  return Array.from(new Set(argv.map((email) => email.trim())));
}

export async function deleteUserCascade(
  prisma: CleanupPrismaClient,
  email: string,
): Promise<{ found: boolean; deletedOwnerships: number; deletedSetCoins: number; deletedSets: number }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { found: false, deletedOwnerships: 0, deletedSetCoins: 0, deletedSets: 0 };
  }

  const ownershipResult = await prisma.ownership.deleteMany({ where: { userId: user.id } });

  const userSets = await prisma.userSet.findMany({ where: { userId: user.id } });
  const userSetIds = userSets.map((userSet) => userSet.id);
  const setCoinResult = await prisma.userSetCoin.deleteMany({
    where: { userSetId: { in: userSetIds } },
  });

  const setResult = await prisma.userSet.deleteMany({ where: { userId: user.id } });

  await prisma.user.delete({ where: { id: user.id } });

  return {
    found: true,
    deletedOwnerships: ownershipResult.count,
    deletedSetCoins: setCoinResult.count,
    deletedSets: setResult.count,
  };
}

async function main(): Promise<void> {
  const emails = parseEmailArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const countAll = async () => ({
      user: await prisma.user.count(),
      userSet: await prisma.userSet.count(),
      userSetCoin: await prisma.userSetCoin.count(),
      ownership: await prisma.ownership.count(),
    });

    console.log('Row counts before cleanup:', await countAll());

    for (const email of emails) {
      const result = await deleteUserCascade(prisma, email);
      if (!result.found) {
        console.log(`${email}: not found, skipped`);
        continue;
      }
      console.log(
        `${email}: deleted ${result.deletedOwnerships} ownership(s), ${result.deletedSetCoins} set-coin(s), ${result.deletedSets} set(s), and the user row`,
      );
    }

    console.log('Row counts after cleanup:', await countAll());
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
