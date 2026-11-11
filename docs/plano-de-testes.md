# Plano de testes e evidências

## Versão com os quatro módulos

Em 10/11/2026, build com verificação de tipos, lint e 43 testes automatizados passaram. A nova execução de validate:kit conferiu as mesmas 44 células preenchidas e o TP oficial de 0,940944 minuto.

Uma cópia do SQLite da versão 1 abriu no aplicativo compilado e conservou a PO-SL-001. Pela API local, o ensaio fictício capturou 2.1, 1.1 e duas ocorrências de 3.1. Em seguida emitiu uma PO, simulou a máquina alternativa, aprovou a revisão 01 e salvou um turno de dois pedidos. A indisponibilidade de uma máquina moveu um pedido e manteve o outro fixado. O banco original ficou fora do ensaio.

Os testes de áudio usam uma resposta simulada do provedor e verificam que o envio depende da confirmação. A transcrição remota com uma chave real e a conferência visual das novas telas ficaram pendentes. O navegador de verificação não iniciou neste ambiente.

## Comandos

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Suíte automatizada | `npm.cmd test` | 37 de 37 testes aprovados em 10/11/2026, também com `--maxWorkers=1` |
| Lint | `npm.cmd run lint` | Aprovado em 10/11/2026 |
| Tipos | `npm.cmd run typecheck` | Aprovado como etapa do build em 10/11/2026 |
| Build | `npm.cmd run build` | Aprovado em 10/11/2026 |
| Cenário oficial | `npm run validate:kit` | Aprovado em 10/11/2026. Importou 9 códigos MTM e 3 máquinas e conferiu 44 células preenchidas do gabarito. |
| Dependências de execução | `npm.cmd audit --omit=dev` | Zero vulnerabilidades reportadas pela auditoria em 10/11/2026 |
| Consistência das dependências fixadas | `npm.cmd ci --dry-run --ignore-scripts --no-audit --no-fund` | Simulação aprovada em 10/11/2026. A reinstalação real em cópia separada segue pendente. |

## Cobertura automatizada

| Área | Entrada ou ação | Resultado esperado |
| --- | --- | --- |
| Motor | Comprimento positivo e fator decimal | FIXO igual ao produto exato |
| Motor | Vários códigos, incluindo um de tempo zero | Soma exata e linha de tempo zero presente |
| Motor | Repetir um código e alterar a sequência | Contabilizar todas as ocorrências e preservar as posições |
| Motor | Roteiro vazio | MTM zero e TP igual ao FIXO |
| Validação | Máquina ou código MTM desconhecido | Erro com indicação do campo ou posição e bloqueio da emissão |
| Validação | Comprimento vazio, zero, negativo ou não numérico | Entrada rejeitada |
| Validação | Densidade inválida ou fator ausente, zero ou negativo | Entrada rejeitada |
| Precisão | Casas decimais longas ou ponto de arredondamento | Resultado exato e apresentação a quatro casas com arredondamento da metade para cima |
| Ingestão | Colunas reordenadas, vírgula decimal, código textual | Mapeamento respeitado e valores preservados |
| Ingestão | Campo ou coluna faltante, duplicata, linha inválida | Prévia com erros e nenhuma gravação parcial |
| Ingestão | Tentar confirmar sem prévia válida ou após alterar mapeamento | Confirmação bloqueada |
| Persistência | Editar catálogo depois de salvar uma ficha | Exportação e histórico usam as referências da emissão |
| Exportação | Abrir `.xlsx` gerado | Cabeçalho, linhas, unidades e TP presentes, com valores exatos na aba **Memória** |

## Comparação oficial executada

Em **10/11/2026**, `npm run validate:kit` leu os três originais da pasta local, importou as duas abas por meio dos serviços de ingestão e calculou a ficha em banco em memória. O script comparou as 44 células preenchidas das colunas A a E da aba `PO` com os valores do gabarito, normalizando os espaços em branco. Também conferiu separadamente o TP e os valores exatos na aba **Memória**. A mesma comparação passou tanto para o Excel gerado pelo script quanto para o `.xlsx` baixado pela interface. A cópia local do download está em `data/validacao/PO-SL-001.xlsx`, fora do Git.

