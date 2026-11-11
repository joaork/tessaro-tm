# Pitch de 5 minutos

O regulamento prevê cinco minutos de apresentação e três de arguição. Conduza a conversa com a aplicação e deixe a ficha exportada aberta para o caso de a alternância de janelas tomar tempo. As perguntas prováveis estão na [preparação para a banca](perguntas-da-banca.md).

| Tempo | Fala e ação |
| --- | --- |
| 0:00–0:40 | “Uma ficha de Processo Operacional reúne os parâmetros da peça, o equipamento e a sequência de trabalho. Esses dados precisam virar um tempo que outra pessoa consiga conferir. Somos a Tessaro Soluções e criamos o Tessaro T&M para automatizar a formação dessa ficha.” |
| 0:40–1:15 | “O desafio da Karsten pede que a gente use a base de máquinas e o catálogo de elementos MTM, aplique as fórmulas oficiais e entregue uma ficha de Processo Operacional. Vamos mostrar a operação de um sobre-lençol solteiro com os dados do kit.” Abra o painel de trabalho e mostre as contagens da base oficial preparada. |
| 1:15–3:20 | Mostre brevemente a aba e o mapeamento em **Importar dados**. Volte ao banco já preparado e abra **Nova operação**. Importe `demanda_000.txt`, confira máquina `1`, 6,96 m, 2,50 pontos/cm e a sequência `2.1 → 1.1 → 3.1`. Em **Calcular prévia**, mostre a multiplicação do FIXO, o código com tempo zero e o TP. Salve e clique em **Baixar Excel**. Abra **PO** e **Memória**. “O FIXO bate com as quatro casas do gabarito. O TP de 0,940944 minuto é calculado com as parcelas exatas pela fórmula do regulamento.” |
| 3:20–4:15 | Abra uma simulação preparada no TRAMA e mostre a revisão no LASTRO. No REVEZA, abra o plano ensaiado com um pedido da ficha original e outro da revisão. “Cada pedido aponta para a ficha que sustentou seu tempo. Ao replanejar, preservamos as alocações anteriores ao horário de corte e aplicamos a revisão aos pedidos pendentes.” |
| 4:15–5:00 | “Propomos testar o Tessaro T&M com uma família de produtos, um conjunto de máquinas e fichas que a Engenharia selecionar. Se a amostra mostrar tempos confiáveis e um fluxo melhor para quem usa, podemos discutir aprovação, integração e ampliação. Gostaríamos de definir essa primeira amostra com a Engenharia.” |

## Preparação da demonstração

1. Instale e inicie a aplicação no computador da apresentação. Use um banco separado com o kit já importado e mantenha os originais locais.
2. Deixe prontos o painel de trabalho, uma etapa de mapeamento e a ficha exportada. Se for demonstrar a confirmação de importação, use uma base vazia separada para evitar códigos duplicados.
3. Ensaie o caminho pelo TXT. Se precisar preencher manualmente, use `PO-SL-001`, revisão `00`, operação `Bainhar no corpo do SL - 1 lado`, família `Sobre-lençol`, tamanho `Solteiro`, dimensões `1,80 x 2,50`, comprimento `6,96`, densidade `2,50`, máquina `1` e roteiro `2.1, 1.1, 3.1`.
4. Confira antecipadamente o download do Excel, FIXO `0,6709 min` e TP `0,9409 min`. Se houver problema na demo ao vivo, mostre a ficha gerada no ensaio e identifique a origem do arquivo. O fluxo principal funciona localmente após a instalação.

## Versão de 30 segundos

“Somos a Tessaro Soluções. O Tessaro T&M usa os dados da peça, da máquina e do roteiro MTM para calcular e gerar a ficha de Processo Operacional. No cenário oficial, mostramos cada parcela, chegamos a 0,940944 minuto e entregamos a ficha em Excel com memória de cálculo. Propomos um piloto com uma família de produtos para medir com a Engenharia o tempo de elaboração e a consistência das fichas.”

## Fechamento de 15 segundos

“Queremos escolher com a Engenharia uma família de produtos e comparar as fichas no processo atual e no Tessaro T&M. A amostra nos ajuda a decidir juntos se vale ampliar.”
