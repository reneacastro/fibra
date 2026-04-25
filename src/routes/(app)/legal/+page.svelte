<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  let active = $state<'termos' | 'privacidade' | 'lgpd'>('termos');
</script>

<svelte:head>
  <title>Termos e privacidade · FIBRA</title>
</svelte:head>

<div class="tabs">
  <button class="tab" class:on={active === 'termos'} onclick={() => (active = 'termos')}>📜 Termos</button>
  <button class="tab" class:on={active === 'privacidade'} onclick={() => (active = 'privacidade')}>🔒 Privacidade</button>
  <button class="tab" class:on={active === 'lgpd'} onclick={() => (active = 'lgpd')}>⚖️ LGPD</button>
</div>

<Card>
  {#if active === 'termos'}
    <h2>Termos de Uso</h2>
    <p class="meta">Última atualização: 25 de abril de 2026</p>

    <h3>1. Aceitação</h3>
    <p>Ao usar o FIBRA, você concorda com estes termos. Se discorda, não use o app.</p>

    <h3>2. Quem pode usar</h3>
    <p>Maiores de 13 anos. Menores de 18 precisam de autorização do responsável.</p>

    <h3>3. Sua conta</h3>
    <ul>
      <li>Você é responsável por manter sua senha segura</li>
      <li>Não compartilhe sua conta — uma conta por pessoa</li>
      <li>Avise se suspeitar de uso não autorizado</li>
    </ul>

    <h3>4. Conteúdo do app</h3>
    <p>O catálogo de exercícios, instruções, planos sugeridos e templates são <strong>conteúdo informativo</strong>, não substituem orientação de profissional de saúde (médico, educador físico, nutricionista). Antes de iniciar qualquer atividade física ou dieta, consulte um profissional.</p>

    <h3>5. Conteúdo gerado por você</h3>
    <p>Treinos, posts em grupos, mensagens — você mantém os direitos do que cria. Concede ao FIBRA licença pra exibir ao público quando você marca como público (ex: ranking, posts em grupo público).</p>

    <h3>6. Comportamento</h3>
    <p>Não é permitido:</p>
    <ul>
      <li>Assédio, discurso de ódio, ameaças, spam</li>
      <li>Compartilhar conteúdo ilegal ou de terceiros sem permissão</li>
      <li>Tentar burlar segurança ou sobrecarregar o sistema</li>
      <li>Fazer engenharia reversa do app</li>
    </ul>
    <p>Violação pode resultar em suspensão ou exclusão da conta.</p>

    <h3>7. Trainer/Nutricionista</h3>
    <p>Profissionais aprovados podem orientar alunos via app. O FIBRA é apenas a plataforma — a responsabilidade pelo plano prescrito é do profissional. Aluno deve verificar o registro CREF/CRN do profissional antes de seguir orientações.</p>

    <h3>8. Pagamentos</h3>
    <p>Planos pagos: cobrança recorrente conforme escolhido (mensal/anual). Cancele a qualquer momento — uso continua até o fim do período pago, sem reembolso proporcional. Em caso de cobrança indevida, fale conosco em até 30 dias.</p>

    <h3>9. Disponibilidade</h3>
    <p>Tentamos manter o app no ar 24/7, mas pode haver manutenção, falhas de terceiros (Firebase, internet) ou bugs. Sem garantia de disponibilidade ininterrupta. Não nos responsabilizamos por perda de dados causada por falha que não seja culpa direta nossa — fazemos backup mas faça também o seu.</p>

    <h3>10. Limitação de responsabilidade</h3>
    <p>O FIBRA não se responsabiliza por:</p>
    <ul>
      <li>Lesões físicas durante treino — siga o app por sua conta e risco, com supervisão profissional quando indicado</li>
      <li>Resultados de saúde, peso ou composição — depende de muitos fatores além do app</li>
      <li>Perda de dados causada por terceiros (Firebase, dispositivo do usuário)</li>
      <li>Conteúdo postado por outros usuários em grupos públicos</li>
    </ul>

    <h3>11. Mudanças nos termos</h3>
    <p>Podemos atualizar estes termos. Mudanças relevantes serão comunicadas no app ou por e-mail. Continuar usando após a mudança significa aceitar.</p>

    <h3>12. Foro</h3>
    <p>Disputas serão resolvidas no foro da comarca de São Paulo/SP, salvo previsão legal em contrário (ex: Código de Defesa do Consumidor).</p>

    <h3>13. Contato</h3>
    <p>Dúvida sobre os termos: <a href="mailto:contato@fibra.app">contato@fibra.app</a></p>
  {:else if active === 'privacidade'}
    <h2>Política de Privacidade</h2>
    <p class="meta">Última atualização: 25 de abril de 2026</p>

    <h3>O que coletamos</h3>
    <p>Para o app funcionar:</p>
    <ul>
      <li><strong>Cadastro:</strong> nome, e-mail, senha (hash), data de nascimento, sexo, altura, peso, objetivos, nível de atividade</li>
      <li><strong>Treino e dieta:</strong> exercícios, séries, pesos, duração, calorias, refeições, alimentos consumidos</li>
      <li><strong>Composição corporal:</strong> medidas (peso, percentual de gordura, etc) — quando você insere ou faz upload de PDF</li>
      <li><strong>GPS:</strong> rota do percurso quando você usa cardio com tracker (apenas durante o treino)</li>
      <li><strong>Comunicação:</strong> mensagens com seu trainer/nutri, posts em grupos</li>
      <li><strong>Técnico:</strong> versão do app, sistema operacional, IP (logs de segurança), erros</li>
    </ul>

    <h3>O que NÃO coletamos</h3>
    <ul>
      <li>Localização fora do treino com GPS ativo</li>
      <li>Contatos do seu telefone</li>
      <li>Lista de apps instalados</li>
      <li>Acesso à câmera ou galeria sem você selecionar arquivo</li>
      <li>Cookies de terceiros (não temos ads)</li>
    </ul>

    <h3>Pra que usamos seus dados</h3>
    <ul>
      <li>Personalizar treino e dieta (TDEE, sugestão de macros, progressivo)</li>
      <li>Calcular ranking/streak (se você optou pelo perfil público)</li>
      <li>Detectar PRs e enviar conquistas</li>
      <li>Backup automático no Firebase pra você não perder histórico</li>
      <li>Suporte ao usuário</li>
    </ul>

    <h3>Quem tem acesso</h3>
    <ul>
      <li><strong>Você:</strong> acesso total aos seus dados</li>
      <li><strong>Seu trainer/nutricionista (se aceitou):</strong> acesso a treinos, sessões, composição corporal, dieta — limitado pelo escopo da relação</li>
      <li><strong>Comunidade:</strong> apenas se você ativou "perfil público" — nome, avatar, stats agregados (treinos totais, streak)</li>
      <li><strong>FIBRA (equipe):</strong> acesso técnico restrito e auditado, apenas pra suporte ou manutenção</li>
    </ul>

    <h3>Onde ficam os dados</h3>
    <p>Servidores Firebase do Google (região: South America - São Paulo). Criptografia em trânsito (HTTPS) e em repouso. Sua senha é armazenada como hash (Firebase Auth) — nem nós conseguimos ver.</p>

    <h3>Compartilhamento com terceiros</h3>
    <p>Usamos:</p>
    <ul>
      <li><strong>Google Firebase:</strong> autenticação, banco de dados, hospedagem</li>
      <li><strong>Open Food Facts:</strong> base pública de alimentos (você consulta, não enviamos seus dados pra eles)</li>
      <li><strong>OpenRouter (DeepSeek):</strong> processamento de PDF de bioimpedância e sugestões de IA — enviamos apenas o que você submete pra análise</li>
      <li><strong>Mapbox:</strong> renderização de mapas de rota GPS (apenas a rota é enviada)</li>
    </ul>
    <p>Nunca vendemos seus dados.</p>

    <h3>Seus direitos (LGPD)</h3>
    <p>Você pode:</p>
    <ul>
      <li>Solicitar exportação dos seus dados (em breve via app)</li>
      <li>Pedir correção de dados incorretos</li>
      <li>Apagar sua conta (em breve via app, hoje pelo e-mail)</li>
      <li>Saber com quem compartilhamos</li>
      <li>Revogar consentimento (mas o app pode parar de funcionar)</li>
    </ul>

    <h3>Retenção</h3>
    <p>Mantemos seus dados enquanto sua conta existir. Após exclusão, removemos em até 30 dias (exceto logs anonimizados e dados que precisamos manter por obrigação legal).</p>

    <h3>Cookies / armazenamento local</h3>
    <p>Usamos localStorage e IndexedDB pra cache do app, persistir sessão de treino interrompida (lock de tela), e funcionar offline. Sem cookies de tracking.</p>

    <h3>Mudanças</h3>
    <p>Avisaremos no app antes de mudanças relevantes na política.</p>

    <h3>Contato</h3>
    <p>Encarregado de proteção de dados: <a href="mailto:privacidade@fibra.app">privacidade@fibra.app</a></p>
  {:else}
    <h2>LGPD — Lei Geral de Proteção de Dados</h2>
    <p class="meta">Resumo dos seus direitos como titular de dados pessoais.</p>

    <h3>Base legal</h3>
    <p>Tratamos seus dados com base no <strong>consentimento</strong> (que você dá ao se cadastrar e ao ativar features como perfil público) e na <strong>execução de contrato</strong> (manter o app funcionando pra você).</p>

    <h3>Princípios que seguimos</h3>
    <ul>
      <li><strong>Finalidade:</strong> dados são coletados pra propósitos claros (ver Política de Privacidade)</li>
      <li><strong>Adequação:</strong> só coletamos o necessário</li>
      <li><strong>Necessidade:</strong> minimizamos ao essencial</li>
      <li><strong>Transparência:</strong> esta página existe pra você saber tudo</li>
      <li><strong>Segurança:</strong> criptografia, controles de acesso, auditoria</li>
      <li><strong>Não-discriminação:</strong> não usamos seus dados pra te prejudicar</li>
    </ul>

    <h3>Seus 9 direitos (Art. 18 LGPD)</h3>
    <ol>
      <li>Confirmação de existência de tratamento</li>
      <li>Acesso aos dados</li>
      <li>Correção de dados incompletos/inexatos</li>
      <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
      <li>Portabilidade (exportação) dos dados</li>
      <li>Eliminação dos dados pessoais tratados com consentimento</li>
      <li>Informação sobre compartilhamento com terceiros</li>
      <li>Informação sobre possibilidade de não consentir e suas consequências</li>
      <li>Revogação do consentimento</li>
    </ol>

    <h3>Como exercer</h3>
    <p>Mande e-mail pra <a href="mailto:privacidade@fibra.app">privacidade@fibra.app</a> com:</p>
    <ul>
      <li>Seu nome completo + e-mail cadastrado</li>
      <li>Direito que quer exercer (ex: "quero exportar meus dados")</li>
      <li>Documento que comprove identidade (RG/CPF — protege contra fraude)</li>
    </ul>
    <p>Respondemos em até 15 dias úteis.</p>

    <h3>Incidentes de segurança</h3>
    <p>Em caso de vazamento que afete seus direitos, comunicaremos a você e à ANPD (Autoridade Nacional de Proteção de Dados) em até 72h.</p>

    <h3>Reclamação</h3>
    <p>Não satisfeito com a resposta? Reclame na ANPD: <a href="https://www.gov.br/anpd" target="_blank" rel="noopener">gov.br/anpd</a></p>

    <h3>Encarregado (DPO)</h3>
    <p><a href="mailto:privacidade@fibra.app">privacidade@fibra.app</a></p>
  {/if}
</Card>

<style>
  .tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--bg-3);
    border-radius: var(--r-full);
    margin-bottom: var(--s-3);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar { display: none; }
  .tab {
    flex: 1;
    padding: 10px;
    border-radius: var(--r-full);
    color: var(--text-mute);
    font-size: var(--fs-xs);
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    transition: all var(--dur-fast);
  }
  .tab.on {
    background: var(--bg-0);
    color: var(--text);
    box-shadow: 0 0 0 1px var(--border);
  }

  h2 {
    font-size: var(--fs-xl);
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: var(--s-2);
  }
  .meta {
    font-size: var(--fs-xs);
    color: var(--text-mute);
    margin-bottom: var(--s-4);
  }
  h3 {
    font-size: var(--fs-md);
    font-weight: 700;
    margin: var(--s-4) 0 var(--s-2);
    color: var(--accent);
  }
  p {
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--text);
    margin-bottom: var(--s-2);
  }
  ul, ol {
    padding-left: var(--s-4);
    margin-bottom: var(--s-2);
  }
  li {
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--text);
    margin-bottom: 4px;
  }
  a {
    color: var(--accent);
    text-decoration: underline;
  }
  strong { font-weight: 700; }
</style>
