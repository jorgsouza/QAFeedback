# Plano: Modo diagnóstico de rede (HAR) + anexo Jira

> Fonte: alinhamento em conversa (captura CDP na aba do feedback, anexo no Jira, redação sensível por padrão, sem truncamento inicial, sem filtro de hosts obrigatório).

## Decisões de arquitetura (duráveis)

- **Mecanismo de captura:** `chrome.debugger` na **mesma aba** onde o modal de feedback corre, com Chrome DevTools Protocol — domínio **Network** (eventos + leitura de corpos quando aplicável). Não há API para “ler o histórico do painel Network”; o arquivo exportado reflete o que a extensão gravou enquanto estava anexada.
- **Formato do arquivo:** **HAR 1.2** (compatível com import no Chrome DevTools → Network), nome sugerido `qa-feedback-network.har` ou com timestamp.
- **Destino:** reutilizar o fluxo atual de **anexos Jira** após criar a issue (multipart, base64 no payload entre UI e service worker), tal como imagens — novo anexo com `mimeType` adequado para `.har` (tipicamente `application/json`).
- **Permissão:** `debugger` no manifest; **pedido explícito** ao usuário na primeiro uso do modo (ou ao gravar), com texto claro sobre o que faz.
- **Privacidade (default):** **redigir** headers e campos equivalentes sensíveis (ex.: `Cookie`, `Authorization`, `Set-Cookie`, variantes comuns) no HAR exportado; opção futura ou sub-toggle “incluir dados sensíveis” apenas se o produto precisar (fora do MVP se não for exigido já na primeira entrega).
- **Tamanho:** **sem truncamento** na primeira versão; monitorizar falhas de upload Jira / memória e rever se necessário.
- **Filtro de hosts:** **não obrigatório** no MVP (uso apenas em ambientes já alinhados).
- **Concorrência DevTools:** documentar e mostrar aviso na UI: **“Se a captura falhar, feche o DevTools nesta aba.”** Tratar erro de `attach` com mensagem legível.

**UI atual:** o texto longo do modo diagnóstico no formulário foi compactado para um **ícone ℹ️** (tooltip + `aria-label`); erros de captura continuam em **banner**; ver `DOCUMENTATION.md` → *Uso no dia a dia (modal)*.

---

## Fase 1: Toggle + permissão + ciclo attach/detach (sem HAR completo)

**Histórias:** Como QA, quero ativar “modo diagnóstico completo” nas opções para que a extensão possa depurar a rede da aba; quero perceber quando a captura está ativa ou falhou.

### O que construir

- Opção nas **definições** (guardada em `chrome.storage`) que ativa o modo diagnóstico.
- Ao abrir o fluxo de feedback numa aba elegível, se o modo estiver ligado: solicitar **permissão `debugger`** se ainda não concedida; em seguida **anexar** o depurador à aba, **ativar** o domínio Network e **desanexar** ao fechar o modal / após envio / em caso de erro fatal — sem vazar sessões órfãs.
- Indicador simples no modal (estado: a capturar / erro / desligado) e o aviso sobre **DevTools na mesma aba**.
- Entrega verificável: com o modo ligado, o attach funciona na maioria dos sites `http(s)`; com DevTools aberto, o usuário vê falha ou aviso conforme comportamento real do Chrome testado.

### Critérios de aceitação

- [ ] Toggle persistido; com modo desligado, **nenhum** `attach` ocorre.
- [ ] Com modo ligado, fluxo de feedback tenta attach e **sempre** tenta detach ao sair do modal.
- [ ] Mensagem clara se `attach` falhar (incl. conflito com outro depurador).
- [ ] Aviso visível: fechar DevTools nesta aba se a captura falhar.
- [ ] Manifest inclui permissão `debugger` (e documentação curta no README da extensão sobre o aviso de permissão).

---

## Fase 2: Gravação de rede in-memory (pedidos + metadados + corpos)

**Histórias:** Como dev, quero um HAR que reflita o tráfego da aba durante a sessão de feedback, com corpos completos quando o CDP os expõe.

### O que construir

- Manter estrutura em memória correlacionada por `requestId` (e timestamps), alimentada pelos eventos Network relevantes.
- Obter **post data** e **corpos de resposta** via comandos CDP adequados quando disponíveis; tratar pedidos sem body ou falhas de `getResponseBody` sem rebentar o export.
- **Sem truncamento** nesta fase; sem filtro de hosts.
- Entrega verificável: após navegar na aba com o modal aberto (ou janela de captura definida na UX), o buffer contém uma sequência coerente de entradas.

