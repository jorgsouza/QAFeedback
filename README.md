# QAFeedback

Extensão para **Google Chrome** que ajuda equipas de **QA**, desenvolvimento e produto a **abrir issues no GitHub** e/ou no **Jira Cloud** **sem sair da página** em que estão a testar. Preenches um formulário, vês o texto em Markdown e envias — o objetivo é **menos cliques** entre “encontrei um problema aqui” e “ficou **registado** no sistema”.

---

## O que a extensão faz

### Na página em teste

- **Botão flutuante (FAB)** com ícone de QA nos **domínios** que a equipa autorizar (homologação, staging, `localhost`, etc.).
- **Modal** com **Formulário** e **Preview** em Markdown antes de enviar.
- **Minimizar** o FAB se precisares de mais espaço no ecrã.
- Se o Chrome estiver em modo **“só ao clicar”** na extensão, usa o **ícone da extensão** nessa aba para aparecer o botão de feedback.

### Para onde envia

- **Só GitHub**, **só Jira** ou **os dois** no mesmo envio — conforme tenhas **token GitHub** e/ou **Jira** configurados nas opções.
- **GitHub:** escolhes o **repositório** se tiveres vários na lista.
- **Jira:** escolhes o **motivo da abertura** (Bug/Sub-Bug) na lista definida para o projeto.

### O que podes incluir no relatório

- **Título** e **O que aconteceu** (descrição).
- **Voz:** microfone nos campos (reconhecimento de voz do **Chrome**, **português do Brasil** por defeito, com HTTPS) ou **ditado do sistema** (atalhos do Windows / macOS / Linux — dicas no formulário).
- **Contexto técnico opcional:** URL, viewport, **ecrã e DPR**, indício **desktop / móvel / possível emulação no DevTools**, elemento em que clicaste, resumo de **consola** e **pedidos em falha** na rede (via bridge na página).
- **Prints no Jira:** ficheiros, **colar imagem (Ctrl+V)** na descrição, ou **capturar uma área** do ecrã (retângulo sobre o que está visível no separador).
- **Modo diagnóstico completo** (nas **opções**): ao enviar para o Jira, pode anexar um **ficheiro `.har`** com o tráfego HTTP da aba (para o dev importar no DevTools), com cabeçalhos sensíveis redigidos.

### Depois de enviar

- **Ligações** para abrir a issue no GitHub e/ou no Jira, e opção de **copiar URLs**.

---

## Como usar (resumo)

1. **Configura** uma vez: tokens, domínios, repositórios GitHub e/ou quadro Jira — vê [extension/README.md](extension/README.md).
2. Abre o **site permitido** (com permissão do Chrome, se pedida).
3. Clica no **FAB** (ou no ícone da extensão) → preenche o formulário → **Preview** se quiseres → **Enviar**.

### Falar em vez de escrever

- **Chrome:** microfone ao lado do título e da descrição; clicas outra vez para parar. O áudio é tratado pelo **Google/Chrome**, não pela extensão.
- **Sistema:** foca o campo e usa o ditado nativo (ex. atalhos do Windows). A extensão **não grava áudio** por conta própria.

---

## Quem se beneficia

- Equipas que já usam **GitHub Issues** e/ou **Jira Cloud**.
- QAs que querem **texto mais padronizado** e menos copiar/colar entre o browser e o backoffice.
- Quem gere **vários repositórios** ou **quadros** e escolhe o destino no momento do envio.

---

## Configurar e instalar

- **Utilizadores:** [extension/README.md](extension/README.md) — tokens, domínios, primeiro uso.
- **Desenvolvimento:** Node.js **18+**, depois:

```bash
cd extension
npm install
npm run build
```

Carrega a pasta **`extension/dist`** em **chrome://extensions** (modo desenvolvedor). Permissões, mensagens do service worker e resolução de problemas: [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md).

---

## Onde está o código e a documentação

| Ficheiro | Conteúdo |
|----------|----------|
| [extension/README.md](extension/README.md) | Funcionalidades completas, build, permissões, estrutura do código |
| [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md) | Guia técnico detalhado, page-bridge, mensagens do SW |
| [PRD/](PRD/) | Especificação e imagens de referência |
| [plans/](plans/) | Planos de funcionalidades (ex.: HAR, captura por região) |

No Cursor: [`.cursor/skills/`](.cursor/skills/).
