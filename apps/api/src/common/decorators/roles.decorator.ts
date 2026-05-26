import { SetMetadata } from '@nestjs/common';
import { Role } from '@mlh/constants';

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
