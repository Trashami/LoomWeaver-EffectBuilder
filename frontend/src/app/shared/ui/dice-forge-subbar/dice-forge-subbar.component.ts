import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  output,
  signal,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgpButton } from 'ng-primitives/button';
import { renderSelectedDiceTexturePreview } from '../../../features/dice/engine/materials/face-overlays.drawer';
import { DicePolyhedronType } from '../../../features/dice/engine/models/dice-model.types';
import {
  DiceCustomRuntimeConfig,
  DiceSkinConfig,
  SavedUserDicePreset
} from '../../../features/dice/engine/skins/dice-skin.types';
import { LwIconComponent } from '../icon/icon.component';

@Component({
  selector: 'lw-dice-forge-subbar',
  standalone: true,
  imports: [FormsModule, NgpButton, LwIconComponent],
  templateUrl: './dice-forge-subbar.component.html',
  styleUrl: './dice-forge-subbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LwDiceForgeSubbarComponent implements AfterViewInit {
  @ViewChild('textureCanvas') textureCanvas?: ElementRef<HTMLCanvasElement>;

  readonly customConfig = input.required<DiceCustomRuntimeConfig>();
  readonly activeSkin = input.required<DiceSkinConfig>();
  readonly savedPresets = input<readonly SavedUserDicePreset[]>([]);
  readonly activePresetId = input<string>('');
  readonly focusDie = input<DicePolyhedronType | 'all'>('d20');
  readonly rightCollapsed = input<boolean>(false);

  readonly customNameChanged = output<string>();
  readonly presetSelected = output<SavedUserDicePreset>();
  readonly focusDieSelected = output<DicePolyhedronType | 'all'>();
  readonly resetCameraRequested = output<void>();
  readonly savePresetRequested = output<void>();
  readonly saveAsNewRequested = output<void>();
  readonly publishToMarketRequested = output<void>();
  readonly openMarketModalRequested = output<void>();
  readonly toggleRightDock = output<void>();

  readonly editingName = signal<boolean>(false);
  readonly dieFocusOptions: ReadonlyArray<DicePolyhedronType | 'all'> = [
    'all',
    'd20',
    'd12',
    'd10',
    'd100',
    'd8',
    'd6',
    'd4'
  ];

  constructor() {
    effect(() => {
      const skin = this.activeSkin();
      const cfg = this.customConfig();
      const canvas = this.textureCanvas?.nativeElement;
      if (canvas && skin && cfg) {
        renderSelectedDiceTexturePreview(canvas, skin, cfg);
      }
    });
  }

  ngAfterViewInit(): void {
    const canvas = this.textureCanvas?.nativeElement;
    if (canvas) {
      renderSelectedDiceTexturePreview(canvas, this.activeSkin(), this.customConfig());
    }
  }

  toggleNameEdit(): void {
    this.editingName.set(!this.editingName());
  }
}
