# 🌍 PCRA · WebGIS Interativo de Redução de Riscos
### 📍 Comunidade Parque Burnier (Costa Carvalho & Jardim da Lua) · Juiz de Fora – MG

[![WebGIS](https://img.shields.io/badge/WebGIS-Leaflet%201.9.4-forestgreen.svg)](index.html)
[![CRS](https://img.shields.io/badge/CRS-SIRGAS%202000%20%2F%20UTM%2023S-blue.svg)](https://epsg.io/31983)
[![Developer](https://img.shields.io/badge/GeoDeveloper-Rebeca%20Diniz%20Moura-8b5cf6.svg)](https://github.com/RebecaGis)
[![Instituição](https://img.shields.io/badge/Execução-Equipe%20PCRA%20--%20Parque%20Burnier-orange.svg)](https://www.ufjf.br/)
[![Financiamento](https://img.shields.io/badge/Financiamento-Ministério%20das%20Cidades%20%2F%20SNP-green.svg)](https://www.gov.br/cidades/pt-br)

---

## 📖 Sobre a Plataforma
https://plataforma-pcra-pqburnier.netlify.app/

A plataforma **WebGIS PCRA** é uma aplicação cartográfica e analítica moderna desenvolvida para o acompanhamento em tempo real das ações do **Plano Comunitário de Redução de Riscos (PCRA)** na comunidade Parque Burnier (bairros Costa Carvalho e Jardim da Lua), em Juiz de Fora (MG).

O projeto é executado pela **Equipe PCRA - Parque Burnier (UFJF / FADEPE)** e financiado pelo **Ministério das Cidades / Secretaria Nacional de Periferias (SNP)**, integrando dados da **Defesa Civil de Juiz de Fora**.

---

## ✨ Funcionalidades Principais

### 🎯 1. Áreas Prioritárias de Intervenção (Plano de Ação)
- 5 Setores prioritários mapeados (AP-01 a AP-05) com 19 atributos técnicos por setor:
  - Grau de risco, tipologias geológicas (deslizamento, rastejo, erosão, blocos).
  - Quantitativo de edificações e população impactada.
  - Áreas calculadas em metros quadrados ($m^2$) e hectares ($ha$).
  - Logradouros de referência (OpenStreetMap) e link direto para rota no **Google Maps**.

### 🛠️ 2. Ferramentas WebGIS Integradas
- **📐 Medição Interativa**:
  - Distância linear contínua em metros ($m$) e quilômetros ($km$).
  - Área de superfícies poligonais em $m^2$ e $ha$, com perímetro automático.
- **✏️ Desenho e Anotação de Croquis**:
  - **Texto / Rótulos**: Adição de notas técnicas arrastáveis pelo mapa.
  - **Setas Direcionais**: Traçado vetorial com setas automáticas para indicar sentido de escorregamentos, fluxos de água ou rotas de evacuação.
  - **Polígonos & Linhas**: Delimitação livre com cálculo instantâneo de área/extensão.
  - **Paleta Temática**: 7 cores cartográficas.
  - **Exportação de Croqui**: Download das geometrias criadas em formato **GeoJSON** (`croqui_anotacoes_pcra.geojson`).

### 🛰️ 3. Camadas Geoespaciais & Mapas Base
- **Drone Ortofoto HD**: Mosaico georreferenciado em alta resolução espacial com controle de transparência.
- **Declividade Reclassificada**: Recorte ADES HIS classificado em declividades críticas (`0-30%`, `30-45%`, `>45%`).
- **Setorização de Risco Geológico**: Polígonos oficiais de Risco R1 a R4 da Defesa Civil.
- **Equipamentos Comunitários**: Escolas, creches, postos de saúde e associações de moradores.
- **Múltiplos Mapas Base**: Google Híbrido, Google Satélite, Google Vias, Esri Satellite, OpenStreetMap e Carto Light.

### 📊 4. Painel de Indicadores & Gestão de Vistorias
- Painel superior com KPIs em tempo real (total de vistorias, alto risco, média de risco, vulnerabilidade social).
- Sincronização automática com planilha de campo (Google Sheets) com fallback offline.
- Busca inteligente por morador, endereço, número do ponto ou técnico responsável.
- Exportação em **GeoJSON**, **KML**, **ZIP consolidado** e **Impressão de Mapa Técnico em PDF** com selo padronizado.

---

## 📁 Estrutura de Arquivos

```text
PCRA-WebGIS/
├── index.html                   # Página principal da aplicação WebGIS
├── mapa-acompanhamento.html     # Versão standalone autocontida (single-file)
├── app.js                       # Motor JavaScript, medições, desenhos e sincronização
├── styles.css                   # Folha de estilo responsiva e moderna
├── layers_data.js               # Camadas geoespaciais vetoriais (GeoJSON embutido)
├── logos_data.js                # Brasões e logotipos institucionais (Base64)
├── initial_records.js           # Base de dados cadastrais de campo (fallback offline)
├── tiles_ortofoto/              # Pirâmide de tiles da ortofoto do drone (Leaflet TMS/XYZ)
├── tiles_declividade/           # Pirâmide de tiles do mapa de declividade
├── netlify.toml                 # Configuração para deploy contínuo no Netlify
├── _headers                     # Cabeçalhos HTTP para alta performance de cache
├── .gitignore                   # Configuração de arquivos ignorados no Git
└── README.md                    # Documentação do projeto
```

---

## 🚀 Como Executar Localmente

### Opção 1: Execução Direta
Abra o arquivo `index.html` ou `mapa-acompanhamento.html` diretamente em qualquer navegador web.

### Opção 2: Servidor Local
```bash
# Na pasta do projeto:
python -m http.server 8085

# Acesse no navegador:
# http://localhost:8085/index.html
```

---

## 👩‍💻 Autoria e Desenvolvimento

- **Rebeca Diniz Moura** · *GeoDeveloper*
- GitHub: [@RebecaGis](https://github.com/RebecaGis)
- Repositório Oficial: [https://github.com/RebecaGis/PCRA-WebGIS](https://github.com/RebecaGis/PCRA-WebGIS)
