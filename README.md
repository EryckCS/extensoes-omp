# Extensões OMP

Coleção pessoal de extensões para o [Oh My Pi](https://github.com/can1357/oh-my-pi). Cada extensão tem sua própria pasta, arquivo e guia, e pode ser instalada individualmente.

## Pets

Axolote **Loti**, passarinho **Piu** e gato **Mochi** para acompanhar o terminal, com desenhos coloridos, animações, nomes, cores, vínculo, XP e níveis.

- **Pasta:** [`extensions/pets/`](extensions/pets/)
- **Comando:** `/pet`
- **Dados locais:** `axolote-data/`
- **Funciona sozinho:** sim; não precisa do Pomodoro.

```sh
node scripts/install.mjs --only pets
```

[Comandos e documentação dos Pets](extensions/pets/README.md)

---

## Pomodoro

Cronômetro de estudo com duração escolhida pelo usuário, pausa normal de **20% do estudo**, pausa longa após quatro sessões, avisos e controles de iniciar, pausar, continuar e cancelar.

- **Pasta:** [`extensions/pomodoro/`](extensions/pomodoro/)
- **Comando:** `/pomodoro`
- **Dados locais:** `pomodoro-data/`
- **Funciona sozinho:** sim; não precisa dos Pets.

```sh
node scripts/install.mjs --only pomodoro
```

[Comandos e documentação do Pomodoro](extensions/pomodoro/README.md)

---

### Usar as duas juntas

Quando Pets e Pomodoro estão carregados na **mesma sessão do OMP**, concluir um estudo concede **50 XP aos pets**. A comunicação é por evento; uma extensão não importa o código nem acessa os arquivos da outra. Sessões concluídas sem Pets carregado não concedem XP retroativo.

Ambas funcionam localmente, sem chamadas de IA. Perguntas enviadas normalmente ao OMP continuam usando seu provedor.

## Instalar em outro PC

Requisitos: Oh My Pi (API de extensões desenvolvida para **18.0.11**), Node.js **20+** para o instalador e terminal com fonte monoespaçada. Não é preciso executar `npm install`.

Feche o OMP. No PowerShell, Linux ou macOS:

```sh
git clone https://github.com/EryckCS/extensoes-omp.git
cd extensoes-omp
node scripts/install.mjs
omp
```

Sem `--only`, o instalador instala **todas as extensões do catálogo**. Para instalar apenas uma, use o comando do bloco correspondente acima. `--only` não remove outras extensões independentes já instaladas.

Como o repositório é privado, entre com a conta GitHub que tem acesso. Também é possível usar **Code → Download ZIP**, extrair e executar o instalador dentro da pasta baixada.

```sh
node scripts/install.mjs --list
node scripts/install.mjs --agent-dir "CAMINHO_DA_PASTA_AGENT"
node scripts/install.mjs --only pets --agent-dir "CAMINHO_DA_PASTA_AGENT"
```

O destino padrão é `~/.omp/agent/extensions/`. As variáveis `PI_CODING_AGENT_DIR` e `OMP_CODING_AGENT_DIR` são aceitas. Consulte a pasta ativa com `omp config path`; para perfis, informe a pasta **agent** correspondente, não a subpasta `extensions`.

### Instalação manual

Copie somente os arquivos desejados, com o OMP fechado:

| Origem | Destino dentro da pasta `agent` |
| --- | --- |
| [`extensions/pets/axolote.js`](extensions/pets/axolote.js) | `extensions/axolote.js` |
| [`extensions/pomodoro/pomodoro.js`](extensions/pomodoro/pomodoro.js) | `extensions/pomodoro.js` |

Guarde backup dos arquivos anteriores fora de `extensions` e reinicie o OMP. Cada arquivo é autocontido; não copie várias versões da mesma extensão, pois isso duplica comandos.

## Atualizar

```sh
git pull --ff-only
node scripts/install.mjs
```

Feche o OMP antes e abra novamente depois. Backups do código substituído ficam em `agent/backups/extensoes-omp/`.

### Quem usava a versão combinada

A antiga extensão **Pets + Pomodoro** foi separada:

- Instalar as duas substitui `axolote.js` pela versão somente Pets e adiciona `pomodoro.js`.
- Instalar somente Pets substitui a versão combinada por Pets.
- Instalar somente Pomodoro arquiva o antigo `axolote.js` combinado em backup, evitando dois comandos `/pomodoro` concorrentes. Uma versão independente dos Pets já instalada é mantida.
- O novo Pomodoro usa `pomodoro-data/` e começa com um cronômetro novo; ele não importa o cronômetro da versão combinada.
- Na instalação manual, retire a versão combinada antiga antes de adicionar o Pomodoro separado.

## Instalação nova para cada usuário

O repositório contém apenas código, testes e documentação. Não inclui chaves, XP, preferências nem cronômetros pessoais. Uma instalação nova começa com **0 XP, nível 1**, os pets padrão e nenhum estudo em andamento.

Os dados criados durante o uso são locais e ignorados pelo Git:

- Pets: `agent/extensions/axolote-data/`.
- Pomodoro: `agent/extensions/pomodoro-data/`.

Atualizar uma instalação existente mantém seus dados locais. Para zerar uma extensão, feche o OMP e mova a pasta de dados correspondente para outro lugar. Não é necessário transferir dados entre computadores.

Use uma sessão do OMP por pasta de dados: múltiplas janelas não coordenam seus cronômetros entre si.

## Adicionar outra extensão

1. Crie `extensions/nome-da-extensao/`.
2. Adicione o arquivo `.js` e um `README.md` próprio.
3. Registre-a em [`extensions.json`](extensions.json).
4. Crie **um novo bloco neste README**, com descrição, pasta, comando e instalação individual, seguindo os blocos acima.
5. Acrescente os testes relevantes e execute `npm test`.

Exemplo de registro:

```json
{
  "id": "minha-extensao",
  "name": "Minha extensão",
  "description": "O que ela faz.",
  "file": "extensions/minha-extensao/index.js",
  "installAs": "minha-extensao.js",
  "docs": "extensions/minha-extensao/README.md"
}
```

O instalador distribui um arquivo JavaScript por extensão. Para módulos ou recursos adicionais, amplie o instalador antes de cadastrar a extensão. Nunca inclua chaves de API nem a pasta pessoal do OMP no repositório.

## Remover ou reverter

Com o OMP fechado, mova apenas o arquivo da extensão desejada para fora de `agent/extensions/`. Guarde sua pasta de dados se quiser manter o progresso. Para reverter uma atualização, restaure o arquivo do backup.

## Testes

```sh
npm run check
npm test
```

Os testes verificam cada extensão isoladamente, a integração opcional de XP, o relógio, a recuperação, o layout e a instalação individual, conjunta e sobre a versão antiga. O GitHub Actions executa as verificações em Windows, Linux e macOS. Os testes simulam a API do OMP; a aparência também depende do terminal.

```text
extensions/
  pets/
    axolote.js
    README.md
  pomodoro/
    pomodoro.js
    README.md
extensions.json
scripts/install.mjs
tests/
```

Coleção pessoal; não é um pacote oficial do Oh My Pi.
