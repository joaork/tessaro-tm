# Fluxo integrado do Tessaro T&M

Os quatro módulos usam os mesmos cadastros de máquinas e elementos MTM. A PO liga o relato conferido, os tempos calculados, as revisões e a programação do turno. O cenário oficial continua usando a demanda e os arquivos do kit.

## OFÍCIO

Cole um relato separado por frases, linhas ou ponto e vírgula. O sistema procura os códigos e as descrições cadastradas e reconhece repetições explícitas como “3.1 x2” e “duas vezes”. Um trecho incerto fica pendente. Confira os códigos, a ordem, as quantidades e o total MTM antes de continuar.

Selecione uma ficha como referência se quiser reaproveitar parâmetros técnicos. Continue na operação, complete os campos, calcule e emita. A ficha e a aba Memória do Excel guardam os trechos revisados e os códigos escolhidos ao preparar o roteiro. O roteiro final pode ser editado na operação.

Em **Áudio e microfone**, clique em **Gravar do microfone** e permita o acesso no navegador. O medidor e o cronômetro acompanham a captação. Cada gravação dura até dois minutos. Depois de parar, ouça ou baixe o trecho. Também é possível selecionar um arquivo de até 5 MB.

Para transcrever, configure TESSARO_OPENAI_API_KEY no arquivo .env do servidor e reinicie o serviço. Escolha o dispositivo, observe o medidor, confirme o envio e clique em **Transcrever áudio**. Revise o texto e selecione **Sugerir etapas da gravação**. Quando o serviço não reconhecer fala, ouça o trecho e preencha o campo de revisão manualmente. A emissão guarda o relato e o nome do arquivo. [Documentação oficial da transcrição](https://developers.openai.com/api/docs/guides/speech-to-text)

## TRAMA

Abra uma ficha emitida, clique em **Simular no TRAMA**, informe a meta e selecione as máquinas cuja compatibilidade foi conferida. Edite a sequência MTM para testar o método proposto. O resultado compara o TP emitido com FIXO, MTM e TP de cada alternativa usando os cadastros vigentes.

O limite de fator é apresentado com até dez casas decimais, arredondado para baixo. A verificação da meta compara os tempos exatos. Clique em **Revisar PO** para enviar ao LASTRO a ficha, a máquina, o roteiro e o TP simulado. A proposta fica disponível na aba atual durante a revisão.

## LASTRO

**Impacto e revisão** lista fichas vigentes que usam versões anteriores de máquina ou MTM. Abra a proposta do TRAMA, calcule a prévia e use **Conferir a ficha proposta** para revisar a sequência final. O LASTRO sinaliza quando o TP recalculado difere do simulado. A aprovação registra uma revisão vinculada à anterior. Uma mudança posterior no cadastro exige nova prévia.

**Emissão em lote** recebe um CSV UTF-8 de até 65 KB com 1 a 50 operações. Use ponto e vírgula entre colunas e vírgulas entre códigos no roteiro. O cabeçalho aceita as colunas produto, perimetro, densidade, maquina e roteiro. ficha e operacao são opcionais. Os códigos são textos e repetições no roteiro são preservadas. Confira a prévia e corrija todas as linhas com problemas antes de emitir.

    produto;perimetro;densidade;maquina;roteiro;ficha;operacao
    Peça de teste;4,20;2,50;DEMO-M01;DEMO-01,DEMO-02,DEMO-02;PO-LOTE-01;Costura de demonstração

O exemplo depende dos cadastros demonstrativos disponíveis em **Painel de trabalho → Bases de apoio**. Faça alterações de catálogo para ensaio em uma cópia do banco ou em dados de demonstração.

## REVEZA

Abra uma ficha vigente e clique em **Planejar no REVEZA**. Informe o início e fim do turno, as equipes e suas habilitações. Para cada pedido, selecione a ficha, as máquinas compatíveis, a quantidade, o prazo e a preparação em minutos. Registre os intervalos de indisponibilidade de máquina ou equipe.

O sistema considera um lote por pedido e reserva máquina e equipe durante todo o intervalo. A duração é a quantidade multiplicada pelo tempo por peça, acrescida da preparação e arredondada para cima até o próximo minuto. O planejador atende primeiro os prazos mais próximos e busca encaixes que respeitem os recursos. A tabela mostra atrasos e pedidos que ficaram sem intervalo. O cálculo é uma heurística para um turno no mesmo dia.

Salve o plano e abra-o para replanejar. Informe a hora a partir da qual será possível mover os pedidos. Alocações cujo início no plano anterior precede esse horário ficam protegidas. Uma parada que afete um lote fixado aparece como pendência de revisão manual. A nova versão mantém uma referência ao plano anterior.

O plano guarda a revisão da PO e a versão da máquina consideradas em cada alocação. Use **Atualizar fichas dos pedidos pendentes** para levar os lotes móveis à PO vigente. Confira as máquinas alternativas, simule o turno e salve a nova versão.

## Impacto da revisão

Na ficha revisada, clique em **Projetar impacto na produção** e informe o volume previsto de peças. A tela usa a diferença entre os dois TPs emitidos para estimar as horas mensais. No ensaio, a proposta de `0,820944 min` partiu de `0,940944 min`. A diferença de `0,12 min` por peça projetou `10 h/mês` para 5.000 peças.

## Preparação da demonstração

1. Rode a demanda oficial e confira a PO antes de apresentar os módulos.
2. Use um relato de demonstração no OFÍCIO e emita a ficha.
3. Monte dois pedidos no REVEZA usando a ficha original e salve o turno.
4. Teste um roteiro no TRAMA, abra a proposta no LASTRO e emita a revisão depois de conferir os tempos.
5. Reabra o plano, indique o horário de replanejamento e atualize os pedidos pendentes. Mostre a ficha de cada lote e a projeção de horas da revisão.

O SQLite atualiza o esquema local para a versão 2 na abertura. A migração acrescenta os vínculos de revisão e a tabela de planos. Consulte o [plano de testes](plano-de-testes.md) para ver as verificações executadas.
