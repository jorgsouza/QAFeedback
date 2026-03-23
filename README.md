# QAFeedback — feedback de QA para GitHub e/ou Jira

**QAFeedback** é uma extensão para **Google Chrome** (Manifest V3) pensada para equipas de QA, desenvolvimento e produto: quem testa **abre um formulário na própria página**, descreve o problema e pode **enviar para o GitHub**, para o **Jira Cloud (Atlassian)** ou **para os dois** — com título (GitHub), **Motivo da abertura** (lista alinhada ao vosso Jira), corpo em Markdown e **contexto técnico** opcional (URL, viewport, elemento, consola, pedidos falhados).

O objetivo é **encurtar o caminho entre “vi um bug neste ecrã” e “existe um ticket rastreável”**, com texto padronizado e menos fricção.

---

## O que a extensão faz, na prática

1. **Botão flutuante** (ícone do capivara QA) aparece nos sites que a equipa autorizar (por exemplo staging, localhost ou o vosso domínio de homologação).
2. Ao clicar, abre-se um **modal escuro** com:
   - destinos **GitHub** e/ou **Jira** (checkboxes);
   - no Jira: **Motivo da abertura do Bug/Sub-Bug** (valores fixos alinhados ao vosso quadro);
   - **repositório GitHub** quando GitHub está ativo;
   - **Formulário** com título (GitHub) e descrição do que aconteceu;
   - separador **Preview** com o **Markdown** do corpo;
   - opção de **incluir contexto técnico**.
3. **Enviar** chama a **API do GitHub** e/ou a **REST API do Jira** no **service worker**; em sucesso mostra link(s) e permite copiar URLs.
4. **Tokens** (PAT GitHub, API token Atlassian + email) ficam nas **opções** e só são usados no background.

Ou seja: **ponte entre o browser onde o QA trabalha e GitHub/Jira**, sem abrir os sites à mão para cada achado.

---

## Para quem é

- **QA / testadores** que reportam defeitos e melhorias e usam **GitHub Issues** e/ou **Jira**.
- **Equipas** que querem issues com **estrutura parecida** (título + secção “O que aconteceu” + bloco opcional de contexto).
- **Quem mantém vários repositórios** (por exemplo um por produto ou por cliente) e quer **escolher o destino** no momento do envio.

---

## Funcionalidades principais

| Área | Descrição |
|------|-----------|
| **Vários repositórios** | Lista configurável; no modal o utilizador escolhe onde abrir a issue. |
| **Preview em Markdown** | Vê o corpo da issue antes de enviar; pode copiar o markdown. |
| **Contexto técnico opcional** | URL, título da página, viewport, último elemento relevante, consola e falhas de rede (conforme configurado). |
| **Opções da extensão** | Token GitHub, repos, **Jira** (URL `*.atlassian.net`, email, API token, projeto, tipo de issue, ID opcional do custom field “Motivo”), **domínios permitidos**. |
| **UI isolada** | Interface do feedback corre dentro de **Shadow DOM**, para não misturar CSS com o site. |
| **Ícone redondo** | Arte `capiQA` processada no build para ícone da barra e botão flutuante. |

Instruções para **token fine-grained**, **primeiro uso** e **“o botão não aparece”** estão na documentação da pasta da extensão (links abaixo).

---

## Onde está o código e a documentação

Toda a implementação vive em **`extension/`**.

| Documento | Conteúdo |
|-----------|----------|
| [extension/README.md](extension/README.md) | Instalação em modo desenvolvedor, token, build, primeiros passos, permissões. |
| [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md) | Guia mais longo: fluxos, resolução de problemas, arquitetura, scripts (`test`, `build`, ícones). |

**Especificação de produto** e imagens de referência: pasta **[PRD](PRD/)** (inclui o documento principal em Markdown e `capiQA.png` usado nos ícones).

---

## Requisitos e arranque rápido

- **Node.js** 18 ou superior  
- **Chrome** (ou Chromium) com suporte a extensões MV3  

```bash
cd extension
npm install
npm run build
```

Depois, em **chrome://extensions**, ative o modo de programador e **carregue a pasta `extension/dist`** como extensão descompactada. Pormenores e testes (`npm test`) estão no [README da extensão](extension/README.md).

---

## Skills do projeto (Cursor)

Em **[`.cursor/skills/`](.cursor/skills/)** há ficheiros `SKILL.md` com fluxos de trabalho (TDD, PRD → plano, testes, mocks, etc.), descritos em [`.cursor/skills/README.md`](.cursor/skills/README.md). Servem sobretudo para quem desenvolve ou evolui o projeto com o Cursor.
