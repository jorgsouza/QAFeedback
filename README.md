# QAFeedback

Extensão para **Google Chrome** que ajuda equipes de **QA**, desenvolvimento e produto a **abrir issues no GitHub** e/ou no **Jira Cloud** **sem sair da página** em que estão testando. Você preenche um formulário, vê o texto em Markdown e envia — o objetivo é **menos cliques** entre “encontrei um problema aqui” e “ficou **registrado** no sistema”.

---

## O que a extensão faz

### Na página em teste

- **Botão flutuante (FAB)** com ícone de QA nos **domínios** que a equipe autorizar (homologação, staging, `localhost`, etc.).
- **Painel** (sheet à direita) com **Formulário** e **Preview** em Markdown antes de enviar; dá para **recolher** com a seta no cabeçalho e reabrir pelo **FAB** sem perder o rascunho.
- **Minimizar** o FAB se precisar de mais espaço na **tela**.
- Se o Chrome estiver em modo **“só ao clicar”** na extensão, use o **ícone da extensão** nessa aba para aparecer o botão de feedback.

### Para onde envia

- **Só GitHub**, **só Jira** ou **os dois** no mesmo envio — conforme você tenha **token do GitHub** e/ou **Jira** configurados nas opções.
- **GitHub:** você escolhe o **repositório** se tiver vários na lista.
- **Jira:** você escolhe o **motivo da abertura** (Bug/Sub-Bug) na lista definida para o projeto; no modal pode escolher o **quadro Software** quando há allowlist de IDs no build. Se o **filtro JQL do quadro** não aceitar **Bug** mas aceitar **Task**, a extensão cria como **Task** automaticamente.

### O que você pode incluir no relatório

- **Título** e **O que aconteceu** (descrição).
- **Voz:** microfone nos campos (reconhecimento de voz do **Chrome**, **português do Brasil** por **padrão**, com HTTPS) ou **ditado do sistema** (atalhos do Windows / macOS / Linux — dicas no formulário).
- **Contexto técnico opcional:** URL, viewport, **tela e DPR**, indício **desktop / móvel / possível emulação no DevTools**, **linha do tempo** de interação, **requisições relevantes** (fetch/XHR), **estado visual** e **dicas de DOM** quando detetados, **erros de runtime** e **sinais de performance** (best-effort), narrativa (**Resumo** / leitura rápida), elemento em que você clicou, resumo do **console** — via **page-bridge** e montagem no `context-collector` (ver [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md)).
- **Prints no Jira:** arquivos, **colar imagem (Ctrl+V)** na descrição, ou **capturar uma área** da tela (retângulo sobre o que está visível na **aba**).
- **Modo diagnóstico completo** (nas **opções**): ao enviar para o Jira, pode anexar um **arquivo `.har`** com o tráfego HTTP da aba (para o dev importar no DevTools), com cabeçalhos sensíveis redigidos. No formulário, o texto explicativo aparece num **ícone de informação** (tooltip); **bolinhas verdes** indicam token GitHub/Jira configurado.

### Depois de enviar

- **Links** para abrir a issue no GitHub e/ou no Jira, e opção de **copiar URLs**.

---

## Como usar (resumo)

1. **Configure** uma vez: tokens, domínios, repositórios GitHub e/ou quadro Jira (e opcionalmente **allowlist de IDs de quadro** no `.env` do build) — veja [extension/README.md](extension/README.md).
2. Abra o **site permitido** (com permissão do Chrome, se pedida).
3. Clique no **FAB** (ou no ícone da extensão) → preencha o formulário → **Preview** se quiser → **Enviar**.

### Falar em vez de escrever

- **Chrome:** microfone ao lado do título e da descrição; clique outra vez para parar. O áudio é tratado pelo **Google/Chrome**, não pela extensão.
- **Sistema:** foque o campo e use o ditado nativo (ex.: atalhos do Windows). A extensão **não grava áudio** por conta própria.

---

## Quem se beneficia

- Equipes que já usam **GitHub Issues** e/ou **Jira Cloud**.
- QAs que querem **texto mais padronizado** e menos copiar/colar entre o navegador e o backoffice.
- Quem gerencia **vários repositórios** ou **quadros** e escolhe o destino no momento do envio.

---

## Configurar e instalar

- **Usuários:** [extension/README.md](extension/README.md) — tokens, domínios, primeiro uso.
- **Desenvolvimento:** Node.js **18+**, depois:

```bash
cd extension
npm install
npm run build
```

Carregue a pasta **`extension/dist`** em **chrome://extensions** (modo desenvolvedor). Permissões, mensagens do service worker e resolução de problemas: [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md).

---

## Onde está o código e a documentação

| Arquivo | Conteúdo |
|---------|----------|
| [extension/README.md](extension/README.md) | Funcionalidades completas, build, permissões, estrutura do código |
| [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md) | Guia técnico detalhado, page-bridge, mensagens do SW |
| [PRD/](PRD/) | Especificação e imagens de referência |
| [plans/](plans/) | Planos de funcionalidades (ex.: [contexto rico para issues](plans/prd-features-context-capture.md), HAR, captura por região, rota SPA, layout Figma) — vários com secção *Estado da implementação* |

No Cursor: [`.cursor/skills/`](.cursor/skills/).
