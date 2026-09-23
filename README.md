# Extensões OMP

Minha coleção de extensões para o [Oh My Pi](https://github.com/can1357/oh-my-pi), organizada para instalar em qualquer um dos meus computadores e receber novas personalizações.

## Extensões disponíveis

| Extensão | O que faz | Documentação |
| --- | --- | --- |
| **Pets + Pomodoro** | Axolote, passarinho e gato com XP, níveis, vínculo, cuidados e cronômetro de estudo com pausas proporcionais | [Guia completo](extensions/pets-pomodoro/README.md) |

Os pets e o cronômetro funcionam localmente e não fazem chamadas de IA. Perguntas enviadas normalmente ao OMP continuam consumindo o provedor configurado nele.

## Instalação rápida

Requisitos:

- Oh My Pi instalado. Pets + Pomodoro foi desenvolvido para a API de extensões da versão **18.0.11**.
- **Node.js 20 ou superior** para o instalador e os testes. As extensões atuais rodam dentro do OMP, sem dependências externas.
- Git para clonar, ou **Code → Download ZIP** no GitHub para baixar a pasta.
- Terminal com fonte monoespaçada e cores ANSI.

Feche o OMP. No PowerShell, Linux ou macOS:

```sh
git clone https://github.com/EryckCS/extensoes-omp.git
cd extensoes-omp
node scripts/install.mjs
omp
```

Como o repositório é privado, use a conta GitHub com acesso para clonar ou baixar o ZIP. Se baixou o ZIP, entre na pasta extraída e comece pelo comando `node scripts/install.mjs`.

Dentro do OMP:

```text
/pet
/pomodoro
```

Não é necessário executar `npm install`. O instalador copia as extensões cadastradas em [extensions.json](extensions.json), faz backup dos arquivos substituídos e preserva seu progresso.

### Instalar uma extensão ou listar o catálogo

```sh
node scripts/install.mjs --list
node scripts/install.mjs --only pets-pomodoro
```

### Pasta personalizada ou perfis

Destino padrão: `~/.omp/agent/extensions/`, onde `~` é sua pasta de usuário. O instalador também respeita `PI_CODING_AGENT_DIR` e `OMP_CODING_AGENT_DIR`.

Consulte a pasta ativa com `omp config path`. Para um destino diferente, inclusive a pasta de um perfil:

```sh
node scripts/install.mjs --agent-dir "CAMINHO_DA_PASTA_AGENT"
```

Informe a pasta **agent**, não `extensions`. Não instale uma segunda cópia da mesma extensão com outro nome, pois isso pode duplicar menus e recompensas.

### Instalação manual, sem Node.js

1. Baixe e extraia este repositório.
2. Crie `extensions` dentro da pasta `agent` do OMP, se necessário.
3. Se já existir a extensão, guarde uma cópia fora de `extensions`.
4. Para Pets + Pomodoro, copie [axolote.js](extensions/pets-pomodoro/axolote.js) para `agent/extensions/axolote.js`.
5. Reinicie o OMP.

## Atualizar em qualquer PC

Feche o OMP. Na pasta clonada:

```sh
git pull --ff-only
node scripts/install.mjs
```

Depois abra o OMP novamente. Os backups do código anterior ficam em `agent/backups/extensoes-omp/`.

## Instalação nova para cada usuário

O repositório contém apenas código, testes e documentação. Ele não inclui XP, nomes personalizados, vínculos, cronômetros salvos, chaves de API ou configurações pessoais.

Em uma instalação nova, todos começam com **0 XP e nível 1**, os pets Loti, Piu e Mochi e nenhum cronômetro em andamento. Não é preciso copiar dados de outro computador.

Durante o uso, os dados são criados localmente em `agent/extensions/axolote-data/`, ignorada pelo Git. Reinstalar sobre uma instalação existente atualiza o código e mantém os dados que já estão naquele PC. Para começar do zero nesse caso, feche o OMP e mova a pasta `axolote-data` para outro local antes de abri-lo novamente.

Para um cronômetro previsível, use uma sessão do OMP por pasta de dados; múltiplas janelas não coordenam seus cronômetros entre si.

## Adicionar novas extensões à coleção

1. Crie uma pasta em `extensions/nome-da-extensao/`.
2. Coloque o arquivo `.js` e um `README.md` explicando seu uso.
3. Cadastre a extensão em `extensions.json`, seguindo o modelo existente.
4. Acrescente uma linha à tabela deste README.
5. Teste antes de enviar ao GitHub.

Exemplo de entrada no catálogo:

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

O instalador atual distribui **um arquivo JavaScript por extensão**. Esse arquivo deve ser autocontido ou usar apenas APIs fornecidas pelo OMP/Node. Para extensões com vários módulos ou outros recursos, amplie o instalador antes de cadastrá-las.

Nunca inclua chaves, bancos de autenticação ou toda a pasta pessoal do OMP. Coloque no repositório o código da extensão, testes e documentação.

## Remover ou reverter

Feche o OMP e mova o arquivo da extensão instalada para fora da pasta `extensions`. Guarde sua pasta de dados para preservar o progresso.

Para reverter uma atualização, restaure o arquivo correspondente de `agent/backups/extensoes-omp/` e abra o OMP novamente.

## Desenvolvimento e verificação

```sh
npm run check
npm test
```

Os testes usam pastas temporárias e relógio simulado. Eles verificam instalação, atualização com backup, preservação dos dados, Pomodoro, XP sem duplicação, recuperação e largura do desenho. O workflow executa os testes em **Windows, Linux e macOS**. A aparência final depende também da fonte do terminal e da versão do OMP.

```text
extensions.json                  Catálogo de extensões
extensions/pets-pomodoro/         Primeira extensão e seu guia
scripts/install.mjs              Instalador compartilhado
tests/                           Testes sem chamadas de IA
.github/workflows/                Verificação automática
```

Coleção pessoal. Não é um pacote oficial do Oh My Pi.

