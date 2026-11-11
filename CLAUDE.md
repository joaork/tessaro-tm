# Guia de manutenção do Tessaro T&M

O produto é **Tessaro T&M**, Plataforma de Engenharia de Tempos e Métodos da equipe **Tessaro Soluções**. Escreva interface, feedback e documentação em português do Brasil. O objetivo é gerar fichas de Processo Operacional (PO) a partir dos parâmetros do produto, da máquina e de uma sequência de elementos MTM.

## Fontes e limites

- O regulamento rege os requisitos. O kit oficial define o cenário, os cadastros de referência e a estrutura esperada da PO. Use as referências locais em `docs/referencias/` e consulte o [guia de origem](docs/referencias/README.md).
- Trate as planilhas do kit como somente leitura. Use fixtures marcadas `DEMO-` ou arquivos temporários para testes. Preserve os materiais oficiais, `.env`, bancos e credenciais fora do Git público.
- Ao descrever a Karsten, separe fatos documentados, hipóteses de campo e propostas Tessaro. Registre a origem de cada fato e os resultados efetivos de validação.

## Comandos

O `package.json` é a referência dos scripts. Use Node.js 24.15 ou posterior da série 24 e instale com `npm ci`.

| Comando | Uso |
| --- | --- |
| `npm run dev` | Interface e API em desenvolvimento |
| `npm run build` e `npm start` | Build e execução local no Fastify |
| `npm test` | Suíte automatizada em Vitest |
| `npm run lint` | Lint |
| `npm run typecheck` | Checagem de tipos |
| `npm run validate:kit` | Conferência local com os arquivos oficiais |

## Invariantes do domínio

- FIXO em minutos é comprimento de costura em metros vezes fator da máquina em min/m. TP é FIXO mais a soma dos tempos unitários de cada ocorrência MTM.
- Densidade em pontos/cm, dimensões do produto e RPM são metadados. As faixas de RPM reproduzem a apresentação do gabarito. Alterações nessas faixas não mudam o TP.
- Preserve códigos como texto, inclusive `1.1`. Tempo zero é válido para MTM. Repetições contam por posição. Roteiro vazio representa somente costura de máquina.
- Calcule com decimais exatos. Use a mesma memória de cálculo na prévia, no histórico e no exportador. Arredonde a apresentação e o Excel conforme as [regras de cálculo](docs/regras-de-calculo.md).
- Fichas emitidas guardam os dados usados no cálculo. Preserve o histórico quando uma referência for editada.
- OFÍCIO cria um rascunho para conferência. TRAMA simula a partir da ficha sem gravar tempos. LASTRO liga revisões sem sobrescrever as emissões. REVEZA usa uma ficha vigente para cada pedido novo e preserva o plano anterior.
- O gabarito fornece FIXO arredondado e linhas MTM. A referência independente para TP é a fórmula do regulamento.

## Onde editar

`src/client/` organiza as telas e consome a API. `src/server/calculation.ts` contém o motor puro. `src/server/repository.ts` concentra o SQLite. Os contratos, schemas e auxiliares decimais estão em `src/shared/`. A ingestão e a exportação pertencem ao servidor. Mantenha a regra de tempos em uma única camada.

Ao mudar uma regra, atualize sua versão quando a mudança afetar a reprodução de fichas, registre a decisão e ajuste os testes e os documentos correspondentes. Após mudanças relevantes, execute as verificações aplicáveis. Registre aprovação apenas para comandos e fluxos que tenham sido executados com evidência.
