# Pomodoro

[Voltar à coleção](../../README.md)

Cronômetro de estudos independente: escolhe-se a duração, e as pausas são calculadas proporcionalmente. Não precisa dos Pets e não acessa dados deles.

## Instalar

Na raiz do repositório:

```sh
node scripts/install.mjs --only pomodoro
```

Reinicie o OMP e digite `/pomodoro`.

## Comandos

```text
/pomodoro
/pomodoro iniciar
/pomodoro iniciar 50
/pomodoro pausar
/pomodoro continuar
/pomodoro cancelar
/pomodoro tempos 30
```

Escolha de 1 a 180 minutos inteiros por estudo. `/pomodoro iniciar` pergunta o tempo para cada novo estudo; o número também pode ser passado diretamente.

- Pausa normal: **20% do estudo**, arredondados ao minuto mais próximo, com mínimo de 1 minuto.
- Após quatro estudos completos: pausa longa de **três vezes a pausa normal**, calculada a partir do último estudo.
- Um aviso aparece ao concluir. O próximo estudo ou pausa só começa ao escolher **Iniciar**.
- Pausar guarda o restante; cancelar descarta o ciclo atual sem contá-lo como concluído.
- Para ajustar o tempo, conclua ou cancele o ciclo atual, inclusive a pausa pendente.

| Estudo | Pausa normal | Pausa longa após o 4º estudo |
| --- | --- | --- |
| 25 min | 5 min | 15 min |
| 30 min | 6 min | 18 min |
| 50 min | 10 min | 30 min |
| 60 min | 12 min | 36 min |

## Funcionamento

O cronômetro e os avisos rodam dentro do OMP, sem chamadas de IA. Mantenha o OMP aberto. Ao fechar normalmente, a sessão fica pausada e pode ser retomada. Em encerramentos forçados, a recuperação usa o último estado salvo, podendo perder parte do tempo já transcorrido.

Arquivo instalado: `agent/extensions/pomodoro.js`.

Dados locais: `agent/extensions/pomodoro-data/pomodoro.json` e `completed.log`. A extensão não migra o cronômetro da antiga versão combinada e não compartilha esses arquivos com Pets.

## Integração opcional com Pets

Ao concluir um estudo, a extensão emite `extensoes-omp:pomodoro:completed` com `{ id }`. Se Pets estiver carregado na mesma sessão, ele registra +50 XP uma única vez. Sem Pets, o cronômetro funciona normalmente e registra apenas suas sessões concluídas. Não há XP retroativo.

Ocultar ou remover Pets não desliga o Pomodoro. Cada extensão tem seu próprio comando, widget e dados.
