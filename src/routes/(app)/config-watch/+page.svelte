<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.svelte';
  import { getProfile, saveProfile } from '$lib/db/profile';
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import Input from '$lib/components/Input.svelte';
  import { env } from '$env/dynamic/public';

  let copied = $state<string | null>(null);
  let watchToken = $state<string>('');
  let generating = $state(false);

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    copied = key;
    setTimeout(() => (copied = null), 1600);
  }

  onMount(async () => {
    if (!authStore.uid) return;
    const p = await getProfile(authStore.uid);
    watchToken = p?.settings?.watchToken ?? '';
  });

  async function generateToken() {
    if (!authStore.uid) return;
    generating = true;
    try {
      const newToken = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
      const p = await getProfile(authStore.uid);
      if (!p) return;
      await saveProfile(authStore.uid, {
        ...p,
        settings: { ...p.settings, watchToken: newToken }
      });
      watchToken = newToken;
    } finally {
      generating = false;
    }
  }

  const webhookUrl = env.PUBLIC_WATCH_WEBHOOK_URL || 'https://us-central1-fibra.cloudfunctions.net/watchWebhook';
  const shortcutName = 'FIBRA — Enviar Treino';
</script>

<!-- Intro -->
<Card accent="glow">
  <div class="intro">
    <div class="ic"><span class="mi">watch</span></div>
    <div>
      <h2>Sincronize seu Apple Watch</h2>
      <p>
        Pegue FC média, calorias ativas e minutos de exercício direto da Saúde do iPhone,
        sem app nativo. Usamos o app <strong>Atalhos</strong> (já vem instalado) como ponte.
      </p>
      <div class="pills">
        <Badge variant="success" icon="check_circle">Grátis</Badge>
        <Badge variant="info" icon="lock">Só seus dados</Badge>
        <Badge variant="accent" icon="bolt">3 minutos</Badge>
      </div>
    </div>
  </div>
</Card>

<!-- O que você vai ganhar -->
<Card title="O que você vai ganhar" icon="star">
  <ul class="feats">
    <li><span class="mi">favorite</span> <strong>FC média e máxima</strong> do treino (não é estimativa)</li>
    <li><span class="mi">local_fire_department</span> <strong>Calorias ativas reais</strong> medidas pelo Watch</li>
    <li><span class="mi">timer</span> <strong>Minutos de exercício</strong> e duração total</li>
    <li><span class="mi">directions_run</span> <strong>Distância</strong> (corrida/caminhada) quando aplicável</li>
  </ul>
</Card>

<!-- Passo 1 -->
<div class="step">
  <div class="step-num">1</div>
  <Card title="Baixar o atalho FIBRA" icon="download">
    <p class="desc">
      Toque no botão abaixo no seu iPhone. O app Atalhos vai abrir pedindo pra adicionar
      o atalho "<strong>{shortcutName}</strong>".
    </p>
    <Button
      icon="ios_share"
      full
      onclick={() => window.open('https://www.icloud.com/shortcuts/PLACEHOLDER', '_blank')}
    >
      Adicionar atalho no iPhone
    </Button>
    <div class="hint">
      <span class="mi">info</span>
      <span>Precisa estar no iPhone. No desktop, escaneie o QR abaixo.</span>
    </div>
  </Card>
</div>

<!-- Passo 2 -->
<div class="step">
  <div class="step-num">2</div>
  <Card title="Permitir acesso à Saúde" icon="health_and_safety">
    <p class="desc">
      Na primeira execução, o iOS vai perguntar se o atalho pode ler seus dados.
      Permita acesso a: <strong>Frequência cardíaca</strong>, <strong>Energia ativa</strong>,
      <strong>Minutos de exercício</strong> e <strong>Treinos</strong>.
    </p>
    <div class="tip">
      <span class="mi">lightbulb</span>
      <span>Se quiser conferir depois: <em>Ajustes → Saúde → Compartilhamento de Dados → Apps → Atalhos</em>.</span>
    </div>
  </Card>
</div>

