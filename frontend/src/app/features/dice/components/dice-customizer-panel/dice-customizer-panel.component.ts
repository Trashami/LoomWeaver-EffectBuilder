import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  LwBadgeComponent,
  LwButtonComponent,
  LwPanelComponent
} from '../../../../shared/ui/public-api';
import { DiceSoundProfile } from '../../engine/audio';
import { DiceCritEffectPreset } from '../../engine/effects';
import { DiceModelDefinition, DiceSizePreset } from '../../engine/models';
import { DiceCustomRuntimeConfig } from '../../engine/skins';

@Component({
  selector: 'lw-dice-customizer-panel',
  standalone: true,
  imports: [
    CommonModule,
    LwPanelComponent,
    LwButtonComponent,
    LwBadgeComponent
  ],
  templateUrl: './dice-customizer-panel.component.html',
  styleUrl: './dice-customizer-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiceCustomizerPanelComponent {
  readonly customConfig = input.required<DiceCustomRuntimeConfig>();
  readonly models = input.required<DiceModelDefinition[]>();
  readonly unlockedModelIds = input.required<string[]>();
  readonly nat20Effects = input.required<DiceCritEffectPreset[]>();
  readonly critFailEffects = input.required<DiceCritEffectPreset[]>();
  readonly soundProfiles = input.required<DiceSoundProfile[]>();
  readonly soundVolume = input<number>(0.78);
  readonly soundMuted = input<boolean>(false);

  readonly configChange = output<Partial<DiceCustomRuntimeConfig>>();
  readonly unlockModelRequest = output<DiceModelDefinition>();
  readonly previewCritEffect = output<'nat20' | 'critfail'>();
  readonly testSoundRequest = output<string>();
  readonly volumeChange = output<number>();
  readonly muteToggle = output<void>();
  readonly resetToSkinDefault = output<void>();
  readonly saveLoadoutRequest = output<void>();

  readonly sizePresets: { id: DiceSizePreset; label: string; scaleNote: string }[] = [
    { id: 'small', label: 'Small', scaleNote: '0.78x Compact' },
    { id: 'medium', label: 'Medium', scaleNote: '1.00x Standard' },
    { id: 'large', label: 'Large', scaleNote: '1.26x Heavy' }
  ];

  readonly quickCoreSwatches = [
    '#14131a', '#0f3828', '#1b3f5e', '#2b2f36',
    '#241710', '#1f090d', '#2d2112', '#0b0718'
  ];

  readonly quickNumberSwatches = [
    '#ffd978', '#49e892', '#63d2ff', '#ffd6de',
    '#f1dbff', '#ffffff', '#ffb340', '#ff3b5c'
  ];

  isModelUnlocked(modelId: string): boolean {
    return this.unlockedModelIds().includes(modelId);
  }

  selectSize(sizePreset: DiceSizePreset): void {
    this.configChange.emit({ sizePreset });
  }

  selectModel(model: DiceModelDefinition): void {
    if (!this.isModelUnlocked(model.id)) {
      this.unlockModelRequest.emit(model);
      return;
    }
    this.configChange.emit({ modelId: model.id });
  }

  updateColor(
    field: 'coreColorHex' | 'numberColorHex' | 'glowColorHex',
    value: string
  ): void {
    this.configChange.emit({ [field]: value });
  }

  updateRange(
    field: 'glowIntensity' | 'reflectionMetallic' | 'surfaceRoughness',
    event: Event
  ): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    if (!Number.isNaN(val)) {
      this.configChange.emit({ [field]: val });
    }
  }

  toggleBoolean(field: 'recessedNumbers' | 'veinPulse', value: boolean): void {
    this.configChange.emit({ [field]: value });
  }

  selectNat20Effect(event: Event): void {
    const nat20EffectId = (event.target as HTMLSelectElement).value;
    this.configChange.emit({ nat20EffectId });
  }

  selectCritFailEffect(event: Event): void {
    const critFailEffectId = (event.target as HTMLSelectElement).value;
    this.configChange.emit({ critFailEffectId });
  }

  selectSoundProfile(event: Event): void {
    const soundProfileId = (event.target as HTMLSelectElement).value;
    this.configChange.emit({ soundProfileId });
    this.testSoundRequest.emit(soundProfileId);
  }

  onVolumeSlider(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    if (!Number.isNaN(val)) {
      this.volumeChange.emit(val);
    }
  }
}