| Item | Referência | Obtido |
| --- | --- | --- |
| MTM | 9 códigos em 6 agrupadores | 9 códigos importados |
| Máquinas | 3 máquinas | 3 máquinas importadas |
| Cabeçalho e sequência | Gabarito, ficha `PO-SL-001` rev. `00`, linhas `FIXO`, `2.1`, `1.1`, `3.1` | Concordância nas células preenchidas |
| FIXO | `0,6709 min` no gabarito e `0,670944 min` pela fórmula | `0,6709 min` na ficha e `0,670944 min` na memória |
| Tempos MTM | `0,15`, `0`, `0,12 min` | Mesma ordem e valores, soma `0,27 min` |
| TP | `0,940944 min` pela fórmula do regulamento | `0,9409 min` na ficha e `0,940944 min` na memória |

O gabarito termina na última linha MTM. O script verifica o TP acrescentado ao Excel como requisito independente. O leitor ODS emitiu avisos sobre formatos condicionais. A leitura, as asserções de cálculo e a comparação dos valores passaram. O script compara conteúdo das células. A conferência visual do layout e da impressão usa a ficha aberta na interface e em uma planilha.

## Percurso manual

| Caso | Critério | Resultado |
| --- | --- | --- |
| Instalação limpa | Seguir apenas o README e chegar à visão geral | A execução em cópia separada parou em `npm ci` por falta de espaço no disco (`ENOSPC`). Repetir em volume com espaço disponível. |
| Modos de execução | Abrir o índice, consultar `/api/health` e `/api/workspace` e criar o SQLite vazio | `npm.cmd run dev` e `npm.cmd start` aprovados em 10/11/2026 no checkout com dependências já instaladas, em portas e banco isolados. |
| Navegador com banco vazio | Contagens zeradas, ação de importação e carga demonstrativa identificada | Estado inicial e percurso oficial conferidos em 10/11/2026. Ensaio separado da carga demonstrativa pendente. |
| Importação oficial na interface | Selecionar cada aba, mapear, validar, confirmar e conferir as contagens | Aprovado em 10/11/2026. Mapeamento automático e importação de 9 códigos MTM e 3 máquinas. |
| Emissão e histórico | Carregar TXT, conferir o roteiro, calcular, salvar, abrir e exportar a PO | Aprovado em 10/11/2026. `PO-SL-001` emitida com TP exato `0,940944 min`, arquivo baixado e ficha mantida após recarregar. |
| Uso e leitura | Conferir desktop e tela estreita, navegação por teclado e console no percurso | Desktop e tela de 390 px conferidos, incluindo menu móvel. Nenhum aviso ou erro no console do percurso verificado. Revisão abrangente por teclado pendente. |
| Ficha e impressão | Abrir o `.xlsx`, verificar as abas **PO** e **Memória** e conferir a prévia de impressão | O script abriu e conferiu o `.xlsx` baixado no navegador. A tentativa de inspeção nativa encontrou o estado **Excel (Falha na Ativação do Produto)**, sem uma janela acessível. Conferência visual da planilha e prévia de impressão pendentes. |

O ensaio da equipe usa um banco próprio e mantém o arquivo exportado de conferência fora do Git público. A checagem com `git check-ignore` confirmou a exclusão de `.env`, banco local, PDF do regulamento e planilhas oficiais.

## Validação da migração para Next.js

- O build, a análise estática e os 47 testes automatizados passaram. Os testes do gravador simularam a captura, a finalização, o descarte e a liberação da trilha de áudio.
- Em desenvolvimento, o Next.js serviu a página do OFÍCIO e encaminhou a checagem da API, a carga demonstrativa e o upload do TXT oficial para a API local com banco em memória.
- Na versão compilada, as 11 rotas e os 33 arquivos de navegação testados responderam por HTTP. Uma cópia do banco local preservou as três versões da PO. A exportação da versão oficial manteve o TP de `0,940944 min`, e o kit voltou a conferir as 44 células.
- A automação pelo navegador interno falhou na inicialização. A revisão visual com a referência Sequencial foi conferida em uma instância isolada do Chrome, descrita abaixo. O ensaio com microfone físico permanece pendente.

## Revisão visual com referência Sequencial

