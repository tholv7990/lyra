import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { UsersService } from './users.service';
import { AdminService } from '../admin/admin.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  // AdminService (stateless, reads the global ConfigModule) is provided here so
  // toSafeUser can stamp isAdmin. Provided directly rather than via AdminModule
  // to avoid a dependency cycle (AdminModule -> MarketplaceModule -> ... ->
  // UsersModule). It is the same allowlist logic the AdminGuard uses.
  providers: [UsersService, AdminService],
  exports: [UsersService],
})
export class UsersModule {}