<!-- Passo 3 -->
<div class="step">
  <div class="step-num">3</div>
  <Card title="Configurar o endpoint" icon="settings_ethernet">
    <p class="desc">
      O atalho vem com um placeholder. Copie a URL abaixo e cole no passo
      "URL" dentro do atalho (abra <em>Atalhos → FIBRA → ✏️ editar</em>).
    </p>
    <div class="code-row">
      <code>{webhookUrl}</code>
      <Button
        size="sm"
        variant={copied === 'url' ? 'success' : 'secondary'}
        icon={copied === 'url' ? 'check' : 'content_copy'}
        onclick={() => copy(webhookUrl, 'url')}
      >
        {copied === 'url' ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
    {#if watchToken}
      <div class="token-row">
        <div class="tok-lbl">Seu token pessoal</div>
        <div class="code-row">
          <code>{watchToken}</code>
          <Button
            size="sm"
            variant={copied === 'token' ? 'success' : 'secondary'}
            icon={copied === 'token' ? 'check' : 'content_copy'}
            onclick={() => copy(watchToken, 'token')}
          >
            {copied === 'token' ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <div class="tok-info">
          Cole esse token no campo <em>Token</em> do atalho. Envie junto nas chamadas como header
          <code>X-FIBRA-Token</code>.
        </div>
      </div>
    {:else}
      <Button icon="vpn_key" loading={generating} onclick={generateToken}>
        Gerar token pessoal
      </Button>
    {/if}
  </Card>
</div>

<!-- Passo 4 -->
<div class="step">
  <div class="step-num">4</div>
  <Card title="Usar ao terminar o treino" icon="play_circle">
    <p class="desc">
      Ao finalizar um treino no Apple Watch, abra o iPhone e:
    </p>
    <ol class="steps">
      <li>Puxe a <strong>Central de Controle</strong> (canto superior direito)</li>
      <li>Toque em <strong>"FIBRA — Enviar Treino"</strong> (adicione o widget do Atalhos se não aparecer)</li>
      <li>Selecione o treino recém-terminado</li>
      <li>O FIBRA abre automaticamente com FC, calorias e duração já preenchidos</li>
    </ol>

    <div class="tip success">
      <span class="mi">tips_and_updates</span>
      <span>
        <strong>Pro-tip:</strong> configure uma <em>Automação</em> no Atalhos para rodar
        esse fluxo automaticamente quando um treino termina no Watch. Zero toques.
      </span>
    </div>
  </Card>
</div>

<!-- Instalar na tela inicial -->
<Card accent="glow">
  <div class="intro">
    <div class="ic alt"><span class="mi">add_to_home_screen</span></div>
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

<!-- Troubleshooting -->
<Card title="Se algo der errado" icon="support">
  <details class="faq">
    <summary>O atalho não aparece na Central de Controle</summary>
    <p>
      Vá em <em>Ajustes → Central de Controle</em> e adicione "Atalhos". O widget
      mostra os atalhos fixados (toque e segure um atalho para fixar).
    </p>
  </details>
  <details class="faq">
    <summary>Dados não aparecem no FIBRA</summary>
    <p>
      Confira se o atalho foi executado com sucesso (aparece notificação ✓).
      Se sim, pode ser que o treino esteja em um horário fora da janela que o
      atalho lê. Edite o atalho e ajuste o campo "Período" para "Hoje".
    </p>
  </details>
  <details class="faq">
    <summary>Só quero importar sem atalho, posso?</summary>
    <p>
      Sim! Em <em>Ajustes → Saúde → Exportar todos os Dados de Saúde</em>, o iOS
      gera um ZIP. No FIBRA, vá em <em>Progresso → Importar Saúde</em> e escolha
      o arquivo. Importa tudo de uma vez.
    </p>
  </details>
  <details class="faq">
    <summary>Tenho Android / não tenho Apple Watch</summary>
    <p>
      Android com Wear OS: use o <strong>Health Connect</strong> (em breve).
      Sem wearable: FC e calorias ficam estimados pela fórmula de Epley + TMB.
    </p>
  </details>
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
  .intro .ic.alt { background: linear-gradient(135deg, var(--accent-2, var(--accent)), var(--accent)); }
  .mi.inline {
    font-size: 16px;
    vertical-align: -3px;
    color: var(--accent);
  }
  .intro h2 { font-size: var(--fs-xl); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 4px; }
  .intro p { color: var(--text-mute); font-size: var(--fs-sm); }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: var(--s-3);
  }

  .feats {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }
  .feats li {
    display: flex;
    gap: var(--s-3);
    align-items: center;
    color: var(--text);
    font-size: var(--fs-sm);
  }
  .feats .mi {
    color: var(--accent);
    font-size: 20px;
  }

  .step {
    position: relative;
    margin: var(--s-4) 0;
    padding-left: var(--s-10);
  }
  .step-num {
    position: absolute;
    left: 0;
    top: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--grad-primary);
    color: var(--bg-0);
    display: grid;
    place-items: center;
    font-weight: 800;
    font-family: var(--font-mono);
    box-shadow: var(--shadow-glow);
  }
  .step::before {
    content: '';
    position: absolute;
    left: 16px;
    top: 32px;
    bottom: -16px;
    width: 2px;
    background: var(--border);
  }
  .step:last-of-type::before { display: none; }

  .desc {
    color: var(--text-mute);
    font-size: var(--fs-sm);
    margin-bottom: var(--s-3);
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

  .code-row {
    display: flex;
    gap: var(--s-2);
    align-items: center;
    background: var(--bg-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: var(--s-2) var(--s-2) var(--s-2) var(--s-3);
    margin-bottom: var(--s-3);
  }
  .code-row code {
    flex: 1;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--accent);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .token-row { margin-top: var(--s-3); }
  .tok-lbl {
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-mute);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
  }
  .tok-info {
    margin-top: var(--s-2);
    font-size: var(--fs-xs);
    color: var(--text-mute);
    line-height: 1.5;
  }
  .tok-info code {
    background: var(--bg-3);
    padding: 1px 6px;
    border-radius: var(--r-sm);
    font-size: 11px;
    color: var(--accent);
  }

  .hint, .tip {
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
  .tip.success {
    background: color-mix(in srgb, var(--success) 10%, transparent);
    border-color: color-mix(in srgb, var(--success) 25%, transparent);
    color: var(--success);
  }
  .hint .mi, .tip .mi { font-size: 18px; flex-shrink: 0; }

  .faq {
    padding: var(--s-3) 0;
    border-bottom: 1px solid var(--border);
  }
  .faq:last-child { border-bottom: 0; }
  .faq summary {
    cursor: pointer;
    font-weight: 600;
    font-size: var(--fs-sm);
    list-style: none;
    position: relative;
    padding-right: 24px;
  }
  .faq summary::-webkit-details-marker { display: none; }
  .faq summary::after {
    content: 'expand_more';
    font-family: 'Material Symbols Rounded';
    position: absolute;
    right: 0;
    top: 0;
    transition: transform var(--dur-fast);
  }
  .faq[open] summary::after { transform: rotate(180deg); }
  .faq p {
    margin-top: var(--s-2);
    color: var(--text-mute);
    font-size: var(--fs-sm);
    line-height: 1.6;
  }
</style>
