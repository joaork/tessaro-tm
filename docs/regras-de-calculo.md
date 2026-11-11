# Regras de cálculo

O motor implementa as fórmulas do Regulamento Oficial do Hackathon Auto-T&M Karsten.

| Parcela | Regra | Unidade |
| --- | --- | --- |
| FIXO | Comprimento da costura × fator de tempo por metro da máquina | min |
| MTM | Soma do tempo unitário de cada ocorrência do roteiro na ordem informada | min |
| TP | FIXO + MTM | min |

Use o comprimento informado em metros. As dimensões da peça são dados de identificação, e o comprimento da costura pode ter origem distinta da geometria da peça. A ficha informa densidade em pontos/cm e RPM padrão. As faixas inferior e superior de RPM são calculadas como 90% e 110% do RPM padrão para reproduzir campos do gabarito. FIXO e TP independem da densidade e do RPM.

## Entradas e precisão

- Comprimento, densidade, RPM e fator devem ser maiores que zero. Tempo unitário MTM pode ser zero, como acontece no código `1.1` do kit.
- O formulário aceita vírgula ou ponto decimal sem separador de milhar. A validação permite até 12 algarismos inteiros e 18 fracionários. O motor opera com coeficiente inteiro `BigInt` e escala decimal. Cada produto e soma preserva o valor exato.
- Códigos são identificadores textuais. O cálculo consulta cada posição e apresenta a linha correspondente, inclusive para códigos repetidos. Código desconhecido ou máquina ausente bloqueia o cálculo e gera feedback.
- Roteiro vazio representa somente costura de máquina e resulta em MTM zero e TP igual ao FIXO. É uma decisão de escopo para aceitar operações compostas apenas por costura. A Engenharia da Karsten pode confirmar se quer restringir esse caso no piloto.
- A interface e o Excel apresentam minutos com quatro casas. A regra é arredondar para cima quando o primeiro algarismo descartado é 5 ou maior. A soma usa as parcelas exatas, portanto a soma visual das linhas já arredondadas pode diferir na última casa em outras operações.
- A aba **Memória** do Excel preserva os decimais exatos como texto. Na aba **PO**, números de apresentação com mais de 15 algarismos significativos ficam em texto para preservar a precisão que o Excel perderia em células numéricas.

## Cenário oficial

| Campo | Valor |
| --- | --- |
| Ficha e revisão | `PO-SL-001` / `00` |
| Operação | Bainhar no corpo do SL - 1 lado |
| Família e tamanho | Sobre-lençol / Solteiro |
| Dimensões da peça | 1,80 × 2,50 m |
| Comprimento de costura | 6,96 m |
| Densidade | 2,50 pontos/cm |
| Máquina | `1` · Interlock · Jack C4 · 5.000 RPM |
| Fator | 0,0964 min/m |
| Roteiro | `2.1` (0,15 min), `1.1` (0 min), `3.1` (0,12 min) |

O FIXO exato é `0,670944 min`. A soma MTM é `0,27 min`. O TP exato é `0,940944 min`. A apresentação mostra `0,6709 min` para FIXO e `0,9409 min` para TP. A faixa de RPM é 4.500–5.500.

O gabarito `PO-SL-000.ods` guarda FIXO como `0,6709 min` e termina na última linha MTM. Confira nele o cabeçalho, a posição, os códigos, as descrições, os tempos unitários e o FIXO a quatro casas. Confira TP por cálculo independente a partir do regulamento. O exportador inclui uma linha de TP para atender ao requisito da ficha.
