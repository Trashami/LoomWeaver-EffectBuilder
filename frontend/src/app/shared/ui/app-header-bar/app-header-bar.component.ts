import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgpButton } from 'ng-primitives/button';
import { NgpInput } from 'ng-primitives/input';
import { NgpToolbar } from 'ng-primitives/toolbar';
import { CampaignVm, ViewerRole } from '../../../core/models/loomweaver.models';
import { LwExperienceMode } from '../../../core/services/loomweaver-store.service';
import { LwIconComponent } from '../icon/icon.component';
import { LwUserMenuComponent } from '../user-menu/user-menu.component';

@Component({
  selector: 'lw-app-header-bar',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    NgpButton,
    NgpInput,
    NgpToolbar,
    LwIconComponent,
    LwUserMenuComponent,
  ],
  templateUrl: './app-header-bar.component.html',
  styleUrl: './app-header-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LwAppHeaderBarComponent {
  readonly variant = input<'studio' | 'public'>('studio');
  readonly campaigns = input<readonly CampaignVm[]>([]);
  readonly activeCampaign = input<CampaignVm | null>(null);
  readonly activeCampaignId = input<number>(0);
  readonly viewerRole = input<ViewerRole>('gm');
  readonly isCampaignGm = input<boolean>(true);
  readonly audioPlaying = input<boolean>(false);
  readonly quickRollBanner = input<string>('1d20 Ready');
  readonly loomOpen = input<boolean>(false);
  readonly userDisplayName = input<string>('Dungeon Master');
  readonly userEmail = input<string>('gm@loom-weaver.com');
  readonly userTierCode = input<string>('weaver');
  readonly generativeAiEnabled = input<boolean>(false);
  readonly hideAiContent = input<boolean>(true);
  readonly experienceMode = input<LwExperienceMode>('advanced');
  readonly navCollapsed = input<boolean>(false);
  readonly collapseIcon = input<'apps' | 'menu'>('apps');

  // Component dimension properties (width/height + min/max)
  readonly width = input<string>('100%');
  readonly minWidth = input<string>('0');
  readonly maxWidth = input<string>('100%');
  readonly height = input<string>('62px');
  readonly minHeight = input<string>('62px');
  readonly maxHeight = input<string>('62px');

  // Logo customization properties (border + width/height + min/max, 100px wider default: 136px)
  readonly logoSrc = input<string>('/landing-assets/brand/logo-wordmark.png');
  readonly logoAlt = input<string>('LoomWeaver Crest');
  readonly logoShowBorder = input<boolean>(false);
  readonly logoBorder = input<string>('none');
  readonly logoWidth = input<string>('136px');
  readonly logoMinWidth = input<string>('136px');
  readonly logoMaxWidth = input<string>('180px');
  readonly logoHeight = input<string>('42px');
  readonly logoMinHeight = input<string>('32px');
  readonly logoMaxHeight = input<string>('54px');

  readonly searchText = model<string>('');

  readonly navToggleRequested = output<void>();
  readonly campaignSelected = output<number>();
  readonly searchSubmitted = output<string>();
  readonly audioToggled = output<void>();
  readonly quickRollRequested = output<void>();
  readonly viewerRoleToggled = output<void>();
  readonly loomToggled = output<void>();
  readonly generativeAiToggled = output<boolean>();
  readonly hideAiContentToggled = output<boolean>();
  readonly experienceModeChanged = output<LwExperienceMode>();
  readonly syncProfileRequested = output<void>();
  readonly logoutRequested = output<void>();

  onSubmitSearch(): void {
    this.searchSubmitted.emit(this.searchText().trim());
  }
}
