# Perguntas da banca

| Pergunta | Resposta sugerida |
| --- | --- |
| Quais fórmulas vocês usam? | FIXO é comprimento de costura multiplicado pelo fator da máquina, em minutos. O TP soma o FIXO e cada ocorrência MTM na ordem do roteiro. |
| Densidade, medidas e RPM entram no cálculo? | São campos da ficha. O comprimento vem da demanda. As faixas de RPM usam 90% e 110% para reproduzir o modelo. O FIXO usa o comprimento e o fator cadastrado. |
| Como evitam erro de arredondamento? | O motor usa inteiros de precisão arbitrária com escala decimal e guarda os resultados como texto decimal. Interface e Excel arredondam a quatro casas após o cálculo. O Excel inclui uma aba com valores exatos. |
| E se um código aparecer duas vezes ou tiver tempo zero? | Cada ocorrência mantém sua posição e conta na soma. O código oficial `1.1` aparece na ficha com tempo zero. |
| Por que existem nove registros MTM no kit? | A aba tem nove códigos compostos e seis valores de agrupador. Importamos os nove registros porque a demanda referencia os códigos compostos. A relação com os seis procedimentos do regulamento é uma leitura da estrutura do kit. |
| Como conferiram o cenário oficial? | Importamos nove códigos e três máquinas e comparamos 44 células preenchidas do Excel exportado com o gabarito. FIXO `0,6709 min` concorda. O gabarito termina nos itens MTM, então conferimos o TP de `0,940944 min` pela fórmula do regulamento. |
| O que acontece se a planilha mudar de ordem ou tiver erro? | A pessoa escolhe aba e cabeçalho e confirma o mapeamento. A prévia identifica linhas e campos inválidos. A confirmação revalida e grava a planilha inteira em uma transação. |
| Como lidam com referências alteradas? | Cada ficha salva mantém os parâmetros, as referências, as versões e os tempos usados na emissão. Alterar um catálogo muda os próximos cálculos. Gestão de aprovação e análise de impacto são itens de piloto. |
| Como protegem o uso local? | A aplicação atende em endereço local, valida entradas e separa os arquivos de referência do Git. Para uso compartilhado, precisamos definir autenticação, permissões, operação e política de dados com a empresa. |
| Como cresce para mais equipes? | O monólito separa API, regras e persistência. O piloto deve medir volume e concorrência e decidir se vale migrar o banco, implantar acesso por perfil e preparar backups e monitoramento. |
| Vai integrar com ERP ou PPCP? | O projeto tem uma API para a interface e gera planilhas. Para integrar sistemas corporativos, precisamos definir donos dos dados, campos, identificadores, revisão, acesso e falhas com as áreas envolvidas. |
| Quanto a Karsten economiza? | O desafio permite demonstrar o cálculo. O retorno precisa do volume real, da diferença de tempo medida, do custo-hora e dos custos de implantar e operar. A calculadora estima impacto com os dados inseridos. |
| Qual é o próximo passo? | Escolher com a Engenharia uma família e fichas representativas. Comparar tempos, conferência, correções e aceitação no mesmo trabalho, com critérios de continuidade combinados antes. |
| Quem detém o código? | O regulamento atribui os direitos do código aos alunos participantes e prevê possíveis conversas de piloto. Uso comercial, licença, cessão, confidencialidade e suporte precisam de acordo formal. |
