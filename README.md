# QAFeedback

Repositório do projeto **QA Feedback → GitHub**: extensão Chrome (MV3) para criar issues a partir da página em teste.

## Extensão

Toda a implementação está em **`extension/`**.

- **Guia rápido:** [extension/README.md](extension/README.md)
- **Documentação completa:** [extension/DOCUMENTATION.md](extension/DOCUMENTATION.md)

## Requisitos

- Node.js 18+
- Chrome ou Chromium compatível com Manifest V3

## Arranque rápido

```bash
cd extension
npm install
npm run build
```

Carregue **`extension/dist`** em **chrome://extensions** (modo desenvolvedor → carregar sem compactação).

## PRD e arte

- Especificação e imagens: pasta **[PRD](./PRD/)** (ficheiro principal do PRD em Markdown).
- Ícone / mascote: **`PRD/capiQA.png`** (gerado no build via `npm run icons` dentro de `extension/`).

## Git

Na raiz existe um **`.gitignore`** com entradas comuns (`.env`, `node_modules`, `extension/dist`, etc.). Não commite ficheiros com tokens ou segredos.