Em **10/11/2026**, o site publicado e o projeto da Sequencial no Desktop forneceram a paleta, as fontes e os parâmetros das animações. A validação em Chrome headless usou uma cópia isolada do banco para preservar os dados do projeto.

- As 11 rotas foram verificadas em 1440, 390 e 320 px. Os elementos visíveis apresentaram raio de borda zero, e a página ficou dentro da largura disponível. As tabelas largas mantiveram a própria rolagem.
- Os menus foram testados com navegação do Next.js, Escape com restauração de foco e expansão no celular.
- O microfone simulado gerou um trecho de áudio, atualizou o cronômetro, liberou as trilhas ao parar e ao sair da tela e permitiu reprodução e download. Um WAV de teste também permitiu controlar a posição no player.
- O construtor recebeu a demanda oficial e calculou a prévia. O histórico abriu a ficha e baixou o XLSX. As preferências de movimento reduzido foram respeitadas.
- Pela interface, TRAMA simulou a meta, LASTRO validou um lote, REVEZA distribuiu um pedido no cronograma e OFÍCIO entregou um roteiro de texto ao construtor.
- Build, análise estática, 47 testes e comparação com o kit oficial passaram. As verificações no navegador concluíram com zero erros de console ou recursos com falha.

## Painel de trabalho

- As 11 telas foram conferidas em 1440, 1024, 390 e 320 px. Os cantos ficaram retos, a página ficou dentro da largura disponível e o símbolo SVG carregou na navegação e na aba do navegador.
- O menu lateral acompanhou a rolagem no desktop. No celular, Escape fechou o menu e devolveu o foco ao botão. O menu também fechou após a seleção de uma ferramenta.
- O atalho **Calcular e emitir** abriu o construtor. O TXT oficial produziu o TP de `0,940944 min`. A ficha emitiu um XLSX válido e a prévia de impressão ocultou a navegação.
- OFÍCIO gravou e reproduziu áudio simulado e transferiu o roteiro de texto. A ficha selecionada passou de TRAMA para LASTRO junto com a máquina escolhida. REVEZA reaproveitou a ficha e calculou o cronograma.
- Build, análise estática, 47 testes e as 44 células do kit oficial passaram. O navegador confirmou o painel na instância local em uso.

## Revisão do fluxo integrado

- Build, análise estática e 53 testes passaram. A comparação do kit oficial conferiu as 44 células e o TP exato de `0,940944 min`.
- Em banco isolado, o navegador importou as duas abas ODS do kit, emitiu a ficha a partir do TXT, baixou Excel e conferiu as importações CSV e XLSX, os cadastros versionados, a emissão em lote e a busca no histórico.
- O Chrome capturou uma fala sintética em português em WebM. O serviço real retornou o texto, e a revisão no OFÍCIO produziu o roteiro no construtor. Um WAV sintético em silêncio reproduziu a falha antiga e, na versão revisada, recebeu a mensagem de fala não reconhecida. O microfone físico permanece para conferência no ambiente de uso.
- O TRAMA simulou `1.1 → 2.1` com TP de `0,820944 min`. O LASTRO recuperou a proposta após recarregar a aba e emitiu a revisão com esse roteiro. A projeção para 5.000 peças apresentou 10 horas mensais estimadas.
- O REVEZA manteve um pedido na ficha original e aplicou a revisão ao pedido pendente em um plano salvo. Os testes rejeitaram a remoção de um pedido protegido e a emissão de uma PO com prévia vencida.
- As 11 rotas passaram em 1440, 390 e 320 px. A posição e o tamanho da marca foram conferidos na instância atualizada em 8788, com a base local existente.

## Validação da publicação

- Em uma cópia limpa do código, a instalação por `npm ci` no Windows com Node.js 24.15.0 passou. O build, o lint, a checagem de tipos e os 55 testes também passaram.
- O comando de produção serviu as 11 rotas e o endpoint de saúde. Uma ficha demonstrativa foi emitida, recuperada após reiniciar o processo com o mesmo SQLite e exportada em Excel.
- A lista de publicação foi verificada com `git diff --cached --check` e uma varredura de segredos. O `.env` de exemplo contém a variável de transcrição vazia. O kit oficial ficou na pasta local e passou na comparação das 44 células e do TP de `0,940944 min`.
