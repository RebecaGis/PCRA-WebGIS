# PCRA · Plano Comunitário de Redução de Riscos (Parque Burnier)
## Guia de Permissões, Credenciais e Ajuste de Pontos na Plataforma WebGIS

Este documento consolida as diretrizes de acesso, autenticação e os procedimentos operacionais para utilização da funcionalidade **"Ajustar Pontos"** (Modo de Calibração e Reposicionamento Espacial) na plataforma WebGIS do PCRA.

---

## 1. O que é o Modo "Ajustar Pontos"?

No trabalho de campo, imprecisões no sinal de GPS de celulares ou sombreamentos causados pela topografia e vegetação podem deslocar alguns pontos de vistoria em relação à edificação real. 

A plataforma WebGIS conta com uma ferramenta nativa de **Calibração Espacial**, acessível pelo botão **"Ajustar Pontos"** na barra superior da aplicação.

Quando ativado:
1. **Desagrupamento Automático:** Todos os pontos saem do agrupamento (clusters) e ficam individualizados.
2. **Marcadores Arrastáveis:** Cada marcador de vistoria torna-se arrastável (*draggable*).
3. **Cálculo de Deslocamento em Tempo Real:** Ao soltar o marcador no telhado ou entrada correta da casa (utilizando a **Ortofoto de Drone HD** como base), o sistema calcula a distância métrica exata de deslocamento em relação ao GPS original e grava a nova coordenada com etiqueta `📌 Coordenada Ajustada`.
4. **Persistência Imediata:** A calibração fica salva no navegador (`localStorage`) e pode ser exportada em **GeoJSON**, **CSV** ou **JS global** para sincronização definitiva da base.

---

## 2. Controle de Acesso e Credenciais Atuais

Para evitar alterações acidentais por visitantes comuns, a funcionalidade é protegida por um modal de autenticação.

### 🔑 Credenciais Padrão Cadastradas

* **Usuários Autorizados:**
  * `admin`
  * `georebs`
  * `georebs@gmail.com`
  * `rebeca.moura@ufjf.br`
* **Senha Mestre:** `951951`

> 💡 **Nota de Sessão:** Uma vez autenticado, o acesso permanece liberado durante toda a navegação na mesma sessão do navegador (`sessionStorage`), dispensando nova digitação a cada clique.

---

## 3. Passo a Passo: Como Utilizar o Modo Ajuste

### Passo 1: Iniciar a Edição
1. Acesse a plataforma no navegador ([http://localhost:8085/](http://localhost:8085/) ou pelo arquivo compilado [`mapa-acompanhamento.html`](file:///C:/Users/96062875/Documents/PCRA/mapa-acompanhamento.html)).
2. No menu superior direito, clique no botão **"Ajustar Pontos"**.
3. Na janela de autenticação que se abrirá:
   * **Usuário:** `admin` (ou `georebs`)
   * **Senha:** `951951`
4. Clique em **"Desbloquear Modo Edição"**.

### Passo 2: Calibrar os Pontos no Mapa
1. Uma barra de aviso verde pulsante surgirá no topo do mapa indicando: `Modo de Ajuste Ativo · Arraste qualquer marcador no mapa para ajustar sua coordenada exata`.
2. *(Recomendado)* No painel **Camadas & Mapa Base**, ative a camada **"📸 Ortofoto Sobreposta (Drone)"** ou selecione o mapa base **"📸 Ortofoto Burnier (Drone)"** para enxergar com nitidez centimétrica o telhado da casa vistoriada.
3. Clique sobre o marcador desejado e **arraste-o** até a posição correta.
4. Ao soltar, uma janela de confirmação exibirá:
   * A nova coordenada calculada (Latitude, Longitude).
   * A distância em metros deslocada do GPS original.
5. Clique em **"✓ Confirmado"** para validar ou **"↺ Reverter"** caso queira desfazer.

### Passo 3: Exportar e Consolidar os Dados Calibrados
Na barra superior do modo edição:
* Clique em **"💾 Salvar/Exportar (...)":**
  * **Baixar GeoJSON Ajustado:** Arquivo vetorial compatível com QGIS e bancos de dados espaciais.
  * **Baixar CSV / Planilha:** Planilha contendo as coordenadas originais e as coordenadas calibradas prontas para atualizar a planilha Google Sheets do PCRA.
  * **Baixar Dados Globais (JS):** Gera o arquivo `adjusted_coords_data.js` que fixa essas alterações permanentemente para todos os usuários que abrirem a plataforma.
  * **Copiar Coordenadas:** Copia a lista em formato de texto para a área de transferência.
* Clique em **"Sair do Modo de Edição"** ao concluir.

---

## 4. Como Adicionar Novos Agentes/Usuários ou Alterar a Senha

Caso deseje autorizar novos e-mails ou mudar a senha de acesso, a alteração é feita diretamente no arquivo [`app.js`](file:///C:/Users/96062875/Documents/PCRA/app.js) nas linhas **46 a 50**:

```javascript
  // Admin Point Edit Mode State & Storage (Admin / Georebs)
  const editModeState = {
    isActive: false,
    authorizedUsers: [
      "admin", 
      "georebs", 
      "georebs@gmail.com", 
      "rebeca.moura@ufjf.br",
      "novo.usuario@exemplo.com" // <- Adicione novos usuários aqui
    ],
    adminPassword: "NOVA_SENHA_AQUI", // <- Modifique a senha aqui
    // ...
  };
```

Após editar:
1. Copie o arquivo para a subpasta da aplicação:
   ```bash
   python -c "import shutil; shutil.copy2('app.js', '06_APLICATIVOS_E_WEBGIS/mapa_acompanhamento_sheets/app.js')"
   ```
2. Recompile a versão standalone:
   ```bash
   python "scratch/bundle_webgis.py"
   ```

---

## 5. Boas Práticas e Recomendações

1. **Priorize a Ortofoto de Drone:** Ao fazer ajustes finos, confira a declividade e a delimitação do lote Caixa para garantir que o ponto esteja atribuído ao imóvel correto.
2. **Histórico Preservado:** A plataforma nunca apaga o GPS original do agente de campo; ela registra o ponto original e calcula o offset para fins de auditoria e transparência.
3. **Backup dos Dados:** Sempre que concluir uma rodada de calibração com os agentes, clique em **"Baixar CSV"** e arquive na pasta `03_DADOS_GEOESPACIAIS`.
