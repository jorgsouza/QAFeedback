# 1. Visão geral

Criar uma extensão para Google Chrome que permita ao QA registrar bugs diretamente da página em que está testando, por meio de um botão flutuante de feedback. A extensão abrirá um modal para preenchimento do reporte, exibirá um preview final da issue e criará a issue diretamente no repositório GitHub configurado.

O foco do MVP é **melhorar a qualidade do reporte** com **baixa fricção**, mantendo uma implementação simples, confiável e segura o suficiente para testes reais com um grupo pequeno de usuários.

---

## 2. Problema

Hoje o processo de abertura de bugs tende a ser manual, inconsistente e sujeito a perda de contexto. Isso gera issues com pouca qualidade, mais idas e vindas entre QA e desenvolvimento e maior tempo até o entendimento real do problema.

O MVP deve resolver isso permitindo que o QA:

- abra uma issue sem sair do fluxo de teste;
    
- tenha um formulário simples e padronizado;
    
- revise o conteúdo final antes do envio;
    
- envie diretamente para o GitHub;
    
- inclua contexto técnico básico automaticamente.
    

---

## 3. Objetivo do MVP

Permitir que o QA abra **issues mais claras e padronizadas** no GitHub, diretamente da página testada, com o mínimo de atrito possível.

### Critério principal de sucesso

**Qualidade das issues criadas**

Sinais esperados:

- issues mais claras;
    
- menos necessidade de pedir contexto adicional;
    
- melhor entendimento inicial por dev/PM.
    

### Critério secundário

**Conconfiabilidade**

Sinais esperados:

- a extensão não perde o conteúdo digitado;
    
- falhas de envio são tratadas claramente;
    
- o usuário consegue tentar novamente ou copiar o conteúdo.
    

---

## 4. Escopo do MVP

### Incluído

- botão flutuante de feedback na página;
    
- botão sempre visível;
    
- posição fixa no canto inferior direito;
    
- opção de minimizar;
    
- modal com abas **Formulário** e **Preview**;
    
- criação direta de issue no GitHub;
    
- configuração de **1 repositório por vez**;
    
- token salvo em `chrome.storage.local`;
    
- botão para testar conexão;
    
- botão para apagar token;
    
- título manual;
    
- sem labels;
    
- campos obrigatórios:
    
    - Título
        
    - O que aconteceu
        
- campos opcionais:
    
    - Passos para reproduzir
        
    - Resultado esperado
        
    - Resultado atual
        
- contexto técnico ligado por padrão, com opção de desligar;
    
- preview final da issue antes do envio;
    
- tratamento de erro mantendo tudo preenchido;
    
- opção de copiar o conteúdo gerado;
    
- estado de sucesso com link da issue criada;
    
- opção de copiar URL da issue;
    
- limpeza do estado apenas ao fechar ou clicar em “novo feedback”;
    
- funcionamento apenas em domínios permitidos/configurados;
    
- presets iniciais:
    
    - `localhost`
        
    - `127.0.0.1`
        

### Fora do MVP

- login/OAuth com GitHub;
    
- descoberta automática de repositórios;
    
- múltiplos repositórios;
    
- labels;
    
- IA para melhorar o texto;
    
- transcrição por áudio;
    
- upload automático de imagem;
    
- captura completa de network;
    
- cookies, tokens, payloads completos e responses completas;
    
- seleção manual de elemento via modo inspeção;
    
- publicação na Chrome Web Store.
    

---

## 5. Usuário-alvo

### Usuário principal

QA que testa aplicações web e precisa abrir bugs no GitHub com rapidez e qualidade.

### Contexto de uso

- ambientes locais;
    
- homologação;
    
- domínios específicos configurados manualmente;
    
- uso inicial por você e depois por um grupo pequeno de QAs/devs.
    

---

## 6. Fluxo principal do usuário

### Configuração inicial

1. Usuário abre a página de configurações da extensão.
    
2. Preenche:
    
    - GitHub Token
        
    - Owner
        
    - Repo
        
3. Visualiza domínios permitidos.
    
4. Pode adicionar/remover domínios.
    
5. Clica em **Testar conexão**.
    
6. Se válido, começa a usar.
    

### Fluxo de abertura de issue

1. QA acessa um domínio permitido.
    
