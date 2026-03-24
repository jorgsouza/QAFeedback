/**
 * Bloco Markdown acrescentado à descrição Jira quando um anexo HAR é enviado.
 * Mantido separado para testes e revisão de copy.
 */
export function networkHarJiraDescriptionMarkdown(fileName: string): string {
  return `---

### Captura de rede (HAR)

Foi anexado o ficheiro \`${fileName}\`: registo HTTP da aba durante este feedback (captura pela extensão).

**Como importar no Chrome:** abra DevTools (F12) → separador **Network** → menu ⋮ ou clique direito na lista → **Import HAR file** / **Importar ficheiro HAR** → escolha o anexo.

**Privacidade:** cabeçalhos sensíveis (ex.: \`Cookie\`, \`Authorization\`, \`Set-Cookie\`) foram substituídos por \`[REDACTED]\` no ficheiro. Corpos de pedido/resposta mantêm-se como capturados (podem conter dados operacionais).

**Nota:** se a captura falhar ao abrir o feedback, feche o **DevTools nesta aba** e tente de novo.`;
}
