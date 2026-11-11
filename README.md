# Tessaro T&M

**Plataforma de Engenharia de Tempos e Métodos** desenvolvida pela equipe **Tessaro Soluções** para o Hackathon Auto-T&M Karsten.

O Tessaro T&M transforma dados do produto, parâmetros de máquinas e uma sequência de elementos MTM em uma ficha de Processo Operacional (PO). A ficha detalha o tempo de costura, os tempos manuais e o total da operação. A equipe de engenharia pode conferir cada parcela e exportar a ficha em Excel.

## O que a aplicação oferece

- Painel de trabalho com atalhos para o fluxo da PO, fichas recentes e cadastros.
- Cadastros de máquinas e elementos MTM com edição manual e importação de ODS, Excel e CSV.
- Assistente para escolher aba e cabeçalho, mapear colunas, conferir a prévia e corrigir erros antes de gravar.
- Operação com produto, medidas, densidade, máquina e roteiro ordenado. O formulário também recebe o TXT de demanda e permite colar os códigos do roteiro. O mesmo código MTM pode aparecer mais de uma vez.
- Prévia da ficha com memória de cálculo, histórico local de fichas emitidas, impressão pelo navegador e exportação `.xlsx` com abas **PO** e **Memória**.
- Calculadora de estimativa de ROI com entradas em branco.
- **OFÍCIO** para transformar relatos em um roteiro MTM revisável.
- **TRAMA** para testar roteiros MTM e máquinas compatíveis e encaminhar a proposta para revisão.
- **LASTRO** para identificar fichas afetadas, aprovar revisões e emitir fichas em lote.
- **REVEZA** para programar e replanejar o turno com as fichas vigentes.

O [guia do fluxo integrado](docs/fluxo-integrado.md) mostra como sair de um relato e chegar a um plano salvo. O OFÍCIO grava, reproduz e baixa áudio localmente. A transcrição usa a variável TESSARO_OPENAI_API_KEY no arquivo .env do servidor.

A interface usa Next.js com App Router, React e TypeScript. O painel organiza a operação em etapas, com navegação lateral, uma barra de ferramentas e cores próprias para cada módulo. A API é um monólito modular em Fastify, com SQLite local, validação em Zod, leitura de planilhas com SheetJS e exportação com ExcelJS. Consulte a [arquitetura](docs/arquitetura.md).

## Instalação e execução

Use Node.js **24.15 ou posterior da série 24** e npm. O ambiente de referência usa Node.js 24.15.0 e npm 11.12.1. As dependências precisam ser baixadas na primeira instalação.

Clone o repositório e abra o terminal na pasta que contém `package.json`.

```powershell
git clone https://github.com/joaork/tessaro-tm.git
cd tessaro-tm
```

```powershell
npm.cmd ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run dev
```

Em macOS ou Linux, use `npm` no lugar de `npm.cmd` e `cp .env.example .env` para criar `.env` caso ele ainda não exista.

