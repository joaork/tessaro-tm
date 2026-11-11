# Auditoria Antivibe do frontend

## Resumo da arquitetura

- O App Router exporta 11 rotas estáticas. O layout mantém a navegação e o estado da sessão. As telas consultam a base do Fastify e exibem prévias calculadas pela API.
- O OFÍCIO prepara o roteiro da PO. O TRAMA envia a simulação para o LASTRO, que emite revisões. O REVEZA e o ROI consomem as fichas emitidas para planejar o turno e projetar impacto.

## Decisões principais

- O rascunho da PO acompanha a navegação interna e pode ser limpo pelo operador. Uma recarga da aba reinicia a edição. Se uma emissão termina depois que o usuário troca de tela, o histórico recebe a ficha e o usuário permanece na tela aberta.
- As confirmações usam a prévia da API. Se a base mudou, a interface retira a confirmação vencida, conserva os campos preenchidos e atualiza a consulta à base. A edição de um cadastro atualizado em outra sessão exige reabrir sua versão atual.
- As tabelas mantêm as colunas em uma área de rolagem identificada e acessível por teclado. Cada rota tem título próprio e recebe foco no cabeçalho ao abrir pela navegação interna.

## Pontos de atenção

- O menu móvel podia permanecer aberto ao voltar para a largura de desktop. Agora fecha ao cruzar o ponto de quebra. A marca TESSARO fica à esquerda na navegação, com aparência estática sob o ponteiro e foco visível por teclado.
- A consulta da base retorna cadastros e fichas juntos. As respostas antigas ficam impedidas de sobrescrever uma consulta mais recente. O volume de dados a transferir continua proporcional ao histórico.
- O OFÍCIO libera o URL temporário de uma gravação quando a última etapa vinculada é removida. Os demais áudios da tela são liberados ao sair.

## Casos limite e modos de falha

- Na importação, o código já cadastrado durante a validação devolve o operador ao mapeamento. Um envio expirado volta à seleção do arquivo.
- A auditoria reproduziu conflitos na emissão de PO, revisão, lote e turno. A interface pediu nova prévia e preservou os dados digitados. O cenário de turno usou a alteração de uma máquina alternativa, pois a máquina da ficha usa a versão registrada na emissão.

## Testabilidade

- Chrome em 1440, 390 e 320 px. O axe-core 4.14 executou 57 verificações com estados vazios e preenchidos, formulários, menu e prévias. Foram observados zero alertas nas regras executadas e zero transbordamentos da página. A rolagem horizontal da ficha foi exercitada pelo teclado.
- A suíte passou com 55 testes. Lint, TypeScript e build estático passaram. O kit oficial conferiu 44 células da ficha, a memória de cálculo e o TP de 0,940944 min.
- Os testes de escrita usaram bancos isolados. A captura no Chrome usou voz sintética e a interface de transcrição recebeu uma resposta simulada.
