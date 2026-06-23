import { Injectable } from '@nestjs/common';
import { ActionType } from '@lyra/shared';
import { BrandActionProvider } from './brand.action';
import { UnitEconAction } from './unit-econ.action';
import { EvaluateAction } from './evaluate.action';
import { SaveProductAction } from './save-product.action';
import { DemandGateAction } from './demand-gate.action';
import type { ActionProvider } from './action-provider.interface';

@Injectable()
export class ActionRegistry {
  private readonly impls: Partial<Record<ActionType, ActionProvider>>;

  constructor(brand: BrandActionProvider, unitEcon: UnitEconAction, evaluate: EvaluateAction, saveProduct: SaveProductAction, demandGate: DemandGateAction) {
    this.impls = {
      [ActionType.Brand]: brand,
      [ActionType.UnitEcon]: unitEcon,
      [ActionType.Evaluate]: evaluate,
      [ActionType.SaveProduct]: saveProduct,
      [ActionType.DemandGate]: demandGate,
    }; // Crawl/Publish added in later phases
  }

  get(type: ActionType): ActionProvider {
    const impl = this.impls[type];
    if (!impl) throw new Error(`No action provider for '${type}'`);
    return impl;
  }
}
