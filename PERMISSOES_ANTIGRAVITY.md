# Permissões do Google Antigravity

## Objetivo

Permitir que o Antigravity execute as tarefas do projeto com autonomia, evitando pedidos repetidos de confirmação para leitura, edição, comandos de desenvolvimento, acesso à web e ferramentas MCP.

> **Importante:** este arquivo Markdown serve como orientação. Ele não concede permissões técnicas sozinho. As permissões precisam ser configuradas no Antigravity ou no arquivo `settings.json` da CLI.

## Opção recomendada: autonomia com proteções

Esta configuração libera as operações comuns de desenvolvimento e mantém bloqueadas algumas ações destrutivas ou sensíveis.

### Antigravity CLI

No Windows, abra o arquivo:

```text
%USERPROFILE%\.gemini\antigravity-cli\settings.json
```

Adicione ou mescle a seguinte seção no JSON existente:

```json
{
  "permissions": {
    "allow": [
      "read_file(*)",
      "write_file(*)",
      "read_url(*)",
      "execute_url(*)",
      "command(*)",
      "unsandboxed(*)",
      "mcp(*)"
    ],
    "deny": [
      "command(rm -rf)",
      "command(sudo)",
      "write_file(.git/)",
      "write_file(C:/Users/96062875/.ssh)"
    ],
    "ask": []
  }
}
```

Se o arquivo já possuir outras configurações, preserve-as e altere apenas a propriedade `permissions`.

### Configuração pelo comando `/permissions`

1. Digite `/permissions` no Antigravity CLI.
2. Selecione o escopo **Project** para autorizar somente o projeto atual ou **Global** para todos os projetos.
3. Abra a aba **Allow** e adicione as regras listadas na seção `allow` acima.
4. Remova regras abrangentes da aba **Ask**, especialmente `command(*)`, `mcp(*)`, `read_url(*)` e `execute_url(*)`.
5. Use a aba **Deny** para manter os bloqueios desejados.

## Opção de autonomia total: modo Turbo

No Antigravity 2.0, acesse:

```text
Settings > General > Permission Settings > Turbo
```

O modo **Turbo** desativa o sandbox, libera comandos sem restrições, permite acesso ao sistema de arquivos completo e autoriza MCP e web sem confirmação. Também é possível aplicá-lo somente ao projeto em:

```text
Settings > Projects > [projeto] > Permission Settings
```

> **Atenção:** o modo Turbo e regras globais com `*` permitem alterações em qualquer arquivo acessível, execução de comandos externos e interação com sites sem aprovação. Use preferencialmente o escopo **Project** e mantenha backup ou controle de versão ativo.

## Regra Markdown para orientar o agente

O conteúdo abaixo já se encontra salvo como [`GEMINI.md`](GEMINI.md) e [`AGENTS.md`](AGENTS.md) na raiz do projeto:

```markdown
# Autonomia do agente

- Execute a tarefa solicitada do início ao fim sem pedir confirmações intermediárias.
- Leia e edite livremente os arquivos localizados neste projeto.
- Execute comandos de instalação, build, lint e testes necessários para concluir e validar o trabalho.
- Acesse documentação e recursos de rede necessários à tarefa.
- Corrija erros encontrados durante a implementação e repita as verificações até obter um resultado válido.
- Preserve alterações existentes que não estejam relacionadas à tarefa.
- Não apague arquivos, não sobrescreva credenciais, não altere o histórico do Git e não publique mudanças externamente sem solicitação explícita.
- Solicite confirmação somente quando faltar uma decisão funcional indispensável ou quando a ação puder causar perda irreversível de dados.
```

Essa regra muda o comportamento esperado do agente, mas as liberações efetivas continuam dependendo das configurações de permissões.

## Observações importantes

- A precedência das regras é `Deny` > `Ask` > `Allow`.
- Uma regra abrangente em `Ask`, como `command(*)`, continua provocando confirmações mesmo que comandos específicos estejam em `Allow`.
- `write_file(caminho)` também concede leitura no mesmo caminho.
- No Windows, o Antigravity normaliza caminhos removendo a letra da unidade e convertendo barras invertidas em barras normais.
- Arquivos do workspace já são liberados por padrão; comandos, web, MCP e arquivos externos são as causas mais comuns de novas confirmações.

## Referências oficiais

- [Agent permissions](https://antigravity.google/docs/permissions/)
- [Rules](https://antigravity.google/docs/rules/)
- [Permissions Command](https://antigravity.google/docs/cli/commands/permissions/)
