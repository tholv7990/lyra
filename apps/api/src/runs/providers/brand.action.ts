import { Injectable } from '@nestjs/common';
import { ActionType } from '@lyra/shared';
import { RenderClient } from './render.client';
import type { ActionProvider, ActionRunContext } from './action-provider.interface';
import type { StepRunOutput } from './step-provider.interface';

@Injectable()
export class BrandActionProvider implements ActionProvider {
  constructor(private readonly render: RenderClient) {}

  async execute(ctx: ActionRunContext): Promise<StepRunOutput> {
    if (ctx.action.type !== ActionType.Brand) throw new Error('not a brand action');
    const logoUrl = ctx.brandKit?.logoUrl;
    if (!logoUrl) throw new Error('Project has no brand logo — set one in the project Brand section.');
    const imageUrl = ctx.step.prompt.trim(); // {input} resolved to the prior image URL
    if (!imageUrl) throw new Error('Brand step has no input image.');
    const res = await this.render.renderImage({
      imageUrl,
      logoUrl,
      position: ctx.action.position,
      size: ctx.action.size,
    });
    return { result: res.url, assets: [{ type: 'image', url: res.url }] };
  }
}
