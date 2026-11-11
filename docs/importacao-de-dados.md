# Importação de dados

Os cadastros aceitam Excel `.xlsx`, LibreOffice `.ods` e `.csv`. O formulário também permite cadastrar e editar registros individuais. Para operações, **Nova operação** aceita preenchimento manual e o TXT de demanda no padrão do kit.

| Catálogo | Campos obrigatórios | Campo opcional |
| --- | --- | --- |
| Elementos MTM | Código, descrição, tempo unitário em min | — |
| Máquinas | Código, descrição/modelo, RPM padrão, fator em min/m | Tipo da máquina |

## Assistente

1. Escolha o catálogo e envie o arquivo.
2. Selecione a aba e a linha do cabeçalho. O assistente sugere colunas por nome, e a pessoa usuária pode mudar qualquer associação.
3. Aponte cada campo para uma coluna diferente e valide a prévia. A ordem física das colunas pode variar.
4. Revise as linhas e os erros. Uma coluna obrigatória vazia, linha inválida, código repetido ou código já cadastrado bloqueia a confirmação. Corrija o arquivo ou edite o item diretamente no catálogo, conforme o caso.
5. Confirme a prévia válida. O servidor valida novamente e grava o lote inteiro em uma transação. O lote guarda arquivo, aba, data e quantidade. Cada registro importado guarda também a linha de origem.

O CSV pode usar vírgula, ponto e vírgula ou tabulação como delimitador. Quando a vírgula também for usada como decimal, prefira ponto e vírgula como delimitador ou coloque o decimal entre aspas. Prefira UTF-8. A leitura de texto também aceita Windows-1252 quando a decodificação UTF-8 falha. Preserve os códigos como texto nas planilhas quando houver zeros à esquerda.

Em células com fórmula, o importador lê o resultado já salvo. Uma fórmula sem resultado armazenado gera erro de validação. A API disponibiliza modelos vazios e amostras identificadas em CSV e Excel. Os arquivos de cadastro têm limite de 5 MB, até 30 abas e até 5.000 linhas e 64 colunas por aba. A prévia temporária expira em 30 minutos e exige novo envio depois de expirada.

## Kit oficial

Use `Entradas.ods` em uma base separada dos dados fictícios. O arquivo tem duas abas e deve ser enviado uma vez para cada catálogo.

| Catálogo | Aba | Cabeçalho | Mapeamento |
| --- | --- | --- | --- |
| Elementos MTM | `MATRIZ_DE_ELEMENTOS` | Linha 1 | Código → D (`elemento + agrupador`), descrição → A, tempo unitário → E |
| Máquinas | `TEMPO-CM` | Linha 2 | Código → A, tipo → B, descrição/modelo → C, RPM → D, fator → E |

Confira a linha de títulos na amostra. A matriz traz nove códigos em seis agrupadores. Os seis agrupadores são uma leitura da organização da planilha em relação aos seis procedimentos citados pelo regulamento. Importe os nove registros codificados, incluindo `1.1` com tempo zero. Na aba de equipamento, confira os três registros.

Em **Nova operação**, use o botão de importação de demanda e escolha `demanda_000.txt`. Confira o preenchimento e a sequência `2.1, 1.1, 3.1` antes de calcular. O TXT lê um campo por linha no padrão `Campo: valor`. A lista de elementos preserva ordem e repetições. O arquivo `PO-SL-000.ods` serve para conferência, como detalhado nas [regras de cálculo](regras-de-calculo.md).
