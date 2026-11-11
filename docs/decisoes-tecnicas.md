# Decisões técnicas

## Auditoria e ordem de entrega

O projeto foi iniciado em `tessaro-tm/`, numa pasta com Git próprio. No início da implementação, o regulamento estava na pasta de trabalho, e os originais do kit foram obtidos pelo link do PDF e mantidos como referências locais. A base de referência tem nove códigos de MTM em seis agrupadores e três máquinas. O gabarito traz as linhas do roteiro, o FIXO arredondado e os campos de identificação. A definição do TP vem do regulamento.

A ordem de trabalho prioriza motor e prova da fórmula, ingestão do kit, geração da ficha, interface, verificações e preparação da banca. A auditoria identificou três riscos centrais. Tratar código MTM como número pode alterar a identidade. Arredondar antes da soma pode distorcer o total. Apresentar estimativa como resultado da Karsten pode desviar a discussão de valor. As decisões abaixo tratam desses riscos.

| ID | Decisão | Alternativa considerada | Motivo e efeito |
| --- | --- | --- | --- |
| ADR-01 | Aplicação modular local em React, Fastify e SQLite | Aplicação distribuída com PostgreSQL desde o início | Instalação mais curta para banca e separação clara entre interface e domínio. O piloto deve reavaliar concorrência, permissões e operação do banco. |
| ADR-02 | Coeficiente `BigInt`, escala decimal e persistência textual | Operar os tempos em `Number` ou trazer biblioteca decimal | Soma e multiplicação exatas com escopo numérico pequeno. Arredondamento fica na formatação e exportação. |
| ADR-03 | Importação com mapeamento e confirmação transacional | Confiar na ordem das colunas ou gravar automaticamente cada linha válida | Mantém o layout de origem, permite revisão e evita lotes parciais. Códigos existentes exigem edição deliberada. |
| ADR-04 | Ficha emitida guarda cópia das referências e da versão da fórmula | Recalcular fichas antigas com o catálogo atual | Garante reprodução histórica. A edição do catálogo afeta próximas fichas. |
| ADR-05 | Densidade, dimensões e RPM como campos da ficha. Comprimento e fator determinam o FIXO | Inferir comprimento, tempo ou fator a partir dos demais campos | Usa somente a fórmula oficial. RPM mínimo e máximo reproduzem campos de referência do gabarito. |
| ADR-06 | Roteiro vazio representa costura de máquina | Exigir elemento MTM em toda ficha | Permite costura pura com TP igual ao FIXO. Engenharia deve confirmar a regra de negócio durante o piloto. |
| ADR-07 | Planilha emitida com linha de TP e aba de memória | Reproduzir apenas as linhas do gabarito | Atende à exigência explícita de TP e oferece valores exatos para conferir o cálculo. |
| ADR-08 | Material oficial em arquivos locais excluídos do Git e dados de exemplo rotulados | Incluir originais e números de referência no código | Preserva os materiais do evento e permite demonstração com exemplos separados. A comparação oficial lê os arquivos autorizados em tempo de execução. |
