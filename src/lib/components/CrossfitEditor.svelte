<script lang="ts">
  import type { CrossfitConfig, CrossfitFormat } from '$lib/types';

  interface Props {
    value: CrossfitConfig;
    onChange: (v: CrossfitConfig) => void;
  }

  let { value, onChange }: Props = $props();

  const FORMATS: { id: CrossfitFormat; label: string; sub: string; icon: string }[] = [
    { id: 'amrap',   label: 'AMRAP',     sub: 'As Many Rounds As Possible', icon: '🔁' },
    { id: 'emom',    label: 'EMOM',      sub: 'Every Minute On the Minute', icon: '⏱️' },
    { id: 'fortime', label: 'For Time',  sub: 'Completar no menor tempo',   icon: '🏁' },
    { id: 'rft',     label: 'RFT',       sub: 'Rounds For Time',            icon: '🔄' },
    { id: 'chipper', label: 'Chipper',   sub: 'Lista longa sequencial',     icon: '📋' },
    { id: 'tabata',  label: 'Tabata',    sub: '8× 20s/10s',                 icon: '💥' }
  ];

  function update(patch: Partial<CrossfitConfig>) {
    onChange({ ...value, ...patch });
  }
</script>

<div class="wod">
  <div class="label">Formato do WOD</div>
  <div class="format-grid">
    {#each FORMATS as f (f.id)}
      <button
        class="fmt"
        class:sel={value.format === f.id}
        onclick={() => update({ format: f.id })}
      >
        <div class="fmt-ic">{f.icon}</div>
        <div class="fmt-label">{f.label}</div>
        <div class="fmt-sub">{f.sub}</div>
      </button>
    {/each}
  </div>

  {#if value.format === 'amrap' || value.format === 'emom'}
    <div class="field">
      <label>Duração total (minutos)</label>
      <div class="inp-row">
        <input
          type="number"
          min="1"
          max="60"
          value={value.durationMin ?? 20}
          oninput={(e) => update({ durationMin: Number(e.currentTarget.value) || 20 })}
        />
        <span class="suf">min</span>
      </div>
    </div>
  {/if}

  {#if value.format === 'rft'}
    <div class="field">
      <label>Rounds</label>
      <div class="inp-row">
        <input
          type="number"
          min="1"
          max="20"
          value={value.rounds ?? 5}
          oninput={(e) => update({ rounds: Number(e.currentTarget.value) || 5 })}
        />
        <span class="suf">rounds</span>
      </div>
    </div>
  {/if}

  {#if value.format === 'fortime' || value.format === 'chipper'}
    <div class="field">
      <label>Time cap (minutos, opcional)</label>
      <div class="inp-row">
        <input
          type="number"
          min="0"
          max="60"
          value={value.timeCap ?? ''}
          placeholder="sem limite"
          oninput={(e) => update({ timeCap: Number(e.currentTarget.value) || undefined })}
        />
        <span class="suf">min</span>
      </div>
    </div>
  {/if}

  <div class="field">
    <label>Notas / Script do WOD</label>
    <textarea
      rows="3"
      placeholder={
        value.format === 'amrap'
          ? 'Ex: 21 thrusters (40kg) + 21 pull-ups...'
          : value.format === 'emom'
            ? 'Min 1: 10 burpees · Min 2: 15 kettlebell swings...'
            : 'Descreva o WOD aqui'
      }
      value={value.notes ?? ''}
      oninput={(e) => update({ notes: e.currentTarget.value })}
    ></textarea>
  </div>
</div>

<style>
  .wod { display: flex; flex-direction: column; gap: var(--s-3); }

  .label {
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .format-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  @media (max-width: 420px) {
    .format-grid { grid-template-columns: 1fr 1fr; }
  }
  .fmt {
    padding: var(--s-3) var(--s-2);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: var(--text);
    transition: all var(--dur-fast);
  }
  .fmt.sel {
    background: color-mix(in srgb, var(--cat-crossfit) 15%, var(--bg-3));
    border-color: var(--cat-crossfit);
  }
  .fmt-ic { font-size: 22px; }
  .fmt-label { font-weight: 800; font-size: var(--fs-sm); letter-spacing: 0.04em; }
  .fmt-sub { font-size: 9px; color: var(--text-mute); text-align: center; line-height: 1.2; }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .field label {
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .inp-row {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding-right: var(--s-3);
  }
  .inp-row input {
    flex: 1;
    padding: 12px var(--s-3);
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    font-weight: 700;
  }
  .inp-row:focus-within {
    border-color: var(--cat-crossfit);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--cat-crossfit) 25%, transparent);
  }
  .suf {
    color: var(--text-mute);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
  }

  textarea {
    padding: var(--s-3);
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--text);
    font-family: inherit;
    font-size: var(--fs-sm);
    resize: vertical;
    line-height: 1.5;
  }
  textarea:focus {
    outline: 0;
    border-color: var(--cat-crossfit);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--cat-crossfit) 25%, transparent);
  }
</style>
