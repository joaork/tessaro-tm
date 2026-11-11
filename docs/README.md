# Documentação do Tessaro T&M

Para instalar e abrir a aplicação, comece pelo [README do projeto](../README.md).

| Objetivo | Documento |
| --- | --- |
| Entender a oportunidade e as hipóteses | [Estudo de caso](estudo-de-caso.md) e [proposta de valor](problema-e-proposta-de-valor.md) |
| Conferir o que a entrega precisa demonstrar | [Requisitos e critérios de aceitação](requisitos-e-criterios-de-aceitacao.md) |
| Entender o projeto e as escolhas técnicas | [Arquitetura](arquitetura.md), [modelo de dados](modelo-de-dados.md) e [decisões técnicas](decisoes-tecnicas.md) |
| Conferir cálculo e ingestão | [Regras de cálculo](regras-de-calculo.md), [importação](importacao-de-dados.md) e [referências](referencias/README.md) |
| Usar os quatro módulos integrados | [Fluxo integrado da PO ao turno](fluxo-integrado.md) |
| Reproduzir verificações | [Plano de testes](plano-de-testes.md) |
| Instalar em uma VPS Linux | [Guia de implantação](deploy-vps.md) |
| Preparar apresentação e arguição | [Pitch de 5 minutos](pitch-5-minutos.md) e [perguntas da banca](perguntas-da-banca.md) |
| Preparar uma conversa de piloto | [Validação com a Karsten](validacao-com-a-karsten.md), [business case e ROI](business-case-e-roi.md) e [roadmap](roadmap.md) |

## Checklist de entrega

### A · Auditoria

- [x] Inspecionar a pasta de trabalho, a estrutura Git e os arquivos.
- [x] Ler regulamento, kit, demanda e gabarito.
- [x] Definir prioridades e registrar as decisões.

### B · Fundação

- [x] Definir identidade, modelo de dados e regras.
- [x] Escrever o guia de manutenção.
- [x] Registrar os resultados da suíte, incluindo o motor isolado.

### C · Fluxo funcional

- [x] Conferir importação das duas bases oficiais no navegador.
- [x] Conferir operação, roteiro, prévia, histórico e download do Excel no navegador.
- [x] Concluir a revisão de estados vazios, edições de catálogo e erros pelo navegador.

### D · Qualidade

- [x] Registrar suíte, lint, tipos e build.
- [x] Reproduzir o cenário oficial com os serviços de ingestão e exportação.
- [x] Conferir fluxo no navegador e navegação em tela de 390 px.
- [x] Conferir os dois modos de execução com banco vazio e portas isoladas.
- [x] Conferir que o Git ignora as referências oficiais, o banco e `.env`.
- [x] Revisar a lista final de arquivos antes da publicação.

### E · Banca

- [x] Preparar pitch, demonstração e perguntas.
- [x] Emitir, baixar e conferir o conteúdo da ficha oficial no ensaio técnico.
- [ ] Ensaiar o pitch cronometrado e conferir a impressão.
- [x] Repetir a instalação em uma cópia limpa dos arquivos da entrega.
- [x] Publicar o [repositório da entrega](https://github.com/joaork/tessaro-tm).

O [plano de testes](plano-de-testes.md) concentra as evidências de execução. Atualize o checklist quando cada verificação tiver resultado registrado.