### Critérios de aceitação

- [ ] Eventos duplicados / ordem tratados de forma robusta (mesmo `requestId`).
- [ ] Respostas binárias ou não texto tratadas de forma definida (ex.: base64 no HAR, conforme especificação HAR).
- [ ] Nenhum crash do service worker em páginas com muito tráfego nos cenários de teste manuais acordados.

---

## Fase 3: Serialização HAR 1.2 + redação por padrão

**Histórias:** Como organização, quero que o anexo predefinido minimize vazamento de credenciais; como dev, quero importar o arquivo no DevTools.

### O que construir

- Função pura (testável) que converte o buffer interno para **objeto HAR 1.2** com `log.creator` identificando a extensão/versão.
- Camada de **redação** aplicada antes do export: remover ou substituir por placeholder valores de headers sensíveis (lista mínima acordada: `Cookie`, `Authorization`, `Set-Cookie`, e variações comuns).
- Testes unitários da redação e da forma geral do JSON (campos obrigatórios HAR).

### Critérios de aceitação

- [ ] Arquivo gerado abre no Chrome DevTools → Import HAR sem erro em caso de uso feliz.
- [ ] Headers redigidos não aparecem com valores originais no JSON final (testes cobrem casos principais).
- [ ] Comentário ou campo `comment` no HAR opcional indicando que passou por redação (útil para o dev).

---

## Fase 4: Anexo no Jira + texto de ajuda no ticket

**Histórias:** Como QA, quero que o HAR vá junto do bug no Jira; como dev, quero uma frase que explique o que é e como importar.

### O que construir

- Incluir o HAR serializado no **mesmo pipeline** de anexos pós-criação da issue (paralelo às imagens), com nome e tipo MIME corretos.
- Acrescentar à **descrição** (ou primeiro comentário, conforme for mais simples no código existente) um bloco curto em Markdown: o que é o arquivo, como importar no DevTools, aviso de dados operacionais/redigidos.
- Se o upload do anexo falhar (ex.: limite de tamanho Jira), **avisar** no resultado do envio (já existe padrão de `warnings` no fluxo).

### Critérios de aceitação

- [ ] Com Jira selecionado e modo diagnóstico ligado, issue criada contém anexo `.har` quando houve captura (ou política definida para “sessão vazia” — ex.: não anexar ou anexar HAR vazio mínimo; **decisão explícita na implementação**).
- [ ] Texto de ajuda visível no Jira no caso escolhido (descrição vs comentário).
- [ ] Falha de anexo não impede criação da issue; usuário vê aviso.

---

## Fase 5: UX, edge cases e documentação

**Histórias:** Como QA, sei quando o modo está ligado e o que esperar; como suporte, há documentação mínima.

### O que construir

- Copiar de UI revisado: toggle, explicação do modo, aviso DevTools, explicação da redação por padrão.
- Comportamento definido para: aba não injetável, recarregar página durante o modal, mudança de tab (se aplicável), timeout do service worker MV3 (persistência ou reattach — **decisão técnica** documentada no código).
- Atualizar `extension/README.md` (ou documentação existente do projeto) com: permissão debugger, privacidade, limites conhecidos (Jira, memória).

### Critérios de aceitação

- [ ] Fluxos acima têm comportamento definido e testado manualmente (checklist no PR).
- [ ] Documentação usuário-alvo atualizada de forma sucinta.

---

## Dependências e riscos

| Risco | Mitigação |
|--------|-----------|
| Conflito DevTools + `chrome.debugger` | Aviso na UI; mensagem de erro; testar em Chrome estável. |
| Anexo rejeitado por tamanho (Jira) | Warning na resposta; nota na doc; revisão futura com truncamento ou compressão. |
| Service worker suspenso (MV3) | Manter estado mínimo ou mover captura para offscreen/long-lived strategy **só se** testes mostrarem perda de eventos. |
| HAR com conteúdo binário | Seguir HAR para `encoding: base64` onde aplicável. |

---

## Ordem sugerida e paralelismo

- Fases **1 → 2 → 3** são sequenciais (cada uma amplia a anterior).
- Testes da Fase 3 podem começar assim que o modelo interno da Fase 2 estiver estável.
- Fase 4 depende da Fase 3; Fase 5 pode ir sendo incrementada desde a Fase 1 (copy e README).

Quando aprovares a granularidade, a implementação segue esta ordem com PRs/fases alinhados a cada fatia vertical.
