import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TaskStatus,
  type CreateTaskDto,
  type UpdateTaskDto,
  type Task as TaskView,
} from '@lyra/shared';
import { Task, TaskDocument } from './task.schema';
import { UsersService } from '../users/users.service';
import { MembershipsService } from '../workspaces/memberships.service';
import { toTaskView } from './task.views';

const MAX_NAME = 120;
const MAX_DESC = 2000;

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly model: Model<Task>,
    private readonly users: UsersService,
    private readonly memberships: MembershipsService,
  ) {}

  async list(projectId: string): Promise<TaskView[]> {
    const docs = await this.model
      .find({ projectId, active: { $ne: false } })
      .sort({ createdAt: -1 })
      .exec();
    return this.toViews(docs);
  }

  async create(
    projectId: string,
    workspaceId: string,
    actorId: string,
    dto: CreateTaskDto,
  ): Promise<TaskView> {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('A task name is required.');
    if (dto.assigneeId) {
      const member = await this.memberships.findFor(workspaceId, dto.assigneeId);
      if (!member) throw new BadRequestException('Assignee must be a member of the workspace.');
    }
    const doc = await this.model.create({
      workspaceId,
      projectId,
      name: name.slice(0, MAX_NAME),
      description: (dto.description ?? '').trim().slice(0, MAX_DESC),
      status: dto.status ?? TaskStatus.New,
      ...(dto.priority ? { priority: dto.priority } : {}),
      ...(dto.assigneeId ? { assigneeId: dto.assigneeId } : {}),
      tags: dto.tags ?? [],
      pipelines: dto.pipelines ?? [],
      createdBy: actorId,
      updatedBy: actorId,
    });
    return this.toView(doc);
  }

  async get(id: string): Promise<TaskView> {
    const doc = await this.model.findOne({ _id: id, active: { $ne: false } }).exec();
    if (!doc) throw new NotFoundException('Task not found.');
    return this.toView(doc);
  }

  // Raw document for internal callers (e.g. the run controller validating that a
  // pipeline belongs to the task). Returns null when missing/soft-deleted.
  findActiveById(id: string) {
    return this.model.findOne({ _id: id, active: { $ne: false } }).exec();
  }

  async update(id: string, actorId: string, dto: UpdateTaskDto): Promise<TaskView> {
    const set: Record<string, unknown> = { updatedBy: actorId };
    const unset: Record<string, ''> = {};

    if (dto.name !== undefined) set.name = dto.name.trim().slice(0, MAX_NAME);
    if (dto.description !== undefined) set.description = dto.description.trim().slice(0, MAX_DESC);
    if (dto.status !== undefined) set.status = dto.status;
    if (dto.priority !== undefined) set.priority = dto.priority;
    if (dto.pipelines !== undefined) set.pipelines = dto.pipelines;
    if (dto.tags !== undefined) set.tags = dto.tags;

    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId) {
        const current = await this.model.findOne({ _id: id, active: { $ne: false } }).exec();
        if (!current) throw new NotFoundException('Task not found.');
        const member = await this.memberships.findFor(current.workspaceId, dto.assigneeId);
        if (!member) throw new BadRequestException('Assignee must be a member of the workspace.');
        set.assigneeId = dto.assigneeId;
      } else {
        unset.assigneeId = ''; // null/'' → clear
      }
    }

    const update: Record<string, unknown> = { $set: set };
    if (Object.keys(unset).length) update.$unset = unset;

    const doc = await this.model
      .findOneAndUpdate({ _id: id, active: { $ne: false } }, update, { returnDocument: 'after' })
      .exec();
    if (!doc) throw new NotFoundException('Task not found.');
    return this.toView(doc);
  }

  async remove(id: string, actorId: string): Promise<void> {
    await this.model
      .findOneAndUpdate(
        { _id: id, active: { $ne: false } },
        { $set: { active: false, updatedBy: actorId } },
      )
      .exec();
    // ponytail: a task's runs are cascade soft-deleted once runs carry taskId (Task 3).
  }

  private async toView(doc: TaskDocument): Promise<TaskView> {
    const refs = await this.users.refMap([doc.createdBy, doc.updatedBy, doc.assigneeId]);
    return toTaskView(doc, refs);
  }

  private async toViews(docs: TaskDocument[]): Promise<TaskView[]> {
    const refs = await this.users.refMap(
      docs.flatMap((d) => [d.createdBy, d.updatedBy, d.assigneeId]),
    );
    return docs.map((d) => toTaskView(d, refs));
  }
}
