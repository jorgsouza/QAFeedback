# Plano: layout Figma «QA Automation — plugin» + Trust DS + PDF

> **Arquivo Figma:** [QA Automation — plugin](https://www.figma.com/design/6hLsb9blQzsbJglPIKwDci/QA-Automation---plugin)  
> **Nó analisado (MCP):** `11:3550` (SECTION — artboard de documentação com variantes Mobile/Desktop, fluxo principal e sucesso).  
> **Objetivo:** implementar na extensão Chrome a mesma hierarquia de informação do design e do PDF *QA Automation — plugin*, com aderência aos padrões **Trust DS** (componentes ou tokens espelhados no Shadow DOM).

### Escopo funcional (restrito)

Até a introdução de **IA** no produto, a **única mudança de funcionalidade** prevista é:

- **Título da issue:** preenchido **automaticamente** com as **quatro primeiras palavras** do texto da descrição («O que aconteceu» / campo equivalente), seja **digitado** ou **ditado** (Chrome ou ditado do sistema). Sempre que esse texto mudar, o título deve ser recalculado com a mesma regra (normalizar espaços em branco; considerar «palavra» como segmentos separados por espaço; se houver menos de quatro palavras, usar as que existirem).

Todo o restante neste documento (layout Figma, Trust DS, chips visuais, copy «RA Inspector», tela de sucesso, etc.) deve ser tratado como **mudança de interface e apresentação** em cima do comportamento **já existente** — **sem** novos fluxos de dados (ex.: board continua onde já está hoje nas Opções) até decisão futura com IA.

---

## 1. Conexão Figma (MCP) — OK

A API do Figma respondeu com sucesso após atualização da chave. O nó `11:3550` é uma **SECTION** que agrega:

- Cabeçalho promocional gigante «RA Inspector» com **pills** de contexto (ex.: «QA & Tech», «Em validação») e cores da **Brand system** Reclame AQUI (`cor-ra01`, `cor-ra14`, `cor-ra20`).
- Marcadores **Mobile** / **Desktop** e screenshots de referência.
- Frames de produto usáveis para implementação:
  - **Mobile:** `_SheetContent` (~**377×867** px), comportamento de **painel lateral / sheet** com borda esquerda.
  - Instância **`body_dialog`** (`componentId: 1:903`) — corpo do formulário.
  - Instância **`body_dialog_imagem`** — variante com contagem de prints (ex.: `6/8`).
  - **`body_sucess`** (`11:772`) — estado pós-envio «Evidência criada».

> **Nota de escala:** medidas no arquivo incluem arte de marketing em tamanho enorme (section ~12053×8139); para CSS da extensão use como referência os frames **Mobile 377px** e tokens relativos (padding, gap, tipografia), não o poster.

---

## 2. Inventário do design (extraído do Figma)

### 2.1 Hierarquia do painel (Mobile / sheet)

| Bloco | Conteúdo Figma | Comentário |
|-------|----------------|------------|
| Área do sheet | `padding: 24px`, `gap: 16px`, fundo `#FFFFFF`, borda esquerda `#E2E8F0` | Espelhar como container do modal/sidebar na extensão |
| Avatar + header | Imagem 40×40, **RA Inspector** (`text-lg/semibold`, Inter Tight 600, 18px), subtítulo **Ferramenta de QA do Reclame AQUI** (description tertiary, `#62748E`) | Alinhar copy ao produto |
| **Board** | `Select`: label «Board do Jira para vincular», placeholder «Selecione um board», trigger `8px 12px`, `border-radius: 12px`, borda `#CAD5E2` | **Só UI / paridade visual:** sem mudar onde o board é definido funcionalmente (Opções), salvo decisão posterior; pode ser read-only refletindo o board atual ou omitido no primeiro corte |
| **Motivo** | Label «Motivo de abertura» + **Chips** (component set `Chips` / `1:182`): Desenvolvimento, Design, Requisito, Integração, Segurança, Em análise, Auto resolvido/Orientação | **Coincide** com `JIRA_MOTIVO_ABERTURA_OPTIONS` no código |
| **Descrição** | «Descreva o problema» + textarea com placeholder «Aqui você pode relatar…» + **mic** em botão **Secondary**, **sm**, **icon** (`4:595`) | Já existe lógica de ditado; ajustar layout |
| **Prints** | Label «Prints do problema (opcional) - 0/8» + dois botões **Secondary** com ícones **Upload** / **Camera**, `border-radius: 12px` | Igual ao PDF; variante `body_dialog_imagem` com `6/8` |
| **Rodapé ações** | Três botões em linha (`layout_ELJWV8`, `gap: 8px`, fill horizontal): **Enviar** (variant Default, fill `#004D37`, texto `#F8FAFC`), **Copiar** (Secondary + ícone Copy), **Cancelar** (Ghost) | Ordem no Figma: **Enviar → Copiar → Cancelar** |
| Chrome | Ícones `setting-2`, `PanelLeftClose` posicionados no topo direito | Mapear: configurações / recolher painel (decisão de produto) |

### 2.2 Tela de sucesso (`body_sucess`)

- Ílustr **check_positivo** + título **Evidência criada** (`Typography/title secondary`, preto no spec).
- **Dois cards** (`border-radius: 12px`, borda `stroke_FEL9VW`):
  - **Jira Board:** linha com ícone `LayoutDashboard` + texto; ações **Copiar** + **Acessar** (botões Secondary **sm**, `border-radius: 8px`).
  - **Jira Issue:** ícone `task`; mesma dupla **Copiar** + **Acessar**.
- Rodapé: **Criar novo** (Default `#004D37`, ícone `add`) + **Fechar** (Secondary outline).

### 2.3 Tokens úteis (CSS / Trust DS)

| Uso | Valor Figma |
|-----|-------------|
| Fundo sheet | `#FFFFFF` |
| Texto principal | `#0F172B` |
| Texto secundário / descrição | `#62748E` |
| Borda input / card leve | `#CAD5E2` — `#E2E8F0` |
| **Primário (Enviar)** | `#004D37` |
| Texto sobre primário | `#F8FAFC` |
| **Brand RA** (header marketing) | `#F0F5E0`, `#5CA77E`, `#003330` |
| Tipografia UI | **Inter Tight** 500/600; labels **14px** (`text-sm/medium`); título sheet **18px semibold** |
| Raio botões principais | **12px**; ações sm nos cards **8px** |
| Sombra | `shadow/sm`: `0 2px 2px rgba(98, 116, 142, 0.08)` |

**Trust DS (RAG):** variantes de botão **default** (primário verde), **secondary** (outline), **ghost**; componente **Chip** com `selected`; **Dialog** / **Sheet** para modal; tokens via `@trust/ds/global.css` ou classes `ds-button`. O Figma usa paleta próxima do verde institucional (`#004D37` vs `bg-primary-700` no DS) — validar com design se deve haver **match exato RA** ou **token Trust** por tema.

---

## 3. PDF vs Figma vs código

- O **PDF** e o **Figma** descrevem o **mesmo fluxo** (board, chips de motivo com os sete valores, descrição, prints, três ações, sucesso com links).
- O **repositório** já implementa envio Jira/GitHub, anexos, captura, motivos em `jira-motivo.ts` (**sem divergência de strings**).
- **Gaps de UI** (não confundir com escopo funcional, cf. «Escopo funcional» acima): paridade com Figma/PDF — chips vs `<select>`, copy/branding «RA Inspector», rodapé e tela de sucesso conforme frames `body_sucess`, eventual **Sheet** direito 377px vs modal central atual; **board no painel** só se for apresentação, não novo fluxo de escolha.

---

## 4. Viabilidade

**Sim.** Não há bloqueio técnico: Shadow DOM aceita os mesmos tokens (incl. classe `dark` no host interno, conforme Trust DS). A decisão principal é **arquitetura visual**:

| Abordagem | Quando usar |
|-----------|-------------|
| **A — `@trust/ds` + Tailwind** bundle na extensão | Time exige componentes DS oficiais e aceita custo de bundle/config |
| **B — Tokens espelhados** em `shadow-styles.ts` | Paridade visual rápida com Figma (cores/raios acima) e bundle menor |
| **C — Híbrido** | DS para Button/Chip/Dialog; RA brand só no header |

**Recomendação:** começar por **B ou C**, usando os valores da sec §2.3; migrar para **A** se o design system interno for obrigatório no backlog.

---

## 5. Branch e escopo

- **Branch:** `feature/qa-automation-layout-trust-ds` (já utilizada no repo).
- **Escopo funcional:** apenas a regra **título = quatro primeiras palavras** da descrição (texto + ditado), até entrada de IA.
- **Escopo de UI:** demais itens do plano são visuais sobre a base atual, **sem** alterar contratos de API, destinos ou fluxos já implementados (salvo a regra de título acima).

---

## 6. Fases de implementação

### Fase 0 — Alinhamento

- [ ] Confirmar com UX se o deploy alvo é **sheet lateral fixo ~377px** (Figma Mobile) ou **modal centrado** no desktop com os mesmos tokens.
- [ ] Decidir **A / B / C** (Trust DS pacote vs CSS).
- [ ] Exportar ou anotar **fontes** (Inter Tight): fallback da extensão se não embeddar webfont.

### Fase 1 — Título automático (única mudança funcional)

- [ ] Função pura ex.: `titleFromDescription(text: string): string` (4 primeiras palavras, edge cases: vazio, só espaços, pontuação colada à palavra).
- [ ] Ligar ao state da descrição e aos caminhos de **ditado** (Chrome + SO) para manter título sincronizado.
- [ ] UX: campo título **somente leitura**, oculto ou com hint «gerado da descrição» — alinhar ao design.
- [ ] Testes Vitest na função de extração; regressão em envio GitHub/Jira.

### Fase 2 — Shell do painel (UI)

- [ ] Container com padding **24px**, gaps **16px** / **20px** (body), borda/sombra conforme Figma.
- [ ] Header: avatar opcional (asset ou iniciais), título e subtítulo fixos ou i18n.
- [ ] Ícones settings / fechar painel (atalhos para opções e minimizar).

### Fase 3 — Formulário (UI)

- [ ] **Select** de board **apenas visual** ou omitido: não mudar onde o utilizador configura o quadro (Opções), salvo decisão futura com IA.
- [ ] **Chips** single-select para motivo (`Chip` Trust DS ou botões com `aria-pressed`).
- [ ] Textarea + mic **Secondary sm** alinhado ao frame.
- [ ] Bloco prints: label dinâmica `x/8`, botões com ícones upload/câmera.

### Fase 4 — Rodapé

- [ ] Ordem **Enviar | Copiar | Cancelar**; estados disabled/loading com opacidade como no Figma (0.6 onde aplicável).
- [ ] Copiar: markdown ou URL (comportamento atual documentado).

### Fase 5 — Sucesso

- [ ] Layout «Evidência criada» + dois cards (Board / Issue) com **Copiar** e **Acessar**.
- [ ] **Criar novo** (limpa + volta ao form); **Fechar** fecha painel.

### Fase 6 — Responsividade

- [ ] Em viewport estreito: largura máxima ~100% com `max-width: 377px` ou full-bleed sheet.
- [ ] Garantir FAB/modal não quebre scroll da página.

### Fase 7 — Tema escuro (opcional)

- [ ] Aplicar `.dark` no host do shadow root + tokens DS invertidos, se produto pedir.

### Fase 8 — Qualidade

- [ ] `npm run check` e `npm test`.
- [ ] Atualizar `extension/README.md` / `DOCUMENTATION.md` (título gerado das quatro primeiras palavras da descrição).
- [ ] Checklist visual lado a lado com frame Figma Mobile `11:834` ou equivalente.

---

## 7. Riscos

| Risco | Mitigação |
|-------|-----------|
| `@trust/ds` aumenta muito o `dist/` | Medir antes/depois; preferir B inicialmente |
| Webfont (Inter Tight) | `font-face` embutido ou fallback system |
| Título vazio (descrição vazia) | Bloquear envio ou título fallback acordado com UX |
| Figma «Mobile» ≠ uso real desktop | Segunda variante de layout ou breakpoints no mesmo componente |

---

## 8. Critérios de aceite

- [ ] **Título** enviado às issues = **quatro primeiras palavras** da descrição após digitação ou ditado (única mudança funcional até IA).
- [ ] Strings de **motivo** enviadas ao Jira **idênticas** às atuais.
- [ ] Comportamento de **board** e restantes fluxos **inalterado** em relação ao estado atual do produto (exceto a regra de título).
- [ ] Visual reproduz hierarquia e tokens principais do Figma (§2.3) e textos do PDF, na medida do escopo de UI acordado.
- [ ] Pós-envio com **Evidência criada**, cards Board/Issue, **Copiar/Acessar/Criar novo/Fechar**.
- [ ] Sem regressão em GitHub, anexos, HAR opcional, captura por região.

---

## 9. Próximo passo

1. Implementar **Fase 1** (título automático) na branch `feature/qa-automation-layout-trust-ds`.  
2. Em paralelo, definir **sheet vs modal** para desktop (só UI).  
3. Revisar com design se `#004D37` deve substituir totalmente `primary-700` Trust ou se há tema «RA» separado.
