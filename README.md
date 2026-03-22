# QAFeedback — feedback de QA virando issue no GitHub

**QAFeedback** é uma extensão para **Google Chrome** (Manifest V3) pensada para equipas de QA, desenvolvimento e produto: em vez de copiar prints e descrições para o Slack ou para um documento à parte, quem testa **abre um formulário na própria página**, descreve o problema e **cria uma issue no GitHub** com um clique — com título, corpo em Markdown e, se quiser, **contexto técnico** (URL, viewport, elemento em foco, mensagens de consola, pedidos HTTP falhados).

O objetivo é **encurtar o caminho entre “vi um bug neste ecrã” e “existe um ticket rastreável no repositório”**, com texto padronizado e menos fricção.

---

## O que a extensão faz, na prática

1. **Botão flutuante** (ícone do capivara QA) aparece nos sites que a equipa autorizar (por exemplo staging, localhost ou o vosso domínio de homologação).
2. Ao clicar, abre-se um **modal escuro** com:
   - escolha do **repositório GitHub** de destino (pode haver vários pré-configurados);
   - **Formulário** com título e descrição do que aconteceu;
   - separador **Preview** com o **Markdown** que vai ser enviado como corpo da issue;
   - opção de **incluir contexto técnico** para a issue trazer dados úteis a quem vai corrigir.
3. **Criar issue** chama a **API do GitHub**; em caso de sucesso mostra o link da issue e permite copiar o URL.
4. O **token de acesso** (PAT) e as chamadas à API correm no **service worker** da extensão — não fica exposto no script que corre dentro da página.

Ou seja: é uma **ponte entre o browser onde o QA trabalha e o GitHub onde o trabalho é registado**, sem obrigar a abrir o GitHub à mão para cada achado.

---

## Para quem é

- **QA / testadores** que reportam defeitos e melhorias e já usam GitHub Issues.
- **Equipas** que querem issues com **estrutura parecida** (título + secção “O que aconteceu” + bloco opcional de contexto).
- **Quem mantém vários repositórios** (por exemplo um por produto ou por cliente) e quer **escolher o destino** no momento do envio.

---

## Funcionalidades principais

| Área | Descrição |
|------|-----------|
| **Vários repositórios** | Lista configurável; no modal o utilizador escolhe onde abrir a issue. |
| **Preview em Markdown** | Vê o corpo da issue antes de enviar; pode copiar o markdown. |
| **Contexto técnico opcional** | URL, título da página, viewport, último elemento relevante, consola e falhas de rede (conforme configurado). |
| **Opções da extensão** | Token GitHub, lista de repos, **domínios permitidos** (o Chrome pede permissão para sites novos ao guardar). |
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
