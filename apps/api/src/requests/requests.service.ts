import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RequestStatus,
  RequestType,
  Role,
  WorkspaceType,
  type CreateRequestDto,
  type UpdateRequestStatusDto,
  type UserRequest as UserRequestView,
} from '@lyra/shared';
import { UserRequest, UserRequestDocument } from './user-request.schema';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { MembershipsService } from '../workspaces/memberships.service';
import { subjectKey, toUserRequestView } from './request.views';

const MAX_SUBJECT = 120;
const MAX_BODY = 2000;
// Requests are low-volume; the admin list returns the most recent N. Bump to a
// paged query if it ever overflows. ponytail: hard cap, paginate if it grows.
const LIST_LIMIT = 200;

@Injectable()
export class RequestsService {
  constructor(
    @InjectModel(UserRequest.name) private readonly model: Model<UserRequest>,
    private readonly users: UsersService,
    private readonly workspaces: WorkspacesService,
    private readonly memberships: MembershipsService,
  ) {}

  async create(actorId: string, dto: CreateRequestDto, workspaceId?: string): Promise<UserRequestView> {
    const subject = dto.subject?.trim();
    if (!subject) throw new BadRequestException('A subject is required.');

    if (dto.type === RequestType.TeamUpgrade) {
      if (!dto.workspaceId) throw new BadRequestException('workspaceId is required for a team-upgrade request');
      const ws = await this.workspaces.findById(dto.workspaceId);
      if (!ws) throw new NotFoundException('Workspace not found');
      if (ws.type !== WorkspaceType.Personal) {
        throw new BadRequestException('Only a personal workspace can request a team upgrade');
      }
      const membership = await this.memberships.findFor(dto.workspaceId, actorId);
      if (membership?.role !== Role.Owner) {
        throw new ForbiddenException('Only the workspace owner can request an upgrade');
      }
      const existing = await this.model.findOne({
        type: RequestType.TeamUpgrade,
        workspaceId: dto.workspaceId,
        status: RequestStatus.Open,
        active: { $ne: false },
      }).exec();
      if (existing) throw new BadRequestException('An upgrade request is already pending for this workspace');
    }

    const doc = await this.model.create({
      type: dto.type,
      subject: subject.slice(0, MAX_SUBJECT),
      subjectKey: subjectKey(subject),
      body: (dto.body ?? '').trim().slice(0, MAX_BODY),
      status: RequestStatus.Open,
      workspaceId: dto.workspaceId ?? workspaceId,
      voters: [actorId],
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.toView(doc);
  }

  async listForAdmin(filter: { type?: RequestType; status?: RequestStatus }): Promise<UserRequestView[]> {
    const q: Record<string, unknown> = { active: { $ne: false } };
    if (filter.type) q.type = filter.type;
    if (filter.status) q.status = filter.status;
    const docs = await this.model.find(q).sort({ createdAt: -1 }).limit(LIST_LIMIT).exec();
    return this.toViews(docs);
  }

  async updateStatus(id: string, dto: UpdateRequestStatusDto, actorId: string): Promise<UserRequestView> {
    const doc = await this.model
      .findByIdAndUpdate(
        id,
        { $set: { status: dto.status, adminNote: dto.adminNote, updatedBy: actorId } },
        { returnDocument: 'after' },
      )
      .exec();
    if (!doc) throw new NotFoundException('Request not found.');
    // Side effect: when a team-upgrade request is approved, flip the workspace.
    if (doc.type === RequestType.TeamUpgrade && dto.status === RequestStatus.Resolved && doc.workspaceId) {
      await this.workspaces.upgradeToTeam(doc.workspaceId, actorId);
    }
    return this.toView(doc);
  }

  private async toView(doc: UserRequestDocument): Promise<UserRequestView> {
    const refs = await this.users.refMap([doc.createdBy, doc.updatedBy]);
    return toUserRequestView(doc, refs);
  }

  private async toViews(docs: UserRequestDocument[]): Promise<UserRequestView[]> {
    const refs = await this.users.refMap(docs.flatMap((d) => [d.createdBy, d.updatedBy]));
    return docs.map((d) => toUserRequestView(d, refs));
  }
}
