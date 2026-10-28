import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild
} from '@angular/core';
import { FullscreenDiceOverlayService } from '../../../features/dice/engine/fullscreen-dice-overlay.service';

@Component({
  selector: 'lw-fullscreen-dice-overlay',
  standalone: true,
  templateUrl: './fullscreen-dice-overlay.component.html',
  styleUrl: './fullscreen-dice-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LwFullscreenDiceOverlayComponent implements AfterViewInit {
  readonly overlay = inject(FullscreenDiceOverlayService);
  private readonly diceCanvas = viewChild<ElementRef<HTMLCanvasElement>>('fullscreenDiceCanvas');

  ngAfterViewInit(): void {
    const canvasEl = this.diceCanvas()?.nativeElement;
    if (canvasEl) {
      this.overlay.registerOverlayCanvas(canvasEl);
    }
  }

  onBackdropClick(): void {
    const phase = this.overlay.overlayPhase();
    if (phase === 'settled' || phase === 'fading') {
      this.overlay.clearResultsNow();
    }
  }
}
