# Requisitos e critérios de aceitação

O regulamento distribui 35 pontos para aderência e precisão, 20 para arquitetura, qualidade e usabilidade, 20 para flexibilidade de ingestão e criatividade e 25 para apresentação. A entrega pede um repositório público com instruções e uma demonstração de cinco minutos seguida de três minutos de arguição.

| ID | Prioridade | Requisito | Critério de aceite |
| --- | --- | --- | --- |
| RF01 | MVP | Visão geral | Banco vazio mostra contagens zeradas e próximos passos. Cadastros e fichas gravados atualizam as contagens. |
| RF02 | MVP | Catálogos MTM e máquinas | Pessoa usuária lista, cria e edita cada tipo de referência, com origem e unidade visíveis. Campos inválidos e códigos duplicados recebem feedback. |
| RF03 | MVP | Importação guiada | É possível escolher aba e cabeçalho, mapear colunas em ordem diferente, revisar e confirmar ODS, Excel e CSV. Prévia inválida bloqueia a gravação do lote inteiro. |
| RF04 | MVP | Produto, máquina e parâmetros | A operação aceita identificação, comprimento em metros, densidade em pontos/cm, máquina e metadados. Arquivo TXT do kit preenche o formulário para revisão. |
| RF05 | MVP | Roteiro ordenado | Adicionar, remover e reordenar linhas altera a PO de forma correspondente. Códigos repetidos geram ocorrências separadas e contam em cada posição. |
| RF06 | MVP | Cálculo e memória | FIXO, tempos MTM e TP seguem as fórmulas oficiais, com zero MTM aceito. Roteiro vazio produz TP igual ao FIXO. Código inexistente bloqueia a emissão. |
| RF07 | MVP | Prévia e emissão de ficha | Cabeçalho, parâmetros, máquina, FIXO, linhas ordenadas e TP estão na prévia e na ficha salva. Alterar uma referência preserva a ficha emitida. |
| RF08 | MVP | Exportação | O Excel abre com cabeçalho e linhas de processo, TP e memória. Códigos e revisão conservam seus valores. A linha MTM de tempo zero aparece na posição correta. |
| RF09 | MVP | Estimativa de impacto | Entradas de volume, tempos e custo-hora começam vazias. Cálculo com dados inseridos informa o valor bruto estimado. |
| RF10 | Piloto | Gestão de revisão e aprovação | Papéis e etapas definidos com a Karsten. A ficha aprovada registra responsável, data e parâmetros da emissão. |
| RF11 | Produto | Integração e comparação com a produção | Contrato de dados e acessos acordados. Origem e condições de cada medição ficam disponíveis para comparação. |

| ID | Requisito de qualidade | Critério de aceite |
| --- | --- | --- |
| RNF01 | Precisão | Entradas normalizadas em texto decimal, sem arredondamento entre parcelas. Apresentação a quatro casas. |
| RNF02 | Integridade | Lotes atômicos, versões nas edições de referência e cópia dos valores de uma ficha emitida. |
| RNF03 | Legibilidade e uso | Interface pt-BR, rótulos e unidades explícitos, feedback acessível, navegação por teclado e adaptação a telas estreitas. |
| RNF04 | Reprodutibilidade | Um avaliador instala conforme o README, inicia com base vazia, carrega referências e gera a ficha. |
| RNF05 | Separação de dados | A demonstração fictícia tem sinalização própria e a comparação oficial usa arquivos locais. O Git público preserva somente o material autorizado. |

Considere o MVP pronto para banca quando a instalação, os comandos de qualidade, a comparação oficial e o percurso no navegador estiverem registrados, com uma exportação aberta e conferida. Consulte as [evidências de execução](plano-de-testes.md).
