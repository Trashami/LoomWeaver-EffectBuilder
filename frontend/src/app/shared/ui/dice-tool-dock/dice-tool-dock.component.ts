import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NgpButton } from 'ng-primitives/button';
import { DiceForgeToolId } from '../../../features/dice/engine/dice-physics.types';
import { LwIconComponent } from '../icon/icon.component';

export interface DiceForgeDockToolItem {
  readonly id: DiceForgeToolId;
  readonly label: string;
  readonly icon: string;
  readonly hint: string;
}

export const DICE_FORGE_DOCK_TOOLS: readonly DiceForgeDockToolItem[] = [
  {
    id: 'skin',
    label: 'Dice Skin',
    icon: 'cube',
    hint: '3D Polyhedral Model, Surface Texture & Bump Map Relief'
  },
  {
    id: 'core',
    label: 'Core Color',
    icon: 'pipette',
    hint: 'Core Pigment, Transparency, Inner/Outer Glow & Pulse FX'
  },
  {
    id: 'font',
    label: 'Dice Font',
    icon: 'note',
    hint: 'Typeface Family, Weight, Scale, Stroke & Drop Shadow'
  },
  {
    id: 'numbers',
    label: 'Numbers',
    icon: 'filter',
    hint: 'Numbering Depth, Inlay Color, Glow, Pulse & Face Frame'
  },
  {
    id: 'effects',
    label: 'Dice FX',
    icon: 'zap',
    hint: 'Scene Bloom, Rim Fresnel, Vein Heartbeat & Roll Audio'
  },
  {
    id: 'physics',
    label: 'Physics',
    icon: 'compass',
    hint: 'Gravity, Throw Force, Height, Air/Floor Resistance, Spin, Boundary & Camera'
  },
  {
    id: 'crit',
    label: 'Crit FX',
    icon: 'swords',
    hint: 'Natural 20 & Critical Fail Shaders, Particle Bursts & Previews'
  },
  {
    id: 'market',
    label: 'Saved',
    icon: 'store',
    hint: 'Saved User Dice Sets, Marketplace Publishing & Community Imports'
  }
];

@Component({
  selector: 'lw-dice-tool-dock',
  standalone: true,
  imports: [NgpButton, LwIconComponent],
  templateUrl: './dice-tool-dock.component.html',
  styleUrl: './dice-tool-dock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LwDiceToolDockComponent {
  readonly activeToolId = input<DiceForgeToolId>('skin');
  readonly tools = input<readonly DiceForgeDockToolItem[]>(DICE_FORGE_DOCK_TOOLS);

  readonly toolSelected = output<DiceForgeToolId>();
  readonly collapseRequested = output<void>();
}
