import { PrismaClient, Role } from '@prisma/client';

// Grants or revokes the in-app admin role. Run manually by the owner; there is no UI or API
// for this on purpose:
//   cd apps/api && pnpm exec ts-node scripts/set-user-role.ts <email> <user|admin>

// A structural subset of PrismaClient, so tests can pass a plain mock with just `user`.
export type SetUserRolePrismaClient = Pick<PrismaClient, 'user'>;

export const SET_USER_ROLE_USAGE = 'Usage: set-user-role.ts <email> <user|admin>';

const VALID_ROLES: readonly Role[] = ['user', 'admin'];

function isRole(value: string): value is Role {
  return (VALID_ROLES as readonly string[]).includes(value);
}

export function parseSetUserRoleArgs(argv: string[]): { email: string; role: Role } {
  if (argv.length !== 2) {
    throw new Error(SET_USER_ROLE_USAGE);
  }
  const email = argv[0].trim();
  const role = argv[1];
  if (email === '') {
    throw new Error(SET_USER_ROLE_USAGE);
  }
  if (!isRole(role)) {
    throw new Error(`Invalid role "${role}". Expected one of: ${VALID_ROLES.join(', ')}`);
  }
  return { email, role };
}

export async function setUserRole(
  prisma: SetUserRolePrismaClient,
  email: string,
  role: Role,
): Promise<{ found: false } | { found: true; previousRole: Role; role: Role }> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!user) {
    return { found: false };
  }
  await prisma.user.update({ where: { id: user.id }, data: { role } });
  return { found: true, previousRole: user.role, role };
}

async function main(): Promise<void> {
  let args: { email: string; role: Role };
  try {
    args = parseSetUserRoleArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const result = await setUserRole(prisma, args.email, args.role);
    if (!result.found) {
      console.error(`No user found with email ${args.email}`);
      process.exitCode = 1;
      return;
    }
    console.log(`${args.email}: ${result.previousRole} -> ${result.role}`);
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
