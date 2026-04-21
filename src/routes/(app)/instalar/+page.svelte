<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Badge from '$lib/components/Badge.svelte';
</script>

<!-- Intro -->
<Card accent="glow">
  <div class="intro">
    <div class="ic"><span class="mi">add_to_home_screen</span></div>
    <div>
      <h2>Salvar na tela inicial</h2>
      <p>
        Instale o FIBRA como um app de verdade — ícone na tela inicial,
        abre em tela cheia, funciona offline. Leva 10 segundos.
      </p>
      <div class="pills">
        <Badge variant="success" icon="offline_bolt">Offline</Badge>
        <Badge variant="info" icon="speed">Abre mais rápido</Badge>
        <Badge variant="accent" icon="fullscreen">Tela cheia</Badge>
      </div>
    </div>
  </div>
</Card>

<!-- iPhone -->
<Card title="iPhone / iPad (Safari)" icon="phone_iphone">
  <ol class="steps">
    <li>Abra este site no <strong>Safari</strong> (não funciona no Chrome iOS)</li>
    <li>Toque no botão <strong>Compartilhar</strong> <span class="mi inline">ios_share</span> na barra de baixo</li>
    <li>Role e toque em <strong>"Adicionar à Tela de Início"</strong></li>
    <li>Toque em <strong>Adicionar</strong> no canto superior direito</li>
    <li>Pronto — o ícone do FIBRA aparece ao lado dos seus apps</li>
  </ol>
  <div class="tip">
    <span class="mi">lightbulb</span>
    <span>Abra pelo ícone (não pelo Safari) pra ganhar tela cheia, push e cache offline.</span>
  </div>
</Card>

<!-- Android -->
<Card title="Android (Chrome)" icon="android">
  <ol class="steps">
    <li>Abra este site no <strong>Chrome</strong></li>
    <li>Toque nos três pontos <strong>⋮</strong> no canto superior direito</li>
    <li>Toque em <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong></li>
    <li>Confirme em <strong>Instalar</strong></li>
    <li>O ícone do FIBRA aparece na gaveta de apps e tela inicial</li>
  </ol>
  <div class="tip">
    <span class="mi">lightbulb</span>
    <span>Às vezes o Chrome mostra um banner "Adicionar à tela inicial" direto — basta aceitar.</span>
  </div>
</Card>

<style>
  .intro {
    display: flex;
    gap: var(--s-4);
    align-items: flex-start;
  }
  .intro .ic {
    width: 56px;
    height: 56px;
    border-radius: var(--r-lg);
    background: var(--grad-primary);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    box-shadow: var(--shadow-glow);
  }
  .intro .ic .mi { font-size: 28px; color: var(--bg-0); }
  .intro h2 { font-size: var(--fs-xl); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 4px; }
  .intro p { color: var(--text-mute); font-size: var(--fs-sm); }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: var(--s-3);
  }

  .steps {
    padding-left: var(--s-5);
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: var(--text);
    font-size: var(--fs-sm);
    margin: var(--s-2) 0 var(--s-3);
  }
  .mi.inline {
    font-size: 16px;
    vertical-align: -3px;
    color: var(--accent);
  }

  .tip {
    display: flex;
    gap: var(--s-2);
    align-items: flex-start;
    padding: var(--s-3);
    border-radius: var(--r-md);
    background: color-mix(in srgb, var(--info) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--info) 25%, transparent);
    color: var(--info);
    font-size: var(--fs-xs);
    margin-top: var(--s-2);
  }
  .tip .mi { font-size: 18px; flex-shrink: 0; }
</style>
