import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Read by RolesGuard. Apply together with @UseGuards(RolesGuard), at class or handler level.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
