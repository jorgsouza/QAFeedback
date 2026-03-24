# QAFeedback

Extensão para **Google Chrome** que ajuda equipas de **QA**, desenvolvimento e produto a **abrir issues no GitHub** e/ou no **Jira Cloud** sem sair da página que estão a testar. Preenche um formulário, vê o resultado em Markdown e envia — o objetivo é menos cliques entre “encontrei um problema aqui” e “ficou registado no sistema”.

---

## O que a extensão faz

- Mostra um **botão flutuante** (ícone de QA) nos sites que a equipa autorizar (por exemplo homologação, staging ou `localhost`).
- Abre um **formulário** na própria página com:
  - **Para onde enviar:** só **GitHub**, só **Jira** ou **os dois** (consoante tenha configurado tokens nas opções).
  - No **Jira:** lista **Motivo da abertura do Bug/Sub-Bug** (valores definidos para o vosso projeto).
  - No **GitHub:** título da issue e repositório de destino, se tiver vários configurados.
  - **Descrição** do problema, com opção de juntar **contexto técnico** (URL, tamanho da janela, erros de consola ou pedidos falhados, quando está ativo).
  - No **Jira**, pode **anexar capturas de ecrã** (ficheiros ou colar imagem na caixa de descrição com Ctrl+V).
- Há um separador **Preview** para ver antecipadamente o texto em Markdown.
- Depois de enviar, mostra **links** para abrir ou copiar o ticket no GitHub e/ou no Jira.

---

## Como usar (no dia a dia)

1. **Instale e configure** a extensão uma vez (tokens, domínios, repositórios e/ou quadro Jira). Resumo em [extension/README.md](extension/README.md) — primeiro uso em poucos passos.
2. Abra o **site onde testa** (tem de estar na lista de domínios permitidos e com permissão do Chrome, se pedida).
3. Clique no **botão redondo de QA** no canto da página para abrir o formulário.
4. Escolha **GitHub**, **Jira** ou **Ambos**, se aparecer essa opção.
5. No Jira, escolha o **motivo da abertura** na lista.
6. Preencha o **Título** (resumo) e **O que aconteceu** (descrição). Se o envio incluir **Jira**, pode **anexar imagens** (área dedicada ou colar com Ctrl+V na descrição).
7. Veja o **Preview** se quiser confirmar o texto.
8. Clique em **Enviar** e use os links para abrir ou copiar a issue.

### Falar em vez de escrever (opcional)

Ao lado dos campos **Título** e **O que aconteceu** há um **ícone de microfone**.

- **No Chrome:** ao clicar, o campo fica ativo e pode **ditar em português** — a transcrição é feita pelo **reconhecimento de voz do próprio Chrome** (por defeito em **português do Brasil**). Volte a clicar no microfone para parar de escutar. É preciso **HTTPS** e permitir o microfone se o browser pedir.
- **Preferir o ditado do sistema?** Pode **clicar dentro do campo de texto** e usar o atalho habitual do **Windows**, **macOS** ou **Linux** (por exemplo ditado por voz). Ao passar o rato sobre o campo ou o microfone, as **dicas** do formulário relembram esse caminho. A extensão não grava áudio por conta própria: quem trata da voz é o **Chrome** ou o **sistema operativo**.

---

## Quem se beneficia

- Equipas que já usam **GitHub Issues** e/ou **Jira Cloud** para bugs e melhorias.
- QAs que querem **texto mais uniforme** e **menos copy-paste** entre o browser e o backoffice.
- Quem gere **vários repositórios** ou **quadros** e escolhe o destino no momento do envio.

---

## Configurar e instalar

- **Quem só vai usar a extensão:** siga [extension/README.md](extension/README.md) (tokens, domínios, lista de repositórios no GitHub, email + token + escolha do quadro no Jira).
- **Quem desenvolve:** precisa de **Node.js 18+**, depois:

```bash
cd extension
npm install
npm run build
```

Carregue a pasta **`extension/dist`** em **chrome://extensions** (modo programador). Mais detalhes, permissões e resolução de problemas: [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md).

---

## Onde está o código e documentação extra

| Ficheiro | Conteúdo |
|----------|----------|
| [extension/README.md](extension/README.md) | Primeiro uso, GitHub e Jira, build |
| [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md) | Guia completo, permissões, mensagens técnicas, page-bridge |
| [PRD/](PRD/) | Especificação e imagens de referência |

Para quem programa no Cursor: [`.cursor/skills/`](.cursor/skills/).
