# Documentação — QA Feedback → GitHub

Extensão **Chrome Manifest V3** que permite abrir **issues no GitHub** a partir da página em teste: botão flutuante (FAB), formulário em modal (Shadow DOM), preview em Markdown e contexto técnico opcional (URL, viewport, elemento clicado, erros de consola, pedidos falhados). O **token** e as chamadas à API GitHub ficam no **service worker**; o content script não recebe o PAT.

---

## Índice

1. [Instalação para desenvolvimento](#instalação-para-desenvolvimento)
2. [Configuração (opções)](#configuração-opções)
3. [Uso no dia a dia](#uso-no-dia-a-dia)
4. [Permissões](#permissões)
5. [Resolução de problemas](#resolução-de-problemas)
6. [Arquitetura e ficheiros](#arquitetura-e-ficheiros)
7. [Ícones (arte circular)](#ícones-arte-circular)

---

## Instalação para desenvolvimento

**Requisitos:** Node.js 18+.

```bash
cd extension
npm install
npm run build
```

- A saída fica em **`extension/dist/`**.
- Em **chrome://extensions**, ative **Modo do desenvolvedor** → **Carregar sem compactação** → escolha a pasta **`extension/dist`**.
- Após alterar código: `npm run build` de novo e use **Recarregar** na extensão.

O alvo `build` executa automaticamente **`npm run icons`**, que lê **`../PRD/capiQA.png`**, aplica máscara circular e gera `public/qa.png` e `public/icons/icon*.png`.

---

## Configuração (opções)

Abra a página de opções pelo menu da extensão, pelo atalho em **chrome://extensions**, ou pelo link **Configurações** no modal de feedback.

| Campo | Descrição |
|--------|-----------|
| **GitHub token** | PAT classic (ex.: escopo `repo`) ou **fine-grained** só com **Issues** (read/write) nos repositórios desejados. Na página há instruções passo a passo com link para [Fine-grained tokens](https://github.com/settings/personal-access-tokens). |
| **Testar conexão e listar repos** | Valida o token e preenche a caixa de repositórios com o que a API devolve. Depois confira e clique em **Salvar**. |
| **Repositórios destino** | Uma linha por repo: `owner/repo`, URL do GitHub ou `owner/repo|Nome no menu`. No modal, o QA escolhe o destino. |
| **Domínios permitidos** | Hostnames (ex.: `localhost`, `jorgesouza.dev.br`). Ao **Salvar**, o Chrome pode pedir permissão para hosts novos. |

O token é guardado em **`chrome.storage.local`** e só é usado no **background** ao criar issues.

---

## Uso no dia a dia

1. Visite um site cujo host está na lista e com permissão concedida.
2. Se a extensão estiver em **“Ao clicar na extensão”**, clique no **ícone da extensão** na barra para injetar o UI nesse separador (`activeTab` + `scripting`).
3. Use o **botão circular** (capi QA) para abrir o modal.
4. Preencha **título** e **o que aconteceu**, escolha o repositório (se houver vários), opcionalmente inclua **contexto técnico**.
5. **Preview** mostra o Markdown do corpo da issue; **Criar issue** envia via API.

---

## Permissões

- **`storage`** — definições e token.
- **`scripting`**, **`activeTab`** — injeção do content script quando necessário.
- **`host_permissions`** — `api.github.com` e localhost fixos; outros sites entram como **`optional_host_permissions`** quando grava nas opções.

---

## Resolução de problemas

### `Extension context invalidated` / erro no content script

Ocorre quando a extensão foi **recarregada** ou **atualizada** em `chrome://extensions`, mas o **separador do site não foi atualizado**. O script antigo perde a ligação ao service worker.

**Solução:** recarregue a página do site (**F5** ou Cmd+R). O código da extensão também evita lançar erros não tratados nesse cenário (por exemplo ao resolver URLs de recursos); mesmo assim, **F5** restabelece tudo.

### O botão de feedback não aparece

1. Ícone da extensão → **“Esta extensão pode ler e alterar dados do site”** → escolha o site em questão (ou **em todos os sites**, se fizer sentido). Se estiver só **“Ao clicar”**, é preciso **clicar no ícone** para injetar o botão nessa aba.
2. Confirme que o **domínio** (sem `https://`) está nas opções e que aceitou a permissão ao **Salvar**.
3. Páginas `chrome://`, Web Store, PDF interno, etc. **não** permitem injeção.

### “Nenhum repositório configurado”

Configure linhas em **Repositórios destino** e clique em **Salvar**. Use **Testar conexão** para pré-preencher a lista.

### 401 / 403 na API GitHub

Token em falta, expirado, ou sem permissão **Issues** no repositório (fine-grained) ou escopo insuficiente (classic).

### Linha no `content.js` aponta para CSS (ex.: `color: #6ee7b7`)

O ficheiro é um **bundle** (JavaScript + string grande de CSS). O número de linha **não** indica que o erro é de CSS; costuma ser **contexto invalidado** ou outra exceção nesse bundle. Use a mensagem de erro e a secção acima.

---

## Arquitetura e ficheiros

| Área | Caminho |
|------|---------|
| Entrada content | `src/content/content.tsx` |
| UI modal + FAB | `src/ui/FeedbackApp.tsx`, `src/ui/shadow-styles.ts` |
| Opções | `src/options/OptionsApp.tsx`, `options.html` |
| Service worker | `src/background/service-worker.ts` |
| Cliente GitHub | `src/shared/github-client.ts` |
| Corpo da issue | `src/shared/issue-builder.ts` |
| Contexto / bridge | `src/shared/context-collector.ts`, `src/injected/page-bridge.ts` |
| Storage | `src/shared/storage.ts` |
| Mensagens / contexto invalidado | `src/shared/extension-runtime.ts` |

**Mensagens** (`chrome.runtime.sendMessage`): `LIST_REPO_TARGETS`, `OPEN_OPTIONS`, `CREATE_ISSUE`, `TEST_GITHUB` (opções → background).

---

## Ícones (arte circular)

- Fonte: **`PRD/capiQA.png`** (repositório pai da pasta `extension`).
- Comando: **`npm run icons`** (também no início de `npm run build`).
- Gera **`public/qa.png`** (FAB) e **`public/icons/icon{16,32,48,128}.png`** com máscara circular para cantos transparentes.

---

## Referência rápida de scripts

| Comando | Efeito |
|---------|--------|
| `npm run icons` | Regenera PNGs a partir de `PRD/capiQA.png` |
| `npm run build` | Ícones + Vite (shell + content) + page-bridge + `manifest.json` |
| `npm run check` | `tsc --noEmit` |
| `npm run dev` | Igual ao `build` (nome legado) |

Para mais detalhes de primeiro uso e tabela PRD resumida, veja também **[README.md](./README.md)**.
