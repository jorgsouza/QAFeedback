# QAFeedback

Extensão para **Google Chrome** que ajuda **equipes** de **QA**, desenvolvimento e produto a **abrir issues no GitHub** e/ou no **Jira Cloud** sem sair da página em que estão **testando**. Você preenche um formulário, vê o resultado em Markdown e envia — o objetivo é ter **menos cliques** entre “encontrei um problema aqui” e “ficou **registrado** no sistema”.

---

## O que a extensão faz

- Mostra um **botão flutuante** (ícone de QA) nos sites que a **equipe** autorizar (por exemplo homologação, staging ou `localhost`).
- Abre um **formulário** na própria página com:
  - **Para onde enviar:** só **GitHub**, só **Jira** ou **os dois** (conforme você tenha configurado tokens nas opções).
  - No **Jira:** lista **Motivo da abertura do Bug/Sub-Bug** (valores definidos para o **seu** projeto).
  - No **GitHub:** título da issue e repositório de destino, se tiver vários configurados.
  - **Descrição** do problema, com opção de juntar **contexto técnico** (URL, tamanho da janela, erros de **console** ou **requisições que falharam**, quando a opção está ativa).
  - No **Jira**, dá para **anexar capturas de tela** (**arquivos** ou colar imagem no campo de descrição com Ctrl+V).
- Há uma aba **Preview** para ver **antes** o texto em Markdown.
- Depois de enviar, mostra **links** para abrir ou copiar o ticket no GitHub e/ou no Jira.

---

## Como usar (no dia a dia)

1. **Instale e configure** a extensão uma vez (tokens, domínios, repositórios e/ou quadro Jira). Resumo em [extension/README.md](extension/README.md) — primeiro uso em poucos passos.
2. Abra o **site em que você testa** (ele **precisa** estar na lista de domínios permitidos e com permissão do Chrome, se solicitada).
3. Clique no **botão redondo de QA** no canto da página para abrir o formulário.
4. Escolha **GitHub**, **Jira** ou **Ambos**, se essa opção aparecer.
5. No Jira, escolha o **motivo da abertura** na lista.
6. Preencha o **Título** (resumo) e **O que aconteceu** (descrição). Se o envio incluir **Jira**, você pode **anexar imagens** (área dedicada ou colar com Ctrl+V na descrição).
7. Veja o **Preview** se quiser conferir o texto.
8. Clique em **Enviar** e use os links para abrir ou copiar a issue.

### Falar em vez de escrever (opcional)

Ao lado dos campos **Título** e **O que aconteceu** há um **ícone de microfone**.

- **No Chrome:** ao clicar, o campo fica ativo e você pode **ditar em português** — a transcrição é feita pelo **reconhecimento de voz do próprio Chrome** (**português do Brasil** por **padrão**). Clique de novo no microfone para parar de ouvir. É necessário **HTTPS** e permitir o microfone se o **navegador** pedir.
- **Prefere o ditado do sistema?** **Clique dentro do campo de texto** e use o atalho habitual do **Windows**, **macOS** ou **Linux** (por exemplo ditado por voz). Ao **passar o mouse** sobre o campo ou o microfone, as **dicas** do formulário lembram esse jeito. A extensão **não grava áudio** por conta própria: quem cuida da voz é o **Chrome** ou o **sistema operacional**.

---

## Quem se beneficia

- **Equipes** que já usam **GitHub Issues** e/ou **Jira Cloud** para bugs e melhorias.
- QAs que querem **texto mais padronizado** e **menos copiar e colar** entre o navegador e o backoffice.
- Quem administra **vários repositórios** ou **quadros** e escolhe o destino na hora do envio.

---

## Configurar e instalar

- **Quem só vai usar a extensão:** siga [extension/README.md](extension/README.md) (tokens, domínios, lista de repositórios no GitHub, e-mail + token + escolha do quadro no Jira).
- **Quem desenvolve:** precisa do **Node.js 18+**, depois:

```bash
cd extension
npm install
npm run build
```

Carregue a pasta **`extension/dist`** em **chrome://extensions** (modo desenvolvedor). Mais detalhes, permissões e resolução de problemas: [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md).

---

## Onde está o código e a documentação extra

| Arquivo | Conteúdo |
|---------|----------|
| [extension/README.md](extension/README.md) | Primeiro uso, GitHub e Jira, build |
| [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md) | Guia completo, permissões, mensagens técnicas, page-bridge |
| [PRD/](PRD/) | Especificação e imagens de referência |

Para quem programa no Cursor: [`.cursor/skills/`](.cursor/skills/).
