# Pets + Pomodoro

Axolote **Loti**, passarinho **Piu** e gato **Mochi**: companheiros coloridos para estudar no Oh My Pi, com XP, nível e vínculo.

[Voltar à coleção e às instruções de instalação](../../README.md)

```text
 POMODORO | Estudo 25:00 | em curso
 JARDIM DOS PETS | Lv. 1 [====------] 40/100 XP

 > Loti - axolote            + Piu - passarinho       + Mochi - gato
    o      .      o               .      *                .            .
     \|/     \|/                      ,_,                     /\___/\
    --.-------.--                   .-----.                  ( o   o )
   --( o  v  o )--                 ( o > o )                =(  =^=  )=
    --'-------'--                  /|  \_/  |\                /  (_)  \  ,
      /(_) (_)\___)                '-------'                (u       u)/ )
     ~~~~~~~~~~~~~~              -----^--^-----               '-------'--'
```

## Comandos dos pets

| Comando | Ação |
| --- | --- |
| `/pet` | Abrir o menu interativo |
| `/pet axolote` | Escolher o axolote |
| `/pet passarinho` | Escolher o passarinho |
| `/pet gato` | Escolher o gato |
| `/pet todos` | Mostrar os três quando houver espaço |
| `/pet solo` | Mostrar somente o escolhido |
| `/pet carinho` | Fazer carinho |
| `/pet alimentar` | Dar comida |
| `/pet brincar` | Brincar |
| `/pet dormir` | Mostrar o pet dormindo |
| `/pet nome Amora` | Renomear o escolhido |
| `/pet cor lilas` | Trocar a cor do escolhido |
| `/pet ocultar` | Ocultar os desenhos; Pomodoro ativo permanece visível |
| `/pet mostrar` | Mostrar novamente |
| `/pet pomodoro` | Abrir o menu de estudos |
| `/pet foco 50` | Iniciar 50 minutos de estudo |

Cores: `rosa`, `lilas`, `azul`, `verde`, `amarelo` e `caramelo`. Nome, cor e vínculo são individuais por pet; XP e nível são compartilhados pelo jardim. As interações têm pequenas animações locais e não fazem chamadas de IA.

Os três aparecem juntos a partir de 83 colunas. Em uma janela menor aparece o escolhido; em espaços muito estreitos, apenas um resumo.

## XP e vínculo

- **10 XP** por mensagem não vazia enviada por você no modo interativo. Comandos `/...` e mensagens automáticas de extensões não dão XP.
- **50 XP** por estudo completo no Pomodoro; pausas não dão XP extra.
- **100 XP** por nível, começando no nível 1.
- A cada três cuidados (carinho, alimentação ou brincadeira), um ponto de vínculo é preenchido: `[.....]` → `[*....]` → `[*****]`.

O XP representa atividade no aplicativo; não mede compreensão da matéria nem valida a resposta da IA.

## Pomodoro com pausa proporcional

```text
/pomodoro
/pomodoro iniciar
/pomodoro iniciar 50
/pomodoro pausar
/pomodoro continuar
/pomodoro cancelar
/pomodoro tempos 30
```

Escolha de **1 a 180 minutos inteiros** por estudo. `/pomodoro iniciar` pergunta o tempo antes de cada novo estudo; você também pode fornecê-lo no comando.

- Pausa normal = **20% do estudo**, arredondados ao minuto mais próximo, com mínimo de 1 minuto.
- Após quatro estudos completos, a pausa longa vale **três vezes a pausa normal**, calculada a partir do último estudo concluído.
- Ao terminar, um aviso aparece. O próximo estudo ou pausa começa quando você escolhe **Iniciar**.
- Pausar guarda o tempo restante. Cancelar não concede XP extra pelo trecho cancelado e mantém as recompensas anteriores.
- Para mudar o tempo, conclua ou cancele o ciclo atual, inclusive a pausa pendente.

| Estudo | Pausa normal | Pausa longa após o 4º estudo |
| --- | --- | --- |
| 25 min | 5 min | 15 min |
| 30 min | 6 min | 18 min |
| 50 min | 10 min | 30 min |
| 60 min | 12 min | 36 min |

O cronômetro roda com o OMP aberto. Ao fechar normalmente, o restante é salvo como pausado: use `/pomodoro continuar` ao voltar. Em encerramentos forçados, o último estado salvo é recuperado e parte do progresso daquele ciclo pode se perder. Reabrir o OMP dias depois não conclui sessões automaticamente.

## Problemas comuns

- **`/pet` não aparece:** reinicie o OMP e confira a pasta de extensões do perfil ativo.
- **Só um pet aparece:** execute `/pet todos` e amplie a janela para pelo menos 83 colunas.
- **Linhas tortas:** use fonte monoespaçada. Os desenhos usam ASCII para evitar diferenças de largura entre símbolos.
- **O pet não dorme durante o foco:** enquanto o Pomodoro roda, a expressão acompanha estudo ou pausa.
- **Erro 401:** é da autenticação do provedor de IA. A extensão não precisa de chave própria.
- **Instalação nova:** começa com 0 XP, nível 1 e os pets padrão. Não é preciso copiar dados pessoais.

Arquivo instalado: `agent/extensions/axolote.js`. Dados: `agent/extensions/axolote-data/`.

