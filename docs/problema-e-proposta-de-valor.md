# Problema e proposta de valor

A pessoa usuária principal é quem cria ou revisa padrões de costura na Engenharia de Tempos e Métodos. Ela precisa transformar as características do produto e as referências técnicas em uma PO que outra pessoa consiga verificar e usar.

**Fato confirmado.** O desafio da Karsten apresenta os parâmetros do produto, a máquina e o roteiro como entradas para gerar a ficha. O [estudo de caso](estudo-de-caso.md) reúne o contexto documentado.

**Hipótese a validar.** Um possível fluxo atual reúne referências em fontes diferentes, organiza a sequência, calcula tempos, preenche a ficha e encaminha para conferência. As ferramentas, os responsáveis, o tempo de cada etapa e o caminho de aprovação precisam ser confirmados em campo.

**Proposta Tessaro.** A pessoa responsável importa ou cadastra as referências, informa os parâmetros, escolhe a máquina e monta o roteiro. A prévia mostra o FIXO e cada linha de MTM antes da emissão. A ficha salva guarda o valor e a versão das referências usadas. A exportação em Excel entrega a ficha e a memória de cálculo para conferência.

| Necessidade | Resposta do MVP | Como avaliar no piloto |
| --- | --- | --- |
| Encontrar as referências certas | Catálogos e consulta por código no roteiro | Erros de código e tempo para localizar um parâmetro |
| Conferir o cálculo | Parcela fixa, itens e TP, com valores exatos na memória | Concordância com amostra revisada pela Engenharia |
| Atualizar cadastros e preservar fichas emitidas | Validação de importação e cópia das referências na ficha | Capacidade de recuperar a origem de uma ficha após alterações |
| Entregar uma ficha padrão | Cabeçalho, roteiro e total em Excel | Aceite do formato pelas áreas que usam a PO |

A proposta de valor é reduzir o esforço para montar e revisar fichas por meio de cálculos padronizados e rastreáveis. O protótipo demonstra a regra e o fluxo. O ganho de tempo e a aceitação dependem de uma medição comparável com as pessoas que realizam o trabalho. Aprovação formal, gestão corporativa de acessos e integrações ficam nas fases do [roadmap](roadmap.md).
