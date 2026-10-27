import { LwPanelComponent } from './panel/panel.component';

export * from './public-api';
export { LwPanelComponent as LwCardComponent, LwPanelComponent as LwStatCardComponent };

export interface DiceRollFormulaRequest {
  expression?: string;
  sides?: number;
  count?: number;
  modifier?: number;
  advantageMode?: string;
  rollMode?: string;
  label: string;
}

export interface DiceRollLedgerItem {
  id: string;
  label: string;
  expression: string;
  diceResults: number[];
  modifier: number;
  total: number;
  isCriticalSuccess: boolean;
  isCriticalFailure: boolean;
  sha256Hash: string;
  rolledAt: string;
}
