import { SetMetadata } from '@nestjs/common';
import { Role } from '@ezihubb/constants';

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
