import { Body, Controller, Post } from '@nestjs/common';
import type { User, UserRequest } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestsService } from './requests.service';
import { CreateRequestBody } from './dto/requests.dto';

// Any signed-in user can submit a request (the global JwtAuthGuard authenticates).
// Not workspace-scoped — a platform request isn't owned by one workspace.
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  create(@Body() body: CreateRequestBody, @CurrentUser() user: User): Promise<UserRequest> {
    return this.requests.create(user.id, body);
  }
}