2. Visualiza o botão flutuante de feedback.
    
3. Clica no botão.
    
4. Modal é aberto.
    
5. Preenche:
    
    - título
        
    - o que aconteceu
        
    - opcionais
        
6. Decide manter ou desligar o contexto técnico.
    
7. Visualiza aba **Preview**.
    
8. Envia.
    
9. Em caso de sucesso:
    
    - vê confirmação;
        
    - vê link da issue;
        
    - pode copiar a URL.
        
10. Em caso de erro:
    

- vê erro claro;
    
- dados permanecem preenchidos;
    
- pode tentar novamente;
    
- pode copiar o conteúdo gerado.
    

---

## 7. Requisitos funcionais

### RF-01 — Botão flutuante

A extensão deve injetar um botão flutuante nas páginas de domínios permitidos.

### RF-02 — Minimizar botão

O botão deve poder ser minimizado/escondido.

### RF-03 — Modal de feedback

Ao clicar no botão, a extensão deve abrir um modal de feedback.

### RF-04 — Abas do modal

O modal deve possuir duas abas:

- Formulário
    
- Preview
    

### RF-05 — Campos obrigatórios

O formulário deve exigir:

- título
    
- o que aconteceu
    

### RF-06 — Campos opcionais

O formulário pode conter:

- passos para reproduzir
    
- resultado esperado
    
- resultado atual
    

### RF-07 — Configurações

A extensão deve possuir uma página de configurações com:

- GitHub Token
    
- Owner
    
- Repo
    
- domínios permitidos
    
- botão Testar conexão
    
- botão Apagar token
    

### RF-08 — Armazenamento local

As configurações devem ser salvas em `chrome.storage.local`.

### RF-09 — Teste de conexão

A extensão deve validar:

- token válido;
    
- acesso ao repositório;
    
- possibilidade de criar issues;
    
- se issues estão habilitadas no repo.
    

### RF-10 — Criação de issue

A extensão deve criar issues diretamente via API do GitHub.

### RF-11 — Preview

Antes do envio, a extensão deve montar e exibir o preview final da issue.

### RF-12 — Contexto técnico opcional

O contexto técnico deve vir habilitado por padrão, mas o QA pode desligá-lo.

### RF-13 — Tratamento de erro

Em caso de falha no envio:

- manter todos os campos preenchidos;
    
- exibir mensagem clara;
    
- permitir tentar novamente;
    
- permitir copiar conteúdo.
    

### RF-14 — Tratamento de sucesso

Em caso de sucesso:

- exibir confirmação;
    
- exibir link da issue criada;
    
- permitir copiar URL;
    
- manter estado até o usuário fechar ou iniciar novo feedback.
    

### RF-15 — Atalho para configurações

O modal deve ter um link/atalho para a página de configurações.

---

## 8. Requisitos de contexto técnico

Quando habilitado, o contexto técnico deve incluir:

### Página

- URL
    
- título da página
    
- user agent
    
- timestamp
    
- viewport
    

### Elemento afetado

- último elemento clicado ou focado
    
- tag
    
- id
    
- classes
    
- atributos seguros, quando aplicável
    

### Console

- erros e warnings limitados
    

### Requests com falha

- método
    
- endpoint sanitizado
    
- status code
    
- mensagem resumida
    

### Regras de limite

- até 5 console errors/warnings
    
- até 5 requests com falha
    
- truncar mensagens longas
    
- omitir seções vazias
    

### Não deve incluir no MVP

- cookies
    
- tokens
    
- headers completos
    
- payloads completos
    
- responses completas
    
- network dump completo
    
- valores sensíveis de inputs
    

---

## 9. Requisitos não funcionais

### RNF-01 — Baixo atrito

O fluxo deve ser simples o suficiente para o QA usar sem resistência.

### RNF-02 — Segurança mínima aceitável

A extensão deve pedir apenas permissões mínimas necessárias.

### RNF-03 — Isolamento de UI

A interface injetada deve usar **Shadow DOM** para reduzir conflito com CSS/JS da aplicação testada.

### RNF-04 — Clareza de erro

Erros devem ser específicos e compreensíveis.

### RNF-05 — Portabilidade

O MVP deve nascer genérico o suficiente para testes fora do contexto corporativo.

