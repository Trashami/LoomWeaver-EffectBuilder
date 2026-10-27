import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgpButton } from 'ng-primitives/button';
import {
  CharacterRichNoteVm,
  LwNoteCategory,
  LwNoteMentionTagVm,
  LwNoteVisibility,
} from '../../../features/characters/models/character-studio.models';
import { LwButtonComponent } from '../button/button.component';
import { LwIconComponent } from '../icon/icon.component';

export interface LwNoteTypeOptionVm {
  readonly id: LwNoteCategory;
  readonly label: string;
  readonly description: string;
}

export interface LwNoteVisibilityOptionVm {
  readonly id: LwNoteVisibility;
  readonly label: string;
  readonly badge: string;
  readonly description: string;
}

@Component({
  selector: 'lw-note-composer-modal',
  standalone: true,
  imports: [FormsModule, NgpButton, LwButtonComponent, LwIconComponent],
  templateUrl: './note-composer-modal.component.html',
  styleUrl: './note-composer-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LwNoteComposerModalComponent {
  @ViewChild('editorSurface') editorSurface?: ElementRef<HTMLDivElement>;

  readonly open = model<boolean>(false);
  readonly defaultNoteType = input<LwNoteCategory>('character');
  readonly sourceEntityKey = input<string>('');
  readonly sourceEntityName = input<string>('');
  readonly defaultVisibility = input<LwNoteVisibility>('private');
  readonly authorUsername = input<string>('Adventurer');
  readonly mentionableEntities = input<readonly LwNoteMentionTagVm[]>([]);

  readonly noteSaved = output<CharacterRichNoteVm>();

  readonly noteTitle = signal<string>('');
  readonly selectedNoteType = signal<LwNoteCategory>('character');
  readonly selectedVisibility = signal<LwNoteVisibility>('private');
  readonly editorHtml = signal<string>('');
  readonly editorPlainText = signal<string>('');
  readonly taggedEntities = signal<readonly LwNoteMentionTagVm[]>([]);

  readonly mentionMenuOpen = signal<boolean>(false);
  readonly mentionQuery = signal<string>('');
  readonly activeMentionIndex = signal<number>(0);

  readonly noteTypes: readonly LwNoteTypeOptionVm[] = [
    { id: 'character', label: 'Character Journal', description: 'Personal reflections, goals, and arc notes' },
    { id: 'session', label: 'Session Chronicle', description: 'Key events, clues, and session recap notes' },
    { id: 'npc', label: 'NPC Dossier Note', description: 'Motives, quotes, and suspicions about an NPC' },
    { id: 'location', label: 'Place / Atlas Note', description: 'Landmarks, hazards, and secrets of a place' },
    { id: 'quest', label: 'Quest Investigation', description: 'Objectives, leads, and unresolved mysteries' },
    { id: 'lore', label: 'World Lore & History', description: 'Ancient history, Luminaries, and faction lore' },
    { id: 'combat', label: 'Tactical / Combat Note', description: 'Enemy weaknesses, spell synergies, and tactics' },
  ];

  readonly visibilityOptions: readonly LwNoteVisibilityOptionVm[] = [
    {
      id: 'private',
      label: 'Private',
      badge: 'Hidden from All',
      description: 'Only you can view or query this note in The Loom.',
    },
    {
      id: 'dm-only',
      label: 'DM Only',
      badge: 'Player + DM',
      description: 'Visible only to you and the Dungeon Master. Respected by The Loom.',
    },
    {
      id: 'global',
      label: 'Global (Campaign)',
      badge: 'Entire Party',
      description: 'Shared with everyone in the campaign and woven into shared Loom memory.',
    },
  ];

  readonly filteredMentions = computed<readonly LwNoteMentionTagVm[]>(() => {
    const q = this.mentionQuery().trim().toLowerCase();
    const all = this.mentionableEntities();
    if (!q) {
      return all.slice(0, 8);
    }
    return all
      .filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.entityType.toLowerCase().includes(q),
      )
      .slice(0, 8);
  });

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (isOpen) {
        this.selectedNoteType.set(this.defaultNoteType());
        this.selectedVisibility.set(this.defaultVisibility());
      }
    });
  }

  selectNoteType(noteType: LwNoteCategory): void {
    this.selectedNoteType.set(noteType);
  }

  selectVisibility(visibility: LwNoteVisibility): void {
    this.selectedVisibility.set(visibility);
  }

  applyFormat(command: string, value?: string): void {
    const surface = this.editorSurface?.nativeElement;
    if (!surface) {
      return;
    }
    surface.focus();
    document.execCommand(command, false, value);
    this.syncEditorState(surface);
  }

  triggerAtMentionPicker(): void {
    const surface = this.editorSurface?.nativeElement;
    if (surface) {
      surface.focus();
      document.execCommand('insertText', false, '@');
      this.syncEditorState(surface);
    }
    this.mentionQuery.set('');
    this.activeMentionIndex.set(0);
    this.mentionMenuOpen.set(true);
  }

  onEditorInput(event: Event): void {
    const surface = event.target as HTMLDivElement;
    this.syncEditorState(surface);
    this.detectAtMentionTrigger();
  }

  onEditorKeydown(event: KeyboardEvent): void {
    if (!this.mentionMenuOpen()) {
      return;
    }
    const candidates = this.filteredMentions();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeMentionIndex.update((i) => (candidates.length ? (i + 1) % candidates.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeMentionIndex.update((i) =>
        candidates.length ? (i - 1 + candidates.length) % candidates.length : 0,
      );
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      if (candidates.length > 0) {
        event.preventDefault();
        const chosen = candidates[this.activeMentionIndex()] ?? candidates[0];
        this.insertMentionEntity(chosen);
      }
    } else if (event.key === 'Escape') {
      this.mentionMenuOpen.set(false);
    }
  }

  insertMentionEntity(entity: LwNoteMentionTagVm): void {
    const surface = this.editorSurface?.nativeElement;
    if (surface) {
      const currentHtml = surface.innerHTML;
      const cleanedHtml = currentHtml.replace(/@([a-zA-Z0-9_\-\s]{0,28})$/, '');
      const pillHtml = `<span class="lw-mention-pill" data-composite-key="${entity.compositeKey}" data-entity-type="${entity.entityType}" contenteditable="false">@${entity.name}</span>&nbsp;`;
      surface.innerHTML = `${cleanedHtml}${pillHtml}`;
      this.syncEditorState(surface);
    }
    this.taggedEntities.update((prev) =>
      prev.some((e) => e.compositeKey === entity.compositeKey) ? prev : [...prev, entity],
    );
    this.mentionMenuOpen.set(false);
    this.mentionQuery.set('');
  }

  removeTaggedEntity(compositeKey: string): void {
    this.taggedEntities.update((prev) => prev.filter((e) => e.compositeKey !== compositeKey));
  }

  closeModal(): void {
    this.open.set(false);
    this.mentionMenuOpen.set(false);
  }

  saveNote(): void {
    const title = this.noteTitle().trim() || `${this.sourceEntityName() || 'Campaign'} Note`;
    const html = this.editorHtml().trim() || `<p>${this.editorPlainText().trim()}</p>`;
    const text = this.editorPlainText().trim();
    if (!text && !this.noteTitle().trim()) {
      return;
    }

    const richNote: CharacterRichNoteVm = {
      id: `note-${Date.now()}`,
      title,
      noteType: this.selectedNoteType(),
      visibility: this.selectedVisibility(),
      authorUsername: this.authorUsername(),
      createdAtLabel: 'Just now',
      contentHtml: html,
      contentText: text || title,
      sourceEntityKey: this.sourceEntityKey() || '1:Character:char-active',
      sourceEntityName: this.sourceEntityName() || 'Active Character',
      mentionedEntities: this.taggedEntities(),
    };

    this.noteSaved.emit(richNote);
    this.noteTitle.set('');
    this.editorHtml.set('');
    this.editorPlainText.set('');
    this.taggedEntities.set([]);
    if (this.editorSurface?.nativeElement) {
      this.editorSurface.nativeElement.innerHTML = '';
    }
    this.open.set(false);
  }

  private syncEditorState(surface: HTMLDivElement): void {
    this.editorHtml.set(surface.innerHTML);
    this.editorPlainText.set(surface.innerText || surface.textContent || '');
  }

  private detectAtMentionTrigger(): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    const anchorNode = selection.anchorNode;
    if (!anchorNode || anchorNode.nodeType !== Node.TEXT_NODE) {
      this.mentionMenuOpen.set(false);
      return;
    }
    const textBeforeCaret = (anchorNode.textContent || '').slice(0, selection.anchorOffset);
    const match = /@([a-zA-Z0-9_\-\s]{0,24})$/.exec(textBeforeCaret);
    if (match) {
      this.mentionQuery.set(match[1]);
      this.activeMentionIndex.set(0);
      this.mentionMenuOpen.set(true);
    } else {
      this.mentionMenuOpen.set(false);
    }
  }
}
