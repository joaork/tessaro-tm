# Estudo de caso

## Fatos confirmados

O regulamento pede uma solução que leia parâmetros do produto, use bases de máquinas e elementos MTM, calcule o tempo de costura e os tempos manuais e produza uma ficha de Processo Operacional (PO). O kit permite conferir uma operação de costura sobre um sobre-lençol solteiro. A demanda e o gabarito documentam o cenário da competição. [Regulamento e kit de apoio](referencias/README.md).

A Karsten se apresenta como uma empresa brasileira com mais de 140 anos de história, com produtos para o lar e uso de tecnologias para reduzir o consumo de água e energia na sua cadeia. Data de publicação não informada. Consulta em 10/11/2026. [Karsten · Sobre nós](https://www.karsten.com.br/sobre-nos).

A descrição institucional em uma vaga da Karsten situa a confecção depois da fiação, preparação, tecelagem e beneficiamento e antes da expedição. Esse contexto ajuda a localizar a operação de costura do desafio na cadeia produtiva. A descrição é pública e não detalha a rotina de elaboração ou aprovação de fichas. Data de publicação não informada. Consulta em 10/11/2026. [Karsten · Coordenador de Outsourcing](https://karsten.gupy.io/jobs/11557734?jobBoardSource=gupy_public_page).

## Hipóteses a validar

O desafio motiva investigar o tempo de elaboração de uma PO, as consultas e lançamentos envolvidos, as revisões causadas por mudanças de referência, a capacidade de recuperar os parâmetros usados em cada ficha, a diferença entre padrão e observado e os dados trocados entre áreas. As fontes consultadas não trazem uma medida desses efeitos para a Karsten. A [matriz de validação](validacao-com-a-karsten.md) detalha evidências, riscos, indicadores e roteiro de entrevistas.

Se houver digitação repetitiva, a reutilização de cadastros pode reduzir o esforço técnico. Se mudanças de referência exigirem revisão de fichas, o histórico pode ajudar a localizar quais valores foram usados. Diferenças entre tempos padrão e observados pedem investigação de método, condições de produção e amostra antes de motivar uma mudança de parâmetro.

| Parte interessada | O que pode ajudar a esclarecer |
| --- | --- |
| Engenharia de Tempos e Métodos | Como define, confere e revisa tempos e cadastros |
| Engenharia de Processos | Como uma operação vira ficha, passa por aprovação e chega à produção |
| Engenharia de Produto | Como identifica variantes, tamanhos e dimensões e transmite alterações |
| PPCP | Quais campos da ficha usa e como recebe revisões |
| Produção e qualidade | Como observam execução, exceções e desvios em campo |

## Proposta Tessaro

Automatizar a formação de tempos e gerar uma PO que a Engenharia consiga conferir e reproduzir. O primeiro escopo é a costura coberta pelo desafio. A aplicação liga os cadastros ao cálculo, registra as referências usadas e exporta a ficha.

O piloto proposto começa por uma família e um conjunto de fichas existentes. Uma amostra pequena ou concentrada em um único tipo de operação pode superestimar a utilidade da ferramenta. Escolher a amostra com a Engenharia, comparar o mesmo trabalho nos dois fluxos e registrar exceções reduz esse risco. O [business case](business-case-e-roi.md) indica os campos necessários para medir o impacto.
