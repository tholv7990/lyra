import { Injectable } from '@nestjs/common';
import { ActionType } from '@lyra/shared';
import { BrandActionProvider } from './brand.action';
import { UnitEconAction } from './unit-econ.action';
import { EvaluateAction } from './evaluate.action';
import { SaveProductAction } from './save-product.action';
import { DemandGateAction } from './demand-gate.action';
import { ScoreAction } from './score.action';
import { ResolveInputsAction } from './resolve-inputs.action';
import { CompetitionAction } from './competition.action';
import { RiskScreenAction } from './risk-screen.action';
import { CustomerJobAction } from './customer-job.action';
import { ReviewMiningAction } from './review-mining.action';
import { CreativePotentialAction } from './creative-potential.action';
import { SupplyChainAction } from './supply-chain.action';
import type { ActionProvider } from './action-provider.interface';

@Injectable()
export class ActionRegistry {
  private readonly impls: Partial<Record<ActionType, ActionProvider>>;

  constructor(brand: BrandActionProvider, unitEcon: UnitEconAction, evaluate: EvaluateAction, saveProduct: SaveProductAction, demandGate: DemandGateAction, score: ScoreAction, resolveInputs: ResolveInputsAction, competition: CompetitionAction, riskScreen: RiskScreenAction, customerJob: CustomerJobAction, reviewMining: ReviewMiningAction, creativePotential: CreativePotentialAction, supplyChain: SupplyChainAction) {
    this.impls = {
      [ActionType.Brand]: brand,
      [ActionType.UnitEcon]: unitEcon,
      [ActionType.Evaluate]: evaluate,
      [ActionType.SaveProduct]: saveProduct,
      [ActionType.DemandGate]: demandGate,
      [ActionType.Score]: score,
      [ActionType.ResolveInputs]: resolveInputs,
      [ActionType.Competition]: competition,
      [ActionType.RiskScreen]: riskScreen,
      [ActionType.CustomerJob]: customerJob,
      [ActionType.ReviewMining]: reviewMining,
      [ActionType.CreativePotential]: creativePotential,
      [ActionType.SupplyChain]: supplyChain,
    }; // Crawl/Publish added in later phases
  }

  get(type: ActionType): ActionProvider {
    const impl = this.impls[type];
    if (!impl) throw new Error(`No action provider for '${type}'`);
    return impl;
  }
}
