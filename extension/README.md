# QA Feedback → GitHub (Chrome MV3)

Extensão alinhada ao PRD: botão flutuante em páginas permitidas, modal com abas **Formulário** / **Preview**, criação de issue via API do GitHub, token em `chrome.storage.local`, contexto técnico opcional e UI no **Shadow DOM**.

**Documentação detalhada (configuração, permissões, erros, arquitetura):** [DOCUMENTATION.md](./DOCUMENTATION.md)

## Requisitos

- Node 18+
- Conta GitHub com permissão para criar issues no repositório

## Token GitHub

- **PAT classic**: escopo `repo` (ou pelo menos acesso ao repo alvo).
- **Fine-grained**: permissão **Issues** (read/write) no repositório.

O token fica só no storage local da extensão; a criação da issue ocorre no **service worker**, não no content script.

## Build

```bash
cd extension
npm install
npm run build
```

O `build` executa **`npm run icons`** primeiro (lê `../PRD/capiQA.png`, aplica máscara circular e gera `public/qa.png` + `public/icons/`).

Saída em `extension/dist/`. Carregue a pasta `dist` em **chrome://extensions** → **Modo do desenvolvedor** → **Carregar sem compactação**.

## Erro “Extension context invalidated”

Aparece se recarregar a extensão em `chrome://extensions` **sem** atualizar o separador do site. **Recarregue a página (F5).** O content script trata este caso para não rebentar com exceções não capturadas; mesmo assim o separador antigo fica desligado do novo service worker até dar refresh. Detalhes em [DOCUMENTATION.md](./DOCUMENTATION.md#extension-context-invalidated--erro-no-content-script).

## Primeiro uso

1. Abra **Opções da extensão** (ícone → Configurações, ou pelo link no modal).
2. Preencha token e **repositórios destino** (um por linha: `owner/repo`, URL do GitHub ou `owner/repo|Nome no menu`). No modal de feedback o QA **escolhe** em qual repo abrir a issue. Domínios permitidos: um por linha. Padrão: `localhost` e `127.0.0.1`.
3. Clique em **Salvar** (o Chrome pode pedir permissão para hosts novos).
4. **Testar conexão e listar repos** valida o token e preenche automaticamente a lista com os repositórios que a API GitHub devolve para esse token (PAT com escopo `repo` ou fine-grained com repositórios escolhidos). Depois clique em **Salvar** para guardar.
5. Abra um site cujo host está na lista (e com permissão concedida); o botão **Feedback QA** deve aparecer.

### Botão não aparece?

1. **Permissão de leitura do site (muito comum)**  
   Clique com o **botão direito** no ícone da extensão → **“Esta extensão pode ler e alterar dados do site”** / *This can read and change site data*.  
   - Se estiver **“Ao clicar na extensão”** / *When you click the extension*, o botão **não** é injetado ao carregar a página.  
   - Escolha **“Em jorgesouza.dev.br”** / *On [site]* (ou **“Em todos os sites”** se fizer sentido para você).  
   - **Alternativa:** mantendo “ao clicar”, **clique uma vez no ícone da extensão** na aba do site — com a permissão `activeTab`, o botão é injetado na hora.

2. Recarregue a extensão em `chrome://extensions` depois do `npm run build`.

3. Em **Salvar** nas opções, aceite o prompt de permissão do Chrome para os hosts listados (sites que não sejam localhost).

4. Use o **nome do site** nas linhas de domínio (ex. `jorgesouza.dev.br`); também entram padrões `*.seu-dominio` para cobrir `www`.

5. Abra **Inspecionar** no *service worker* da extensão e veja mensagens `[QA Feedback]` no console.

## Permissões

- `storage`, `scripting`: configuração e registro do content script.
- `https://api.github.com/*`: chamadas à API.
- `localhost` / `127.0.0.1`: injeção local sem passo extra.
- `optional_host_permissions` `http(s)://*/*`: permite solicitar **somente** os hosts que você adicionar ao salvar (não é `<all_urls>` fixo no content script).

## Estrutura (PRD)

| Área | Caminho |
|------|---------|
| Content + UI | `src/content/`, `src/ui/` |
| Opções | `src/options/`, `options.html` |
| Service worker | `src/background/service-worker.ts` |
| GitHub | `src/shared/github-client.ts` |
| Corpo da issue | `src/shared/issue-builder.ts` |
| Contexto (página, elemento, console, fetch falho) | `src/shared/context-collector.ts` |
| Storage | `src/shared/storage.ts` |
| Sanitização | `src/shared/sanitizer.ts` |

## Scripts

- `npm run icons` — regenera ícones a partir de `PRD/capiQA.png`.
- `npm run build` — ícones + produção (`dist/`).
- `npm run dev` — igual ao `build` (atalho).
- `npm run check` — `tsc --noEmit`.

Não há hot reload dedicado; durante o desenvolvimento, altere o código, rode `npm run build` e clique em **Recarregar** na página da extensão.