---

## 10. Arquitetura proposta

### Stack

- React
    
- Vite
    
- Chrome Extension
    
- Manifest V3
    

### Módulos mínimos

- `content-script`
    
- `ui/components`
    
- `settings`
    
- `github-client`
    
- `issue-builder`
    
- `context-collector`
    
- `storage`
    
- `sanitizer`
    

### Princípios

- boundaries claros;
    
- responsabilidades pequenas;
    
- sem backend no MVP;
    
- sem abstração excessiva.
    

---

## 11. Permissões esperadas

A extensão deve pedir apenas o mínimo necessário, incluindo:

- `storage`
    
- permissões de host apenas para domínios configurados
    
- o estritamente necessário para injetar UI e coletar contexto básico
    

Evitar:

- `<all_urls>`
    
- permissões excessivas
    
- qualquer acesso mais amplo que o necessário para o MVP
    

---

## 12. Formato sugerido da issue

### Título

Definido manualmente pelo QA.

### Corpo

```md
## O que aconteceu
{descricao}

## Passos para reproduzir
{passos}

## Resultado esperado
{esperado}

## Resultado atual
{atual}

## Contexto técnico
- URL: {url}
- Página: {pageTitle}
- Data/Hora: {timestamp}
- Navegador: {userAgent}
- Viewport: {viewport}

## Elemento afetado
- Tag: {tag}
- ID: {id}
- Classes: {classes}

## Console
{consoleErrors}

## Requests com falha
{failedRequests}
```

Seções opcionais vazias devem ser omitidas.

---

## 13. Estratégia de rollout

### Fase inicial

- uso local/manual em modo developer;
    
- começando por você;
    
- depois liberar para grupo pequeno de QAs/devs.
    

### Sem Chrome Web Store no MVP

A distribuição será manual por build local.

---

## 14. Slice vertical inicial

### Slice 1 — Ponta a ponta mínima

Objetivo: provar o fluxo central do produto.

Inclui:

- options page mínima;
    
- token, owner, repo;
    
- testar conexão;
    
- botão flutuante;
    
- modal;
    
- título + o que aconteceu;
    
- preview;
    
- criação real de issue;
    
- sucesso com link;
    
- erro preservando conteúdo.
    

### Ainda não entra neste primeiro slice

- coleta técnica automática completa;
    
- domínios permitidos refinados;
    
- requests com falha;
    
- elemento clicado/focado;
    
- presets mais sofisticados.
    

---

## 15. Riscos do MVP

### Risco 1 — UX parecer mais burocrática que o GitHub manual

Mitigação:

- reduzir campos obrigatórios;
    
- manter preview simples;
    
- feedback claro no sucesso/erro.
    

### Risco 2 — Problemas com permissões/token

Mitigação:

- botão Testar conexão;
    
- mensagens específicas de erro;
    
- opção de apagar token.
    

### Risco 3 — Contexto técnico poluir a issue

Mitigação:

- limites por quantidade;
    
- truncamento;
    
- sanitização;
    
- opção de desligar contexto técnico.
    

### Risco 4 — Percepção de invasividade

Mitigação:

- domínios permitidos;
    
- permissões mínimas;
    
- clareza sobre o que é coletado.
    

---

## 16. Futuras evoluções

- múltiplos repositórios;
    
- OAuth/login GitHub;
    
- labels;
    
- templates por projeto;
    
- presets corporativos;
    
- screenshot com upload real;
    
- transcrição por voz;
    
- IA para melhorar descrição/título;
    
- modo de inspeção manual;
    
- publicação na Chrome Web Store.
    

---

## 17. Decisão final do MVP

Este MVP deve ser construído como uma **extensão leve, confiável e prática**, com foco em abrir **issues melhores** no GitHub a partir do contexto da página, sem tentar resolver tudo de uma vez.

O objetivo não é criar a versão definitiva da ferramenta, mas sim provar rapidamente que:

1. o QA usa o fluxo;
    
2. a issue sai melhor;
    
3. o processo é confiável o suficiente para merecer evolução.
    

---

Se você quiser, no próximo passo eu transformo esse PRD em um **plano de implementação em fases**, já quebrado em:  
**Fase 1, Fase 2, backlog técnico, estrutura de pastas e primeiros componentes**.