import { Module } from '@nestjs/common';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, AddressesController, AdminUsersController],
  providers: [UsersService, AddressesService, AdminUsersService],
  exports: [AddressesService],
})
export class UsersModule {}
