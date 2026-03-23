# QAFeedback — feedback de QA para GitHub e/ou Jira

**QAFeedback** é uma extensão para **Google Chrome** (Manifest V3) para equipas de QA, desenvolvimento e produto: quem testa **abre um formulário na própria página**, descreve o problema e pode **enviar para o GitHub**, para o **Jira Cloud (Atlassian)** ou **para os dois** — com título (GitHub), **Motivo da abertura** (Jira, valores alinhados ao vosso quadro), corpo em Markdown, **prints anexados ao Jira** (opcional), **reconhecimento de voz no Chrome** (opcional) e **contexto técnico** opcional (URL, viewport, elemento, consola, pedidos falhados).

O objetivo é **encurtar o caminho entre “vi um bug neste ecrã” e “existe um ticket rastreável”**, com texto padronizado e menos fricção.

---

## O que a extensão faz, na prática

1. **Botão flutuante** (ícone QA) aparece nos sites que a equipa autorizar (staging, localhost, domínio de homologação, etc.).
2. Ao clicar, abre-se um **modal** com separadores **Formulário** / **Preview**:
   - **Destinos** só aparecem se existir token configurado: **GitHub**, **Jira** ou **Ambos** (controlo tipo segmento).
   - **Jira**: campo obrigatório **Motivo da abertura do Bug/Sub-Bug** (lista fixa no código, alinhada ao vosso projeto).
   - **Repositório GitHub** quando o envio inclui GitHub e há vários repos nas opções.
   - **Título** e **O que aconteceu**; ao lado, **microfone** para **voz do Chrome** (`pt-BR` por defeito) ou, nas dicas, ditado nativo do SO.
   - **Prints para o Jira**: ficheiros e/ou **colar imagem** (Ctrl+V) na descrição quando o destino inclui Jira.
   - **Preview** em Markdown; opção **incluir contexto técnico**.
3. **Enviar** corre no **service worker** (GitHub API e/ou Jira REST); em sucesso mostra link(s) e permite copiar URLs.
4. **Tokens** (PAT GitHub, email Atlassian + API token Jira) ficam nas **opções**; o content script não recebe segredos.

---

## Para quem é

- **QA** que reportam em **GitHub Issues** e/ou **Jira Cloud**.
- **Equipas** que querem issues com estrutura parecida e **anexos** no Jira.
- **Quem usa vários repositórios** ou **quadros Jira** e escolhe o destino no envio.

---

## Funcionalidades principais

| Área | Descrição |
|------|-----------|
| **GitHub** | Vários repositórios nas opções; escolha no modal; preview Markdown; contexto técnico opcional. |
| **Jira Cloud** | Criação de issue tipo Bug, motivo de abertura, inferência de site pelo email `@empresa`, quadro via **menu** (lista automática), anexos de imagem. |
| **Opções Jira** | Email + token → lista de **quadros** carrega sozinha; ao **escolher o quadro**, confirma-se projeto e filtro (ex. Squad) e grava-se — sem botão “testar”. |
| **Voz** | **Web Speech API** no Chrome (`pt-BR` por defeito); microfone ao lado dos campos de texto. |
| **UI** | **Shadow DOM** para isolar CSS; ícone redondo a partir de `PRD/capiQA.png`. |

---

## Onde está o código e a documentação

Toda a implementação vive em **`extension/`**.

| Documento | Conteúdo |
|-----------|----------|
| [extension/README.md](extension/README.md) | Instalação, tokens GitHub/Jira, build, primeiro uso, permissões. |
| [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md) | Guia longo: opções, fluxos, Jira, voz, permissões, problemas, arquitetura, scripts. |

**Especificação de produto** e imagens: pasta **[PRD](PRD/)**.

---

## Requisitos e arranque rápido

- **Node.js** 18+
- **Chrome** (MV3)

```bash
cd extension
npm install
npm run build
```

Em **chrome://extensions**, modo de programador → **Carregar sem compactação** → pasta **`extension/dist`**. Pormenores em [extension/README.md](extension/README.md).

---

## Skills do projeto (Cursor)

Em **[`.cursor/skills/`](.cursor/skills/)** há `SKILL.md` (TDD, PRD → plano, testes, etc.), descritos em [`.cursor/skills/README.md`](.cursor/skills/README.md).
