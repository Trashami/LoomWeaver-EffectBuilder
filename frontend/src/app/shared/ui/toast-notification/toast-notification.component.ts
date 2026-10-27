import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { LwIconComponent } from '../icon/icon.component';

export type LwToastVariant = 'emerald' | 'gold' | 'info' | 'danger';
export type LwToastPosition = 'bottom-right' | 'top-right' | 'bottom-left' | 'top-center';

@Component({
  selector: 'lw-toast-notification',
  standalone: true,
  imports: [LwIconComponent],
  templateUrl: './toast-notification.component.html',
  styleUrl: './toast-notification.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LwToastNotificationComponent implements OnDestroy {
  readonly message = input<string>('');
  readonly title = input<string>('');
  readonly variant = input<LwToastVariant>('emerald');
  readonly position = input<LwToastPosition>('bottom-right');
  readonly durationMs = input<number>(3200);
  readonly autoHide = input<boolean>(true);
  readonly showProgress = input<boolean>(true);
  readonly dismissible = input<boolean>(true);
  readonly maxWidth = input<string>('380px');

  readonly dismissed = output<void>();

  readonly visible = signal<boolean>(false);
  readonly animKey = signal<number>(0);
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const msg = this.message().trim();
      const dur = this.durationMs();
      const auto = this.autoHide();

      this.clearTimer();
      if (!msg) {
        this.visible.set(false);
        return;
      }

      this.visible.set(true);
      this.animKey.update((k) => k + 1);

      if (auto && dur > 0) {
        this.hideTimer = setTimeout(() => {
          this.dismiss();
        }, dur);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  dismiss(): void {
    this.clearTimer();
    this.visible.set(false);
    this.dismissed.emit();
  }

  private clearTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
}