Abra [http://127.0.0.1:5173](http://127.0.0.1:5173). O Next.js encaminha `/api` ao Fastify em `127.0.0.1:8787`. O arquivo `.env` permite mudar `TESSARO_WEB_PORT`, `TESSARO_PORT` e `TESSARO_DB`. Na configuração inicial, o servidor cria o banco `data/tessaro.sqlite` e suas tabelas no primeiro uso. Use outro caminho em `TESSARO_DB` se precisar de uma base separada para ensaiar.

Para rodar o build com a interface e a API na mesma porta:

```powershell
npm.cmd run build
npm.cmd start
```

Abra [http://127.0.0.1:8787](http://127.0.0.1:8787) nesse modo. Encerre a execução de desenvolvimento antes de usar a mesma porta no modo de build.

Para hospedar em Linux, use o [guia de implantação em VPS](docs/deploy-vps.md), com serviço systemd, SQLite persistente e acesso por HTTPS.

## Dados e primeira ficha

1. Em **Painel de trabalho → Bases de apoio**, carregue os dados demonstrativos para explorar a aplicação. Os códigos `DEMO-` identificam referências fictícias. Para a prova do desafio, use o kit oficial em uma base separada.
2. Com acesso ao kit, abra **Importar dados** e carregue `Entradas.ods` duas vezes. Importe **Elementos MTM** na aba `MATRIZ_DE_ELEMENTOS` e **Máquinas** na aba `TEMPO-CM`. Confira o cabeçalho, os campos mapeados e o resultado da validação antes de confirmar. O kit contém nove códigos MTM em seis agrupadores e três máquinas. Consulte o [guia de importação](docs/importacao-de-dados.md).
3. Abra **Nova operação**. Preencha os parâmetros, escolha a máquina e monte a sequência de códigos MTM. Confira as descrições e tempos apresentados.
4. Clique em **Calcular prévia**, confira o cálculo e use **Salvar ficha PO**. Na ficha do **Histórico de POs**, escolha **Baixar Excel** ou **Imprimir**.

O kit e o regulamento ficam como referências locais. O [guia de acesso às referências](docs/referencias/README.md) identifica o material e sua origem. A aplicação também funciona com cadastros próprios ou com os dados demonstrativos.

## Demonstração oficial

Em **Nova operação**, importe `demanda_000.txt` para preencher a ficha `PO-SL-001`, revisão `00`, para o sobre-lençol solteiro. Confira comprimento de costura de **6,96 m**, densidade de **2,50 pontos/cm**, máquina `1` e sequência `2.1 → 1.1 → 3.1`. As dimensões **1,80 × 2,50** identificam o produto. O comprimento da costura é o valor fornecido na demanda.

`FIXO = 6,96 m × 0,0964 min/m = 0,670944 min`

`MTM = 0,15 + 0 + 0,12 = 0,27 min`

`TP = 0,670944 + 0,27 = 0,940944 min`

A ficha exibe quatro casas decimais. Confira FIXO `0,6709` e TP `0,9409`. O gabarito permite comparar o cabeçalho e as linhas FIXO e MTM. O TP vem da fórmula do regulamento, pois o gabarito termina na última linha MTM. RPM e densidade são dados da ficha. A fórmula do FIXO usa somente o comprimento e o fator da máquina.

O [pitch cronometrado](docs/pitch-5-minutos.md) indica a ordem das telas e os pontos de conferência. Para registrar capturas após o ensaio, use a prévia da PO, a tela de mapeamento e o histórico. Exporte imagens do ambiente local que possam ser divulgadas.

## Verificações

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Com os três arquivos originais na pasta `docs/referencias/kit-oficial/`, execute a validação do cenário oficial:

```powershell
npm.cmd run validate:kit
```

Na validação oficial, o script importou as duas bases, conferiu 44 células preenchidas com o gabarito e verificou o TP pela fórmula. A mesma comparação passou com a ficha baixada no navegador. Para verificar um download próprio, informe a pasta do kit e o caminho da planilha.

```powershell
npm.cmd run validate:kit -- 'docs/referencias/kit-oficial' 'CAMINHO_DA_FICHA.xlsx'
```

O [plano de testes](docs/plano-de-testes.md) reúne os resultados da suíte, da conferência oficial e do ensaio no navegador.

## Organização

| Caminho | Conteúdo |
| --- | --- |
| `src/client/` | Interface web, formulários e ficha PO |
| `src/server/` | API, cálculo, persistência, ingestão e exportação |
| `src/shared/` | Contratos, validações e aritmética decimal |
| `scripts/` | Validação com os arquivos oficiais locais |
| `tests/` | Suíte automatizada |
| `docs/` | Regras, referências locais, testes, roteiro da banca e piloto |

O MVP é uma aplicação local para demonstração e uso individual. A etapa de piloto prevê autenticação, permissões e processo de aprovação. Integração com ERP/PPCP e comparação entre tempos padrão e observados dependem de dados e acordos da empresa. Consulte o [roadmap](docs/roadmap.md) e o [índice da documentação](docs/README.md).

**Tessaro T&M — uma solução Tessaro Soluções.**
