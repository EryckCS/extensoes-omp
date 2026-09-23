# Pets

[Voltar à coleção](../../README.md)

Extensão independente com axolote, passarinho e gato. Não contém cronômetro nem exige Pomodoro.

## Instalar

Na raiz do repositório:

```sh
node scripts/install.mjs --only pets
```

Reinicie o OMP e digite `/pet`.

## Comandos

| Comando | Ação |
| --- | --- |
| `/pet` | Abrir o menu |
| `/pet axolote` | Escolher Loti |
| `/pet passarinho` | Escolher Piu |
| `/pet gato` | Escolher Mochi |
| `/pet todos` | Mostrar os três quando houver espaço |
| `/pet solo` | Mostrar só o escolhido |
| `/pet carinho` | Fazer carinho |
| `/pet alimentar` | Dar comida |
| `/pet brincar` | Brincar |
| `/pet dormir` | Mostrar o pet dormindo |
| `/pet nome Amora` | Mudar o nome do escolhido |
| `/pet cor lilas` | Mudar a cor do escolhido |
| `/pet ocultar` | Ocultar os pets |
| `/pet mostrar` | Mostrar os pets |

Cores: `rosa`, `lilas`, `azul`, `verde`, `amarelo` e `caramelo`.

Nome, cor e vínculo pertencem a cada pet. XP e nível são compartilhados pelo jardim. Os três desenhos aparecem juntos a partir de 83 colunas; abaixo disso, só o escolhido. Use fonte monoespaçada.

## XP e vínculo

- +10 XP por mensagem interativa não vazia; comandos `/...` e mensagens automáticas não pontuam.
- 100 XP por nível; começa no nível 1.
- A cada três cuidados, preenche um ponto de vínculo: `[.....]` → `[*....]` → `[*****]`.
- Opcional: se a extensão Pomodoro estiver carregada na mesma sessão, cada estudo concluído dá +50 XP, uma vez por sessão de estudo. Não há recompensas retroativas por usar Pomodoro sozinho.

O XP mede atividade no aplicativo, não compreensão do conteúdo.

## Dados

Arquivo instalado: `agent/extensions/axolote.js`.

Dados locais: `agent/extensions/axolote-data/pet.json` e `perguntas.log`. Não são incluídos no GitHub e não contêm perguntas nem chaves. Uma nova instalação começa do zero.

A extensão escuta o evento opcional `extensoes-omp:pomodoro:completed` e deduplica o identificador da sessão. Não lê arquivos nem importa código do Pomodoro.
