/**
 * WebGIS & Painel de Acompanhamento PCRA - Costa Carvalho / Jardim da Lua
 * Sincronizacao em tempo real com Google Sheets
 */

(function () {
  "use strict";

  const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1vMOxa5_jpBm_A5lQj_pttVW4B2QqYhZRA8RxuBksxtU/export?format=csv&gid=0";
  const PONTOS_ENCONTRO_CSV_URL = "https://docs.google.com/spreadsheets/d/1vMOxa5_jpBm_A5lQj_pttVW4B2QqYhZRA8RxuBksxtU/export?format=csv&gid=1179726511";
  const RISK_COLORS = {
    1: "#075c2a",
    2: "#6f943d",
    3: "#d97706",
    4: "#a75e38",
    5: "#d52d20"
  };

  let allRecords = [];
  let filteredRecords = [];
  let allPontosEncontro = [];
  let selectedRecordId = null;
  let currentMetric = "agent";
  let currentRiskFilter = "all";
  let currentAgentFilter = "all";
  let currentDateFilter = "all";
  let searchQuery = "";
  let currentTab = "list";
  let isSyncing = false;
  let lastSyncTime = new Date();

  const quickFilters = {
    mobility: false,
    medication: false,
    laudo: false,
    children: false,
    elderly: false,
    animals: false,
    deslizamento: false,
    enchente: false,
    incendio: false,
    photos: false
  };

  // Admin Point Edit Mode State & Storage (Admin / Georebs)
  const editModeState = {
    isActive: false,
    authorizedUsers: ["admin", "georebs", "georebs@gmail.com", "rebeca.moura@ufjf.br"],
    adminPassword: "951951",
    adjustedCoords: (function () {
      let localObj = {};
      try {
        const stored = localStorage.getItem("pcra_adjusted_coords_v1");
        if (stored) localObj = JSON.parse(stored);
      } catch (e) {}
      const globalObj = window.PCRA_GLOBAL_ADJUSTMENTS || {};
      return Object.assign({}, globalObj, localObj);
    })()
  };

  const els = {
    syncBadge: document.getElementById("sync-status-badge"),
    syncPulse: document.getElementById("sync-pulse"),
    syncText: document.getElementById("sync-text"),
    syncBtn: document.getElementById("sync-btn"),
    themeToggle: document.getElementById("theme-toggle"),
    
    kpiTotal: document.getElementById("kpi-total-val"),
    kpiHighRisk: document.getElementById("kpi-high-risk-val"),
    kpiAvgRisk: document.getElementById("kpi-avg-risk-val"),
    kpiVulnerable: document.getElementById("kpi-vulnerable-val"),
    kpiGps: document.getElementById("kpi-gps-val"),
    
    searchInput: document.getElementById("search-input"),
    clearSearchBtn: document.getElementById("clear-search-btn"),
    metricSelect: document.getElementById("metric-select"),
    riskSelect: document.getElementById("risk-select"),
    agentSelect: document.getElementById("agent-select"),
    dateSelect: document.getElementById("date-select"),
    chipBtns: document.querySelectorAll(".chip-btn"),
    
    tabBtns: document.querySelectorAll(".sidebar-tab-btn"),
    tabContents: document.querySelectorAll(".sidebar-tab-content"),
    pointsList: document.getElementById("points-list"),
    pointsCountBadge: document.getElementById("points-badge"),
    detailContainer: document.getElementById("detail-container"),
    
    chartRiskBars: document.getElementById("chart-risk-bars"),
    chartDaysBars: document.getElementById("chart-days-bars"),
    chartAgentsBars: document.getElementById("chart-agents-bars"),
    chartVulnerabilities: document.getElementById("chart-vulnerabilities"),
    
    basemapBtns: document.querySelectorAll(".basemap-opt-btn"),
    layerCheckboxes: document.querySelectorAll(".layer-toggle-checkbox"),
    
    photoModal: document.getElementById("photo-modal"),
    modalPhotoImg: document.getElementById("modal-photo-img"),
    modalPhotoCaption: document.getElementById("modal-photo-caption"),
    modalDriveLink: document.getElementById("modal-drive-link"),
    modalTabLink: document.getElementById("modal-tab-link"),
    modalCloseBtn: document.getElementById("modal-close-btn"),
    modalViewport: document.getElementById("modal-viewport"),
    modalLoader: document.getElementById("modal-loader"),
    zoomInBtn: document.getElementById("zoom-in-btn"),
    zoomOutBtn: document.getElementById("zoom-out-btn"),
    zoomResetBtn: document.getElementById("zoom-reset-btn"),
    rotateBtn: document.getElementById("rotate-btn"),
    zoomLevelBadge: document.getElementById("zoom-level-badge"),
    
    exportModal: document.getElementById("export-modal"),
    exportBtn: document.getElementById("export-btn"),
    exportCloseBtn: document.getElementById("export-close-btn"),
    exportGeojsonBtn: document.getElementById("export-geojson-btn"),
    exportCsvBtn: document.getElementById("export-csv-btn"),
    exportKmlSurveyBtn: document.getElementById("export-kml-survey-btn"),
    printReportBtn: document.getElementById("print-report-btn"),
    exportTabBtns: document.querySelectorAll(".export-tab-btn"),
    exportTabContents: document.querySelectorAll(".export-tab-content"),
    downloadAllZipBtn: document.getElementById("download-all-zip-btn"),
    layerDownloadBtns: document.querySelectorAll(".btn-dl-fmt"),
    
    openPdfMapBtn: document.getElementById("open-pdf-map-btn"),
    pdfMapModal: document.getElementById("pdf-map-modal"),
    pdfMapCloseBtn: document.getElementById("pdf-map-close-btn"),
    formatPillBtns: document.querySelectorAll(".format-pill-btn"),
    orientationPillBtns: document.querySelectorAll(".orientation-pill-btn"),
    pdfTitleInput: document.getElementById("pdf-title-input"),
    pdfSubtitleInput: document.getElementById("pdf-subtitle-input"),
    pdfIncLogos: document.getElementById("pdf-inc-logos"),
    pdfIncNorth: document.getElementById("pdf-inc-north"),
    pdfIncScale: document.getElementById("pdf-inc-scale"),
    pdfIncLegend: document.getElementById("pdf-inc-legend"),
    pdfIncSeal: document.getElementById("pdf-inc-seal"),
    generatePdfSubmitBtn: document.getElementById("generate-pdf-submit-btn"),
    pdfBtnText: document.getElementById("pdf-btn-text"),
    pdfProgressBox: document.getElementById("pdf-progress-box"),
    
    togglePointsVisibleChk: document.getElementById("toggle-points-visible-chk"),
    clusteringLabelWrapper: document.getElementById("clustering-label-wrapper"),
    toggleClusteringChk: document.getElementById("toggle-clustering-chk"),

    // User Layer Import (Opção 3)
    importLayerBtn: document.getElementById("import-layer-btn"),
    importLayerModal: document.getElementById("import-layer-modal"),
    importLayerCloseBtn: document.getElementById("import-layer-close-btn"),
    importDropzone: document.getElementById("import-dropzone"),
    importFileInput: document.getElementById("import-file-input"),
    importConfigPanel: document.getElementById("import-config-panel"),
    importLayerName: document.getElementById("import-layer-name"),
    importColorDotBtns: document.querySelectorAll(".color-dot-btn"),
    importCustomColor: document.getElementById("import-custom-color"),
    importSummaryFilename: document.getElementById("import-summary-filename"),
    importSummaryCount: document.getElementById("import-summary-count"),
    importStatusMsg: document.getElementById("import-status-msg"),
    importCancelBtn: document.getElementById("import-cancel-btn"),
    importConfirmBtn: document.getElementById("import-confirm-btn"),
    userImportedSection: document.getElementById("user-imported-section"),
    userImportedLayersList: document.getElementById("user-imported-layers-list"),
    quickImportBtn: document.getElementById("quick-import-btn"),

    // Ortofoto Overlay Controls
    toggleOrtofotoOverlayChk: document.getElementById("toggle-ortofoto-overlay-chk"),
    ortofotoOpacityControl: document.getElementById("ortofoto-opacity-control"),
    ortofotoOpacitySlider: document.getElementById("ortofoto-opacity-slider"),
    ortofotoOpacityLabel: document.getElementById("ortofoto-opacity-label"),

    // Declividade Overlay Controls
    toggleDeclividadeOverlayChk: document.getElementById("toggle-declividade-overlay-chk"),
    declividadeOpacityControl: document.getElementById("declividade-opacity-control"),
    declividadeOpacitySlider: document.getElementById("declividade-opacity-slider"),
    declividadeOpacityLabel: document.getElementById("declividade-opacity-label"),

    // WebGIS Measurement Tools
    measureWidget: document.getElementById("map-measure-widget"),
    measureDistanceBtn: document.getElementById("measure-distance-btn"),
    measureAreaBtn: document.getElementById("measure-area-btn"),
    measureClearBtn: document.getElementById("measure-clear-btn"),
    measureFinishBtn: document.getElementById("measure-finish-btn"),
    measureResultBox: document.getElementById("measure-result-box"),
    measurePrimaryTitle: document.getElementById("measure-primary-title"),
    measurePrimaryVal: document.getElementById("measure-primary-val"),
    measureSecondaryItem: document.getElementById("measure-secondary-item"),
    measureSecondaryTitle: document.getElementById("measure-secondary-title"),
    measureSecondaryVal: document.getElementById("measure-secondary-val"),
    measureModeLabel: document.getElementById("measure-mode-label"),
    measureInstruction: document.getElementById("measure-instruction")
  };

  const map = L.map("map-view", { zoomControl: false, minZoom: 12, maxZoom: 25, preferCanvas: true }).setView([-21.7623, -43.3280], 17);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  const basemaps = {
    "ortofoto": L.layerGroup([
      L.tileLayer("https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
        maxZoom: 25,
        maxNativeZoom: 22,
        subdomains: ["0", "1", "2", "3"],
        attribution: "Google Maps",
        zIndex: 1
      }),
      L.tileLayer("./tiles_ortofoto/{z}/{x}/{y}.webp", {
        minZoom: 13,
        maxZoom: 25,
        maxNativeZoom: 21,
        bounds: [[-21.7710, -43.3400], [-21.7550, -43.3200]],
        attribution: "Ortofoto Parque Burnier · Voo Drone HD (PCRA)",
        zIndex: 2
      })
    ]),
    "google-hybrid": L.tileLayer("https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      maxZoom: 25,
      maxNativeZoom: 22,
      subdomains: ["0", "1", "2", "3"],
      attribution: "Google Maps & Maxar Satellite",
      zIndex: 1
    }),
    "google-satellite": L.tileLayer("https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
      maxZoom: 25,
      maxNativeZoom: 22,
      subdomains: ["0", "1", "2", "3"],
      attribution: "Google Maps Satellite",
      zIndex: 1
    }),
    "esri-satellite": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 25,
      maxNativeZoom: 19,
      attribution: "Esri / Maxar World Imagery",
      zIndex: 1
    }),
    "google-streets": L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
      maxZoom: 25,
      maxNativeZoom: 22,
      subdomains: ["0", "1", "2", "3"],
      attribution: "Google Maps",
      zIndex: 1
    }),
    "osm": L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
      maxZoom: 25,
      maxNativeZoom: 19,
      subdomains: ["a", "b", "c"],
      attribution: "&copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      zIndex: 1
    }),
    "carto-voyager": L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 25,
      maxNativeZoom: 20,
      subdomains: "abcd",
      attribution: "&copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a>, &copy; <a href='https://carto.com/attributions' target='_blank'>CARTO</a>",
      zIndex: 1
    })
  };

  let activeBasemapLayer = basemaps["google-hybrid"].addTo(map);

  // ==========================================================================
  // Módulo de Integração INMET (Avisos de Chuva e Risco Hidrológico/Geológico)
  // ==========================================================================
  const INMET_CONFIG = {
    codigoIBGE: "3136702", // Juiz de Fora - MG
    apiUrl: "https://apiprevmet3.inmet.gov.br/avisos/ativos",
    checkIntervalMs: 20 * 60 * 1000 // 20 minutos
  };

  // Camada do Leaflet para renderizar as manchas poligonais dos alertas (Desativada por padrão)
  const inmetAlertLayerGroup = L.layerGroup();

  let isPointsVisible = true;
  let isClusteringEnabled = true;

  const markersCluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 30,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,
    iconCreateFunction: function (cluster) {
      const children = cluster.getAllChildMarkers();
      const risks = children.map(function(m) { return m._riskValue || 1; });
      const maxRisk = Math.max.apply(null, risks);
      const color = RISK_COLORS[maxRisk] || "#0284c7";
      return L.divIcon({
        html: "<div style='background:" + color + "; color:#fff; border:2.5px solid #fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:12px; box-shadow:0 3px 8px rgba(0,0,0,0.4);'>" + children.length + "</div>",
        className: "custom-cluster-icon",
        iconSize: [32, 32]
      });
    }
  }).addTo(map);

  const markersSimpleGroup = L.featureGroup();

  const overlayLayers = {};
  window.PCRA_OVERLAY_LAYERS = overlayLayers;
  overlayLayers.inmet_alertas = inmetAlertLayerGroup;
  const layersData = window.PCRA_LAYERS || {};

  function initReferenceLayers() {
    const data = window.PCRA_LAYERS || layersData;
    if (!data) return;

    const isLayerChecked = function (key) {
      if (key && key.startsWith("percepcao_")) {
        const partChk = document.getElementById("toggle-mapeamento-participativo");
        return partChk ? partChk.checked : true;
      }
      const chk = document.querySelector('.layer-toggle-checkbox[data-layer="' + key + '"]');
      return chk ? chk.checked : false;
    };

    // ==========================================================
    // 👥 GRUPO MAPEAMENTO PARTICIPATIVO (OFICINA COMUNITÁRIA)
    // ==========================================================
    
    // 1. Símbolos Participativos (59 pontos em 9 categorias)
    if (data.percepcao_simbolos) {
      overlayLayers.percepcao_simbolos = L.geoJSON(data.percepcao_simbolos, {
        pointToLayer: function (feat, latlng) {
          const p = feat.properties || {};
          const cat = p.categoria || "outros";
          const iconSrc = (window.PCRA_PERCEPCAO_ICONS && window.PCRA_PERCEPCAO_ICONS[cat]) || ("./icones/" + (p.icone || "outros.png"));
          
          return L.marker(latlng, {
            icon: L.divIcon({
              html: "<div class='percepcao-marker' style='border-color:" + p.cor + ";' title='" + p.categoria_nome + ": " + p.descricao + "'>" +
                    "<img src='" + iconSrc + "' alt='" + p.categoria_nome + "' class='percepcao-marker-img' onerror=\"this.onerror=null;this.src='./icones/" + (p.icone || "outros.png") + "';\">" +
                    "</div>",
              className: "percepcao-marker-icon",
              iconSize: [32, 32],
              iconAnchor: [16, 16],
              popupAnchor: [0, -16]
            })
          });
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties || {};
          const cat = p.categoria || "outros";
          const iconSrc = (window.PCRA_PERCEPCAO_ICONS && window.PCRA_PERCEPCAO_ICONS[cat]) || ("./icones/" + (p.icone || "outros.png"));

          layer.bindTooltip("<strong>" + p.emoji + " " + p.categoria_nome + "</strong><br>" + p.descricao, {
            direction: "top",
            className: "custom-area-tooltip"
          });

          layer.bindPopup(
            "<div class='popup-custom-card'>" +
              "<div style='display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;padding-right:20px;'>" +
                "<span style='font-size:0.68rem;font-weight:700;color:" + p.cor + ";background:" + p.cor + "18;border:1px solid " + p.cor + "40;padding:2px 8px;border-radius:999px;text-transform:uppercase;'>Mapeamento Participativo</span>" +
                "<span style='font-size:0.72rem;font-weight:800;color:" + p.cor + ";background:" + p.cor + "20;padding:1px 6px;border-radius:4px;'>#" + p.id + "</span>" +
              "</div>" +
              "<div style='display:flex;align-items:center;gap:8px;margin-bottom:6px;'>" +
                "<img src='" + iconSrc + "' style='width:34px;height:34px;object-fit:contain;' onerror=\"this.onerror=null;this.src='./icones/" + (p.icone || "outros.png") + "';\">" +
                "<div class='popup-custom-header' style='color:" + p.cor + ";font-size:1.02rem;margin:0;'>" +
                  p.categoria_nome +
                "</div>" +
              "</div>" +
              "<div class='popup-custom-addr' style='font-size:0.80rem;font-weight:600;color:var(--forest-dark);margin-bottom:6px;line-height:1.35;'>" +
                "📝 \"" + p.descricao + "\"" +
              "</div>" +
              "<div style='font-size:0.75rem;color:var(--text-muted);border-top:1px solid var(--line);padding-top:6px;line-height:1.45;'>" +
                "<strong>Método:</strong> " + p.metodo + "<br>" +
                "<strong>Localização:</strong> " + p.lat.toFixed(5) + ", " + p.lng.toFixed(5) + "<br>" +
                "<strong>Fonte:</strong> " + p.fonte +
              "</div>" +
            "</div>", { maxWidth: 320 }
          );
        }
      });
      if (isLayerChecked("percepcao_simbolos")) overlayLayers.percepcao_simbolos.addTo(map);
    }

    // 2. Anotações Comunitárias (31 pontos textuais)
    if (data.percepcao_anotacoes) {
      overlayLayers.percepcao_anotacoes = L.geoJSON(data.percepcao_anotacoes, {
        pointToLayer: function (feat, latlng) {
          const p = feat.properties || {};
          return L.marker(latlng, {
            icon: L.divIcon({
              html: "<div class='percepcao-anotacao-pin' title='" + p.texto + "'>" +
                    "<span class='anotacao-badge'>💬</span>" +
                    "<span class='anotacao-text'>" + p.texto + "</span>" +
                    "</div>",
              className: "percepcao-anotacao-icon",
              iconSize: [120, 24],
              iconAnchor: [12, 12],
              popupAnchor: [0, -12]
            })
          });
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties || {};
          layer.bindTooltip("<strong>💬 Relato Comunitário:</strong><br>" + p.texto, {
            direction: "top",
            className: "custom-area-tooltip"
          });

          layer.bindPopup(
            "<div class='popup-custom-card'>" +
              "<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-right:20px;'>" +
                "<span style='font-size:0.68rem;font-weight:700;color:#166534;background:#dcfce7;border:1px solid #86efac;padding:2px 8px;border-radius:999px;text-transform:uppercase;'>Relato Comunitário</span>" +
                "<span style='font-size:0.72rem;font-weight:800;color:#166534;'>#" + p.id + "</span>" +
              "</div>" +
              "<div class='popup-custom-header' style='color:#14532d;font-size:0.98rem;margin-bottom:4px;'>" +
                "💬 " + p.texto +
              "</div>" +
              "<div style='font-size:0.75rem;color:var(--text-muted);border-top:1px solid var(--line);padding-top:6px;margin-top:6px;line-height:1.45;'>" +
                "<strong>Tipo:</strong> Anotação transcrita do mapa participativo<br>" +
                "<strong>Coordenadas:</strong> " + p.lat.toFixed(5) + ", " + p.lng.toFixed(5) + "<br>" +
                "<strong>Fonte:</strong> " + p.fonte +
              "</div>" +
            "</div>", { maxWidth: 300 }
          );
        }
      });
      if (isLayerChecked("percepcao_anotacoes")) overlayLayers.percepcao_anotacoes.addTo(map);
    }

    // 3. Caminhos e Escadões (9 linhas)
    if (data.percepcao_caminhos) {
      overlayLayers.percepcao_caminhos = L.geoJSON(data.percepcao_caminhos, {
        style: function (feat) {
          const p = feat.properties || {};
          const cat = p.categoria;
          if (cat === "cyan") {
            return { color: "#00abe7", weight: 3.5, dashArray: "6, 4", opacity: 0.95 };
          } else if (cat === "brown") {
            return { color: "#723f0e", weight: 4.0, dashArray: "3, 3", opacity: 0.95 };
          } else {
            return { color: "#1e293b", weight: 2.8, opacity: 0.9 };
          }
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties || {};
          const iconEmoji = p.categoria === "cyan" ? "🌊" : (p.categoria === "brown" ? "🪜" : "〰️");

          layer.bindTooltip("<strong>" + iconEmoji + " " + p.tipo_label + "</strong><br>Extensão: " + (p.extensao_m ? p.extensao_m.toLocaleString('pt-BR') + " m" : "—"), {
            direction: "center",
            className: "custom-area-tooltip"
          });

          layer.bindPopup(
            "<div class='popup-custom-card'>" +
              "<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-right:20px;'>" +
                "<span style='font-size:0.68rem;font-weight:700;color:" + p.cor_hex + ";background:" + p.cor_hex + "18;border:1px solid " + p.cor_hex + "40;padding:2px 8px;border-radius:999px;text-transform:uppercase;'>" + p.tipo_label + "</span>" +
                "<span style='font-size:0.72rem;font-weight:800;color:" + p.cor_hex + ";'>#" + p.id + "</span>" +
              "</div>" +
              "<div class='popup-custom-header' style='color:" + p.cor_hex + ";font-size:1.02rem;margin-bottom:4px;'>" +
                iconEmoji + " " + p.descricao +
              "</div>" +
              "<div style='font-size:0.75rem;color:var(--text-muted);border-top:1px solid var(--line);padding-top:6px;margin-top:6px;line-height:1.45;'>" +
                "<strong>Extensão Estimada:</strong> " + (p.extensao_m ? p.extensao_m.toLocaleString('pt-BR') + " metros" : "—") + "<br>" +
                "<strong>Função:</strong> " + (p.categoria === "cyan" ? "Escoamento e fluxo de água pluvial na encosta" : (p.categoria === "brown" ? "Acesso de pedestres / Escadão comunitário" : "Traçado de circulação local")) + "<br>" +
                "<strong>Fonte:</strong> " + p.fonte +
              "</div>" +
            "</div>", { maxWidth: 300 }
          );
        }
      });
      if (isLayerChecked("percepcao_caminhos")) overlayLayers.percepcao_caminhos.addTo(map);
    }

    // 4. Áreas Percebidas (8 polígonos)
    if (data.percepcao_areas) {
      overlayLayers.percepcao_areas = L.geoJSON(data.percepcao_areas, {
        style: function (feat) {
          const p = feat.properties || {};
          return {
            color: p.cor_hex || "#266a00",
            weight: 2.8,
            fillColor: p.fill_hex || "#266a00",
            fillOpacity: p.fill_opacity || 0.35
          };
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties || {};
          layer.bindTooltip("<strong>🗺️ " + p.nome + "</strong><br>Área: " + (p.area_m2 ? p.area_m2.toLocaleString('pt-BR') + " m²" : "—"), {
            direction: "center",
            className: "custom-area-tooltip"
          });

          layer.bindPopup(
            "<div class='popup-custom-card'>" +
              "<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-right:20px;'>" +
                "<span style='font-size:0.68rem;font-weight:700;color:" + p.cor_hex + ";background:" + p.cor_hex + "18;border:1px solid " + p.cor_hex + "40;padding:2px 8px;border-radius:999px;text-transform:uppercase;'>Área Percebida</span>" +
                "<span style='font-size:0.72rem;font-weight:800;color:" + p.cor_hex + ";'>#" + p.id + "</span>" +
              "</div>" +
              "<div class='popup-custom-header' style='color:" + p.cor_hex + ";font-size:1.02rem;margin-bottom:4px;'>" +
                "🗺️ " + p.nome +
              "</div>" +
              "<div class='popup-custom-addr' style='margin-bottom:6px;'>Tipologia: <strong>" + p.tipo + "</strong></div>" +
              "<div style='font-size:0.75rem;color:var(--text-muted);border-top:1px solid var(--line);padding-top:6px;margin-top:6px;line-height:1.55;'>" +
                "<strong>📐 Área Mapeada:</strong> <strong>" + (p.area_m2 ? p.area_m2.toLocaleString('pt-BR') + " m² (" + (p.area_ha ? p.area_ha.toFixed(2) : (p.area_m2/10000).toFixed(2)) + " ha)" : "—") + "</strong><br>" +
                "<strong>Perímetro:</strong> " + (p.perimetro_m ? p.perimetro_m.toLocaleString('pt-BR') + " m" : "—") + "<br>" +
                "<strong>Fonte:</strong> " + p.fonte +
              "</div>" +
            "</div>", { maxWidth: 330 }
          );
        }
      });
      if (isLayerChecked("percepcao_areas")) overlayLayers.percepcao_areas.addTo(map);
    }

    // 5. Limite Participativo (1 polígono)
    if (data.percepcao_limite) {
      overlayLayers.percepcao_limite = L.geoJSON(data.percepcao_limite, {
        style: {
          color: "#15803d",
          weight: 2.8,
          dashArray: "8, 5",
          fillColor: "#77ff5c",
          fillOpacity: 0.10
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties || {};
          layer.bindTooltip("<strong>⭕ " + p.nome + "</strong>", {
            direction: "center",
            className: "custom-area-tooltip"
          });

          layer.bindPopup(
            "<div class='popup-custom-card'>" +
              "<div class='popup-custom-header' style='color:#15803d;font-size:1.02rem;margin-bottom:4px;'>" +
                "⭕ " + p.nome +
              "</div>" +
              "<div style='font-size:0.75rem;color:var(--text-muted);border-top:1px solid var(--line);padding-top:6px;margin-top:6px;line-height:1.45;'>" +
                "<strong>Extensão Perimetral:</strong> " + (p.extensao_m ? p.extensao_m.toLocaleString('pt-BR') + " metros" : "—") + "<br>" +
                "<strong>Finalidade:</strong> Delimitação do território de percepção de riscos construído pela comunidade.<br>" +
                "<strong>Fonte:</strong> " + p.fonte +
              "</div>" +
            "</div>", { maxWidth: 320 }
          );
        }
      });
      if (isLayerChecked("percepcao_limite")) overlayLayers.percepcao_limite.addTo(map);
    }

    if (data.obras_contencao) {
      overlayLayers.obras_contencao = L.geoJSON(data.obras_contencao, {
        style: function (feat) {
          return {
            color: "#0284c7",
            weight: 2.8,
            dashArray: "5, 4",
            fillOpacity: 0.28,
            fillColor: "#38bdf8"
          };
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties || {};
          const nome = p.nome || ("Obra de Contenção " + (p.codigo || ""));
          const cod = p.codigo || "OC";
          const rua = p.rua_referencia || p.local || "Parque Burnier";

          layer.bindTooltip("<strong>🚧 " + (p.codigo ? p.codigo + " · " : "") + nome + "</strong>", {
            permanent: false,
            direction: "center",
            className: "custom-area-tooltip"
          });

          layer.bindPopup(
            "<div class='popup-custom-card'>" +
              "<div style='display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;padding-right:20px;'>" +
                "<span style='font-size:0.70rem;font-weight:700;color:#0284c7;background:rgba(2,132,199,0.12);border:1px solid rgba(2,132,199,0.30);padding:2px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:0.4px;'>🏛️ Sec. de Obras (PJF)</span>" +
                "<span style='font-size:0.75rem;font-weight:800;color:#0284c7;background:rgba(2,132,199,0.16);border:1px solid rgba(2,132,199,0.35);padding:1px 7px;border-radius:4px;'>" + cod + "</span>" +
              "</div>" +
              "<div class='popup-custom-header' style='color:#0369a1;font-size:1.02rem;font-weight:800;line-height:1.3;margin:0 0 4px 0;padding-right:16px;'>" +
                "🚧 " + nome +
              "</div>" +
              "<div class='popup-custom-addr' style='margin-bottom:6px;'>Localização: <strong>" + rua + "</strong> · Parque Burnier, Juiz de Fora / MG</div>" +
              "<div style='font-size:0.75rem;color:var(--text-muted);margin-top:6px;line-height:1.55;border-top:1px solid var(--line);padding-top:6px;'>" +
                "<strong>🏛️ Órgão Responsável:</strong> Secretaria de Obras (PJF)<br>" +
                "<strong>📐 Área do Polígono:</strong> <strong>" + (p.area_m2 ? p.area_m2.toLocaleString('pt-BR') + " m² (" + (p.area_ha ? p.area_ha.toFixed(2) : (p.area_m2/10000).toFixed(2)) + " ha)" : "—") + "</strong><br>" +
                "<strong>Perímetro:</strong> " + (p.perimetro_m ? p.perimetro_m.toLocaleString('pt-BR') + " m" : "—") + "<br>" +
                "<strong>Tipologia:</strong> " + (p.tipo_intervencao || "Contenção de Encosta / Estabilização Geotécnica") + "<br>" +
                "<strong>Status:</strong> <span style='color:#0284c7;font-weight:700;'>" + (p.status || "Secretaria de Obras (PJF)") + "</span><br>" +
                "<strong>Finalidade:</strong> Estabilização de taludes e proteção direta das habitações e vias públicas contra deslizamentos." +
              "</div>" +
            "</div>", { maxWidth: 340 }
          );
        }
      });
      if (isLayerChecked("obras_contencao")) overlayLayers.obras_contencao.addTo(map);
    }

    if (data.area_atuacao_pcra) {
      overlayLayers.area_atuacao_pcra = L.geoJSON(data.area_atuacao_pcra, {
        style: { color: "#16a34a", weight: 2.8, dashArray: "6, 4", fillOpacity: 0.08, fillColor: "#16a34a" },
        onEachFeature: function (feat, layer) {
          const p = feat.properties || {};
          layer.bindPopup(
            "<div class='popup-custom-card'>" +
              "<div class='popup-custom-header' style='color:#16a34a;'>📍 " + (p.nome || "ÁREA DE ATUAÇÃO PCRA") + "</div>" +
              "<div class='popup-custom-addr'>Parque Burnier · Costa Carvalho & Jardim da Lua</div>" +
              "<div style='font-size:0.75rem;color:var(--text-muted);margin-top:5px;line-height:1.45;'>" +
                "<strong>Área de Abrangência:</strong> " + (p.area_m2 ? p.area_m2.toLocaleString('pt-BR') + " m² (" + (p.area_ha ? p.area_ha.toFixed(2) : (p.area_m2/10000).toFixed(2)) + " ha)" : "174.912 m² (17,49 ha)") + "<br>" +
                "<strong>Perímetro:</strong> " + (p.perimetro_m ? p.perimetro_m.toLocaleString('pt-BR') + " m" : "1.895,8 m") + "<br>" +
                "<strong>Programa:</strong> " + (p.programa || "Plano Comunitário de Redução de Riscos") + "<br>" +
                "<strong>Finalidade:</strong> Perímetro Oficial de Mapeamento e Diagnóstico Comunitário" +
              "</div>" +
            "</div>", { maxWidth: 300 }
          );
        }
      });
      if (isLayerChecked("area_atuacao_pcra")) overlayLayers.area_atuacao_pcra.addTo(map);
    }

    if (data.areas_prioritarias) {
      const areaColorMap = {
        1: { border: "#ec4899", fill: "#f472b6", opacity: 0.24 }, // AP-01: Rosa / Magenta
        2: { border: "#dc2626", fill: "#ef4444", opacity: 0.24 }, // AP-02: Vermelho Carmesim
        3: { border: "#eab308", fill: "#facc15", opacity: 0.32 }, // AP-03: Amarelo Vibrante
        4: { border: "#ea580c", fill: "#fb923c", opacity: 0.26 }, // AP-04: Laranja
        5: { border: "#8b5cf6", fill: "#a78bfa", opacity: 0.26 }, // AP-05: Roxo / Violeta
        6: { border: "#059669", fill: "#10b981", opacity: 0.26 }, // AP-06: Esmeralda
        7: { border: "#0891b2", fill: "#06b6d4", opacity: 0.26 }, // AP-07: Turquesa
        8: { border: "#d946ef", fill: "#e879f9", opacity: 0.26 }  // AP-08: Fúcsia
      };

      overlayLayers.areas_prioritarias = L.geoJSON(data.areas_prioritarias, {
        style: function (feat) {
          const num = feat.properties && feat.properties.numero ? feat.properties.numero : 1;
          const cfg = areaColorMap[num] || { border: "#f43f5e", fill: "#f43f5e", opacity: 0.22 };
          return { color: cfg.border, weight: 2.8, dashArray: "5, 5", fillOpacity: cfg.opacity, fillColor: cfg.fill };
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties || {};
          const num = p.numero || 1;
          const cfg = areaColorMap[num] || { border: "#e11d48" };
          const nomeArea = p.nome || ("Área Prioritária " + (p.numero || ""));
          const codArea = p.codigo || ("AP-" + (p.numero ? String(p.numero).padStart(2, "0") : ""));
          const sigla = p.sigla_risco || (codArea + " · " + (p.grau_risco || ""));
          const rotulo = p.rotulo_mapa || (codArea + " (" + sigla + ") · " + (p.rua_referencia || ""));
          
          layer.bindTooltip("<strong>🎯 " + rotulo + "</strong>", {
            permanent: false,
            direction: "center",
            className: "custom-area-tooltip"
          });

          const grauBadgeColor = (p.grau_risco === "R4") ? "#dc2626" : "#d97706";
          const grauBadgeBg = (p.grau_risco === "R4") ? "rgba(220,38,38,0.12)" : "rgba(217,119,6,0.12)";

          const gmapsLink = p.google_maps_url ?
            ("<a href='" + p.google_maps_url + "' target='_blank' rel='noopener noreferrer' style='color:var(--forest-dark);font-weight:700;text-decoration:underline;' title='Abrir localização no Google Maps'>🗺️ " + (p.coordenadas_graus || (p.lat_centro + ", " + p.lon_centro)) + " ↗</a>") :
            (p.coordenadas_graus || "—");

          layer.bindPopup(
            "<div class='popup-custom-card'>" +
              "<div class='popup-custom-header' style='color:" + cfg.border + ";display:flex;align-items:center;justify-content:space-between;'>" +
                "<span>🎯 " + (p.cod_setor || ("Setor " + num)).toUpperCase() + " (" + codArea + ")</span>" +
                "<span style='font-size:0.75rem;padding:2px 8px;border-radius:999px;font-weight:700;color:" + grauBadgeColor + ";background:" + grauBadgeBg + ";border:1px solid " + grauBadgeColor + "40;'>" + (p.grau_risco || "R3") + " - " + (p.grau_risco_extenso || "Risco Alto") + "</span>" +
              "</div>" +
              "<div class='popup-custom-addr'>Sigla Oficial: <strong>" + (p.sigla_risco || (codArea + "-" + (p.grau_risco || ""))) + "</strong> · " + (p.bairro || "Parque Burnier") + ", " + (p.municipio || "Juiz de Fora") + " - " + (p.uf || "MG") + "</div>" +
              "<div style='font-size:0.75rem;color:var(--text-muted);margin-top:6px;line-height:1.55;'>" +
                "<strong>📍 Local / Vias:</strong> <span style='color:var(--forest-dark);font-weight:700;'>" + (p.local || p.rua_referencia || "Parque Burnier") + "</span><br>" +
                (p.processos_geologicos ? "<strong>⚠️ Processos Geológicos:</strong> " + p.processos_geologicos + "<br>" : "") +
                "<strong>🏠 Edificações em Risco:</strong> <strong>" + (p.edificacoes_risco != null ? p.edificacoes_risco : "—") + "</strong> imóveis<br>" +
                "<strong>👥 População Exposta:</strong> <strong>" + (p.populacao_exposta != null ? p.populacao_exposta : "—") + "</strong> pessoas<br>" +
                "<strong>📐 Área de Intervenção:</strong> " + (p.area_m2 ? p.area_m2.toLocaleString('pt-BR') + " m² (" + (p.area_ha ? p.area_ha.toFixed(2) : (p.area_m2/10000).toFixed(2)) + " ha)" : "—") + "<br>" +
                "<strong>Perímetro:</strong> " + (p.perimetro_m ? p.perimetro_m.toLocaleString('pt-BR') + " m" : "—") + "<br>" +
                "<strong>🌐 Coordenadas (Google Maps):</strong> " + gmapsLink + "<br>" +
                (p.data_setorizacao ? "<strong>📅 Data da Setorização:</strong> " + p.data_setorizacao + "<br>" : "") +
                (p.instituicao_executora ? "<strong>🏛️ Execução:</strong> " + p.instituicao_executora + "<br>" : "") +
                (p.instituicao_financiadora ? "<strong>💼 Financiamento:</strong> " + p.instituicao_financiadora + "<br>" : "") +
                "<strong>Finalidade:</strong> Área Prioritária de Mitigação de Risco e Obras (Plano de Ação)" +
              "</div>" +
            "</div>", { maxWidth: 350 }
          );
        }
      });
      if (isLayerChecked("areas_prioritarias")) overlayLayers.areas_prioritarias.addTo(map);
    }

    if (data.ades_his) {
      overlayLayers.ades_his = L.geoJSON(data.ades_his, {
        style: { color: "#7c3aed", weight: 2.2, dashArray: "4, 4", fillOpacity: 0.08, fillColor: "#7c3aed" }
      });
      if (isLayerChecked("ades_his")) overlayLayers.ades_his.addTo(map);
    }
    if (layersData.risco_geologico) {
      overlayLayers.risco_geologico = L.geoJSON(layersData.risco_geologico, {
        style: function (feat) {
          const r = String(feat.properties.Risco || "").toUpperCase();
          let c = "#10b981";
          if (r.includes("R2")) c = "#0284c7";
          if (r.includes("R3")) c = "#eab308";
          if (r.includes("R4") || r.includes("R5")) c = "#ef4444";
          return { color: c, weight: 1.5, fillOpacity: 0.28, fillColor: c };
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties;
          const r = p.Risco || "Risco";
          const desc = p.Processo || p.Nome_setor || "Setor de Risco Geológico";
          layer.bindPopup(
            "<div class='popup-custom-card'>" +
              "<div class='popup-custom-header'>" + desc + "</div>" +
              "<div class='popup-custom-addr'>Classificação: <strong>" + r + "</strong> · " + (p.Bairro || "Juiz de Fora") + "</div>" +
              "<div style='font-size:0.75rem; color:var(--text-muted);margin-top:4px;'>" +
                "População estimada: " + (p.Populacao || "—") + "<br>" +
                "Edificações: " + (p.Edificacoe || p.No_edifica || "—") + "<br>" +
                "Tipologia: " + (p.Tipologia || "Geológico") +
              "</div>" +
            "</div>"
          );
        }
      });
      if (isLayerChecked("risco_geologico")) overlayLayers.risco_geologico.addTo(map);
    }
    if (data.situacao_edificacoes || data.compra_assistida) {
      const situacaoData = data.situacao_edificacoes || data.compra_assistida;
      overlayLayers.situacao_edificacoes = L.geoJSON(situacaoData, {
        pointToLayer: function (feat, latlng) {
          const p = feat.properties || {};
          const sit = String(p.situacao || p.cond_edif || "").trim();
          
          let pinColor = "#ea580c"; // Interditada (padrão)
          let sitIcon = "🚫";
          let tagLabel = "Interditada";

          if (sit.includes("Destruída")) {
            pinColor = "#b91c1c"; // Destruída (vermelho escuro)
            sitIcon = "💥";
            tagLabel = "Destruída";
          } else if (sit.includes("Atingida")) {
            pinColor = "#9333ea"; // Atingida (roxo/magenta)
            sitIcon = "🚨";
            tagLabel = "Atingida";
          } else if (sit.includes("Adjacente")) {
            pinColor = "#d97706"; // Adjacente (âmbar)
            sitIcon = "⚠️";
            tagLabel = "Adjacente";
          } else if (sit.includes("habitacional") || sit.includes("Não habitacional")) {
            pinColor = "#0891b2"; // Não habitacional (ciano/petróleo)
            sitIcon = "🏢";
            tagLabel = "Não Habitacional";
          } else if (sit.includes("Desconsiderada")) {
            pinColor = "#6b7280"; // Desconsiderada (cinza)
            sitIcon = "⚪";
            tagLabel = "Desconsiderada";
          }

          let addrStr = p.endereco || p.logradouro || "Endereço não informado";
          if (p.num_porta && p.num_porta !== "S/N" && !addrStr.includes(p.num_porta)) {
            addrStr += ", " + p.num_porta;
          }

          return L.marker(latlng, {
            icon: L.divIcon({
              html: "<div style='background:" + pinColor + ";color:#fff;border:2px solid #fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;box-shadow:0 2px 5px rgba(0,0,0,0.35);' title='Situação: " + tagLabel + " (" + (p.codigo_dc || p.id || "") + ")'>" + sitIcon + "</div>",
              className: "situacao-edificacao-icon",
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            })
          }).bindPopup(
            "<div class='popup-custom-card'>" +
              "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;'>" +
                "<span style='font-size:0.7rem;font-weight:700;color:var(--forest-dark);'>SITUAÇÃO DA EDIFICAÇÃO</span>" +
                "<span style='background:" + pinColor + ";color:#fff;font-size:0.68rem;font-weight:700;padding:2px 6px;border-radius:99px;'>" + tagLabel + "</span>" +
              "</div>" +
              "<div class='popup-custom-header'>" + addrStr + "</div>" +
              "<div class='popup-custom-addr'>" + (p.bairro || "Parque Burnier") + (p.complemento && p.complemento !== "S/C" && p.complemento !== "-" ? " · " + p.complemento : "") + "</div>" +
              "<div style='font-size:0.75rem;color:var(--text-muted);margin-top:5px;line-height:1.45;'>" +
                "<strong>Código DC:</strong> <span style='color:var(--forest-dark);font-weight:700;'>" + (p.codigo_dc || p.id || "—") + "</span><br>" +
                "<strong>Situação:</strong> <span style='color:" + pinColor + ";font-weight:700;'>" + (p.situacao || tagLabel) + "</span><br>" +
                "<strong>Unidades Habitacionais:</strong> " + (p.unid_hab || 1) + "<br>" +
                "<strong>Plano:</strong> " + (p.plano || "Parque Burnier") +
              "</div>" +
            "</div>", { maxWidth: 280 }
          );
        }
      });
      overlayLayers.compra_assistida = overlayLayers.situacao_edificacoes;
      if (isLayerChecked("situacao_edificacoes") || isLayerChecked("compra_assistida")) {
        overlayLayers.situacao_edificacoes.addTo(map);
      }
    }
    if (layersData.ocorrencias_defesa_civil) {
      overlayLayers.ocorrencias_defesa_civil = L.geoJSON(layersData.ocorrencias_defesa_civil, {
        pointToLayer: function (feat, latlng) {
          const p = feat.properties;
          return L.marker(latlng, {
            icon: L.divIcon({
              html: "<div style='background:#d97706;color:#fff;border:1.5px solid #fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;box-shadow:0 2px 4px rgba(0,0,0,0.3);' title='BO Defesa Civil: " + (p.bo_no || "") + "'>⚠️</div>",
              className: "ocorrencia-dc-icon",
              iconSize: [18, 18],
              iconAnchor: [9, 9]
            })
          }).bindPopup(
            "<div class='popup-custom-card'>" +
              "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;'>" +
                "<span style='font-size:0.7rem;font-weight:700;color:#d97706;'>DEFESA CIVIL</span>" +
                "<span style='background:#d97706;color:#fff;font-size:0.68rem;font-weight:700;padding:2px 6px;border-radius:99px;'>BO: " + (p.bo_no || "—") + "</span>" +
              "</div>" +
              "<div class='popup-custom-header'>" + (p.tipo_ocorrencia || "Ocorrência") + "</div>" +
              "<div class='popup-custom-addr'>" + (p.local || "—") + (p.bairro ? " · " + p.bairro : "") + "</div>" +
              "<div style='font-size:0.75rem;color:var(--text-muted);margin-top:5px;line-height:1.45;'>" +
                "<strong>Data:</strong> " + (p.data || "—") + "<br>" +
                "<strong>Tipologia:</strong> " + (p.tipologia || "Geológico") + "<br>" +
                (p.regiao ? "<strong>Região:</strong> " + p.regiao : "") +
              "</div>" +
            "</div>", { maxWidth: 280 }
          );
        }
      });
      if (isLayerChecked("ocorrencias_defesa_civil")) overlayLayers.ocorrencias_defesa_civil.addTo(map);
    }
    if (layersData.equip_escolas) {
      overlayLayers.equip_escolas = L.geoJSON(layersData.equip_escolas, {
        pointToLayer: function (feat, latlng) {
          return L.marker(latlng, {
            icon: L.divIcon({
              html: "<div style='background:#0284c7;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 5px rgba(0,0,0,0.3);'>🏫</div>",
              className: "equip-icon", iconSize: [24, 24]
            })
          }).bindPopup("<strong>🏫 " + (feat.properties.Nome || feat.properties.name || "Escola / Creche") + "</strong>");
        }
      });
      if (isLayerChecked("equip_escolas")) overlayLayers.equip_escolas.addTo(map);
    }
    if (layersData.equip_saude) {
      overlayLayers.equip_saude = L.geoJSON(layersData.equip_saude, {
        pointToLayer: function (feat, latlng) {
          return L.marker(latlng, {
            icon: L.divIcon({
              html: "<div style='background:#dc2626;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 5px rgba(0,0,0,0.3);'>🏥</div>",
              className: "equip-icon", iconSize: [24, 24]
            })
          }).bindPopup("<strong>🏥 " + (feat.properties.Nome || feat.properties.name || "Unidade de Saúde") + "</strong>");
        }
      });
      if (isLayerChecked("equip_saude")) overlayLayers.equip_saude.addTo(map);
    }
    if (layersData.area_inaproveitavel) {
      overlayLayers.area_inaproveitavel = L.geoJSON(layersData.area_inaproveitavel, {
        style: {
          color: "#991b1b",
          weight: 2,
          dashArray: "5, 5",
          fillColor: "#dc2626",
          fillOpacity: 0.35
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties || {};
          layer.bindPopup(
            "<div class='popup-custom-card'>" +
              "<div class='popup-custom-header' style='color:#991b1b;'>⛔ " + (p.nome || "ÁREA INAPROVEITÁVEL") + "</div>" +
              "<div class='popup-custom-addr'>Restrição Geotécnica / Ocupação Restrita</div>" +
              "<div style='font-size:0.75rem;color:var(--text-muted);margin-top:5px;line-height:1.45;'>" +
                "<strong>Área Total:</strong> " + (p.area_m2 ? p.area_m2.toLocaleString('pt-BR') + " m²" : "—") + "<br>" +
                "<strong>Perímetro:</strong> " + (p.perimetro_m ? p.perimetro_m.toLocaleString('pt-BR') + " m" : "—") + "<br>" +
                "<strong>Status:</strong> <span style='color:#991b1b;font-weight:700;'>" + (p.status || "Inaproveitável") + "</span>" +
              "</div>" +
            "</div>", { maxWidth: 280 }
          );
        }
      });
      if (isLayerChecked("area_inaproveitavel")) overlayLayers.area_inaproveitavel.addTo(map);
    }
    if (layersData.lotes_caixa) {
      overlayLayers.lotes_caixa = L.geoJSON(layersData.lotes_caixa, {
        style: {
          color: "#0284c7",
          weight: 2,
          fillColor: "#38bdf8",
          fillOpacity: 0.3
        },
        onEachFeature: function (feat, layer) {
          const p = feat.properties || {};
          layer.bindPopup(
            "<div class='popup-custom-card'>" +
              "<div class='popup-custom-header' style='color:#0284c7;'>📦 LOTE CAIXA #" + (p.lote_numero || p.id || "") + "</div>" +
              "<div class='popup-custom-addr'>Patrimônio CEF · Terreno Cadastrado</div>" +
              "<div style='font-size:0.75rem;color:var(--text-muted);margin-top:5px;line-height:1.45;'>" +
                "<strong>Área do Lote:</strong> " + (p.area_m2 ? p.area_m2.toLocaleString('pt-BR') + " m²" : "—") + "<br>" +
                "<strong>Perímetro:</strong> " + (p.perimetro_m ? p.perimetro_m.toLocaleString('pt-BR') + " m" : "—") + "<br>" +
                "<strong>Titularidade:</strong> Caixa Econômica Federal" +
              "</div>" +
            "</div>", { maxWidth: 280 }
          );
        }
      });
      if (isLayerChecked("lotes_caixa")) overlayLayers.lotes_caixa.addTo(map);
    }
    if (layersData.equip_instituicoes_religiosas) {
      overlayLayers.equip_instituicoes_religiosas = L.geoJSON(layersData.equip_instituicoes_religiosas, {
        pointToLayer: function (feat, latlng) {
          return L.marker(latlng, {
            icon: L.divIcon({
              html: "<div style='background:#7c3aed;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 5px rgba(0,0,0,0.3);'>⛪</div>",
              className: "equip-icon", iconSize: [24, 24]
            })
          }).bindPopup("<strong>⛪ " + (feat.properties.Nome || feat.properties.name || "Instituição Religiosa / Comunitária") + "</strong>");
        }
      });
      if (isLayerChecked("equip_instituicoes_religiosas")) overlayLayers.equip_instituicoes_religiosas.addTo(map);
    }

    // Camada Ortofoto Sobreposta (Drone HD - Alta Resolução com Opacidade Ajustável)
    overlayLayers.ortofoto_overlay = L.tileLayer("./tiles_ortofoto/{z}/{x}/{y}.webp", {
      minZoom: 13,
      maxZoom: 25,
      maxNativeZoom: 21,
      opacity: 0.85,
      bounds: [[-21.7710, -43.3400], [-21.7550, -43.3200]],
      attribution: "Ortofoto Parque Burnier · Voo Drone HD (PCRA)",
      zIndex: 5
    });
    if (isLayerChecked("ortofoto_overlay")) overlayLayers.ortofoto_overlay.addTo(map);

    // Camada Declividade Sobreposta (Recorte ADES HIS com Opacidade Ajustável)
    overlayLayers.declividade_overlay = L.tileLayer("./tiles_declividade/{z}/{x}/{y}.webp", {
      minZoom: 13,
      maxZoom: 25,
      maxNativeZoom: 20,
      opacity: 0.80,
      bounds: [[-21.7670, -43.3380], [-21.7570, -43.3230]],
      attribution: "Declividade (Classes % - 0.50m) · ADES HIS Parque Burnier",
      zIndex: 6
    });
    if (isLayerChecked("declividade_overlay")) overlayLayers.declividade_overlay.addTo(map);

    // Camada Pontos de Encontro (Rotas de Fuga - Sincronizada com Google Sheets)
    overlayLayers.pontos_encontro = L.featureGroup();
    fallbackToInitialPontosEncontro();
    const chkPE = document.querySelector('.layer-toggle-checkbox[data-layer="pontos_encontro"]');
    if (!chkPE || chkPE.checked) overlayLayers.pontos_encontro.addTo(map);
  }

  function getPontoEncontroIconUrl() {
    return (window.PONTO_ENCONTRO_ICON) ||
           (window.PCRA_PERCEPCAO_ICONS && window.PCRA_PERCEPCAO_ICONS["ponto_encontro"]) ||
           "./icones/ponto_encontro.png";
  }

  function normalizePontoEncontro(row, idx) {
    const fid = row.FID || (idx + 1);
    const setor = (row.setor || ("PE-" + String(idx + 1).padStart(2, "0"))).trim();
    const rawLat = String(row.lat || "").replace(",", ".").trim();
    const rawLng = String(row.long || row.lng || "").replace(",", ".").trim();
    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);

    const photos = [];
    const rawPhotos = row.Fotografias || "";
    const photoMatches = String(rawPhotos).match(/[-\w]{25,}/g);
    if (photoMatches) {
      const seen = new Set();
      photoMatches.forEach(function (id) {
        if (!seen.has(id)) {
          seen.add(id);
          photos.push({
            id: id,
            thumbUrl: "https://lh3.googleusercontent.com/d/" + id + "=w600",
            fullUrl: "https://lh3.googleusercontent.com/d/" + id + "=w1600",
            viewUrl: "https://drive.google.com/file/d/" + id + "/view?usp=drivesdk"
          });
        }
      });
    }

    const qtdCasas = parseInt(row.Qtd_casas, 10) || 0;
    const qtdIdoso = parseInt(row.Qtd_Idoso, 10) || 0;
    const qtdInterd = parseInt(row.Qtd_Interd, 10) || 0;
    const qtdPessoas = parseInt(row.Qtd_pesso, 10) || (qtdCasas > 0 ? qtdCasas * 4 : 0);

    return {
      fid: fid,
      setor: setor,
      codigo: setor,
      nome: "Ponto de Encontro " + setor,
      lat: lat,
      lng: lng,
      qtdCasas: qtdCasas,
      qtdIdoso: qtdIdoso,
      qtdInterd: qtdInterd,
      qtdPessoas: qtdPessoas,
      referencia: (row.Ref || "").trim() || "Não informada",
      infra: (row.Infra || "").trim() || "Não",
      qual: (row.Qual || "").trim() || "Poste / Estrutura existente",
      photos: photos
    };
  }

  function renderPontosEncontro(records) {
    if (!overlayLayers.pontos_encontro) {
      overlayLayers.pontos_encontro = L.featureGroup();
    }
    overlayLayers.pontos_encontro.clearLayers();

    const iconUrl = getPontoEncontroIconUrl();

    const countBadge = document.getElementById("pontos-encontro-count-badge");
    if (countBadge) countBadge.textContent = records.length;

    records.forEach(function (rec) {
      if (isNaN(rec.lat) || isNaN(rec.lng)) return;

      const customIcon = L.divIcon({
        className: "ponto-encontro-marker-icon",
        html: "<div class='ponto-encontro-marker' title='" + rec.nome + " - Rota de Fuga'>" +
                "<img src='" + iconUrl + "' alt='" + rec.codigo + "' class='ponto-encontro-marker-img' onerror=\"this.onerror=null;this.src='./icones/ponto_encontro.png';\">" +
              "</div>",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([rec.lat, rec.lng], { icon: customIcon });

      marker.bindTooltip(
        "<strong>🚸 " + rec.nome + "</strong><br>" +
        "📍 " + rec.qual + (rec.referencia && rec.referencia !== "Não informada" ? "<br>👤 Ref: <strong>" + rec.referencia + "</strong>" : "") +
        "<br>🏠 <strong>" + rec.qtdCasas + "</strong> casas atendidas", {
          direction: "top",
          offset: [0, -18],
          className: "custom-area-tooltip"
        }
      );

      // Photos HTML for popup
      let photosHtml = "";
      if (rec.photos && rec.photos.length > 0) {
        photosHtml = "<div style='margin-top:8px;border-top:1px solid var(--line);padding-top:8px;'>" +
          "<div style='font-size:0.72rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;'>" +
            "<span>📸 REGISTROS FOTOGRÁFICOS (" + rec.photos.length + ")</span>" +
          "</div>" +
          "<div class='photo-gallery-grid' style='grid-template-columns: repeat(auto-fill, minmax(65px, 1fr)); gap: 6px;'>" +
            rec.photos.map(function(p, i) {
              return "<div class='photo-thumb-card' style='aspect-ratio:1;cursor:pointer;' onclick='window.openPhotoLightbox(\"" + p.id + "\", \"Fotografia " + (i + 1) + " · " + rec.nome + "\")'>" +
                "<img src='" + p.thumbUrl + "' alt='Foto " + (i + 1) + "' loading='lazy' referrerpolicy='no-referrer' onerror='this.onerror=null; this.src=\"https://drive.google.com/thumbnail?id=" + p.id + "&sz=w600\";' style='width:100%;height:100%;object-fit:cover;border-radius:4px;'>" +
                "<div class='photo-thumb-overlay'><span>#" + (i + 1) + "</span></div>" +
              "</div>";
            }).join("") +
          "</div>" +
        "</div>";
      }

      const gmapsLink = "https://www.google.com/maps?q=" + rec.lat + "," + rec.lng;

      const popupHtml =
        "<div class='popup-custom-card'>" +
          "<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding-right:15px;'>" +
            "<span class='ponto-encontro-badge'>🚸 Rota de Fuga</span>" +
            "<span style='font-size:0.8rem;font-weight:800;color:#15803d;'>" + rec.codigo + "</span>" +
          "</div>" +
          "<div class='popup-custom-header' style='color:#14532d;font-size:1.05rem;margin-bottom:2px;display:flex;align-items:center;gap:6px;'>" +
            "<img src='" + iconUrl + "' style='width:22px;height:22px;object-fit:contain;vertical-align:middle;' onerror=\"this.onerror=null;this.src='./icones/ponto_encontro.png';\">" +
            "<span>" + rec.nome + "</span>" +
          "</div>" +
          "<div class='popup-custom-addr' style='margin-bottom:8px;'>Instalação: <strong>" + rec.qual + "</strong></div>" +
          
          "<div style='display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;'>" +
            "<div style='background:rgba(22,101,52,0.06);border:1px solid rgba(22,101,52,0.18);border-radius:6px;padding:6px 8px;text-align:center;'>" +
              "<div style='font-size:0.65rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;'>Casas Atendidas</div>" +
              "<div style='font-size:1.15rem;font-weight:800;color:#15803d;'>" + rec.qtdCasas + "</div>" +
            "</div>" +
            "<div style='background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.22);border-radius:6px;padding:6px 8px;text-align:center;'>" +
              "<div style='font-size:0.65rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;'>Idosos</div>" +
              "<div style='font-size:1.15rem;font-weight:800;color:#b45309;'>" + rec.qtdIdoso + "</div>" +
            "</div>" +
            "<div style='background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.22);border-radius:6px;padding:6px 8px;text-align:center;'>" +
              "<div style='font-size:0.65rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;'>Interditadas</div>" +
              "<div style='font-size:1.15rem;font-weight:800;color:#dc2626;'>" + rec.qtdInterd + "</div>" +
            "</div>" +
            "<div style='background:rgba(2,132,199,0.08);border:1px solid rgba(2,132,199,0.22);border-radius:6px;padding:6px 8px;text-align:center;'>" +
              "<div style='font-size:0.65rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;'>Pop. Estimada</div>" +
              "<div style='font-size:1.15rem;font-weight:800;color:#0284c7;'>" + rec.qtdPessoas + " hab</div>" +
            "</div>" +
          "</div>" +

          "<div style='font-size:0.75rem;color:var(--text-muted);border-top:1px solid var(--line);padding-top:6px;line-height:1.55;'>" +
            "<strong>👤 Referência Comunitária:</strong> <span style='color:var(--forest-dark);font-weight:700;'>" + rec.referencia + "</span><br>" +
            "<strong>🛠️ Infraestrutura Fixada:</strong> " + rec.infra + " (" + rec.qual + ")<br>" +
            "<strong>🌐 Coordenadas:</strong> <a href='" + gmapsLink + "' target='_blank' rel='noopener noreferrer' style='color:#15803d;font-weight:700;text-decoration:underline;'>🗺️ " + rec.lat.toFixed(6) + ", " + rec.lng.toFixed(6) + " ↗</a>" +
          "</div>" +
          photosHtml +
        "</div>";

      marker.bindPopup(popupHtml, { maxWidth: 320 });
      overlayLayers.pontos_encontro.addLayer(marker);
    });

    const chk = document.querySelector('.layer-toggle-checkbox[data-layer="pontos_encontro"]');
    const isChecked = chk ? chk.checked : true;
    if (isChecked && !map.hasLayer(overlayLayers.pontos_encontro)) {
      overlayLayers.pontos_encontro.addTo(map);
    } else if (!isChecked && map.hasLayer(overlayLayers.pontos_encontro)) {
      map.removeLayer(overlayLayers.pontos_encontro);
    }
  }

  function fallbackToInitialPontosEncontro() {
    if (window.INITIAL_PONTOS_ENCONTRO && window.INITIAL_PONTOS_ENCONTRO.length > 0 && allPontosEncontro.length === 0) {
      allPontosEncontro = window.INITIAL_PONTOS_ENCONTRO.map(function(row, idx) { return normalizePontoEncontro(row, idx); });
      renderPontosEncontro(allPontosEncontro);
    }
  }


  function extractDrivePhotos(urlField, idsField) {
    const photos = [];
    const idSet = new Set();
    const addId = function (id) {
      if (id && id.length >= 25 && !idSet.has(id)) {
        idSet.add(id);
        photos.push({
          id: id,
          thumbUrl: "https://lh3.googleusercontent.com/d/" + id + "=w600",
          fullUrl: "https://lh3.googleusercontent.com/d/" + id + "=w1600",
          viewUrl: "https://drive.google.com/file/d/" + id + "/view?usp=drivesdk"
        });
      }
    };
    if (urlField) {
      const matches = String(urlField).match(/[-\w]{25,}/g);
      if (matches) matches.forEach(addId);
    }
    if (idsField) {
      const matches = String(idsField).match(/[-\w]{25,}/g);
      if (matches) matches.forEach(addId);
    }
    return photos;
  }

  function normalizeRecord(raw, index) {
    const parseNum = function (val) {
      if (val === null || val === undefined || val === "") return 0;
      const num = parseFloat(String(val).replace(",", "."));
      return isNaN(num) ? 0 : num;
    };
    const parseIntSafe = function (val) {
      if (val === null || val === undefined || val === "") return 0;
      const num = parseInt(val, 10);
      return isNaN(num) ? 0 : num;
    };

    const origLat = parseNum(raw["Latitude"]);
    const origLng = parseNum(raw["Longitude"]);
    const recordId = raw["ID"] || ("survey_" + (index + 1));
    const gpsAccuracy = parseNum(raw["Precisão GPS (m)"]);
    const agentRisk = parseIntSafe(raw["Nível de risco percebido pelo agente"]);
    const residentRisk = parseIntSafe(raw["Nível de risco percebido"]);
    const age = parseIntSafe(raw["Idade"]);
    const householdCount = parseIntSafe(raw["Quantidade de pessoas no domicílio"]);

    // Check if Georebs previously adjusted this point's position
    const adj = editModeState.adjustedCoords[recordId];
    const lat = (adj && typeof adj.lat === "number") ? adj.lat : origLat;
    const lng = (adj && typeof adj.lng === "number") ? adj.lng : origLng;
    const isAdjusted = !!adj;
    const distAdjusted = adj ? adj.distMeters : 0;

    return {
      ID: recordId,
      PontoNum: index + 1,
      Latitude: lat,
      Longitude: lng,
      OrigLatitude: origLat,
      OrigLongitude: origLng,
      CoordenadaAjustada: isAdjusted,
      DistanciaAjustada: distAdjusted,
      PrecisaoGPS: gpsAccuracy,
      DataInspecao: raw["Data da inspeção"] || "",
      DataHoraEnvio: raw["Data/hora do envio"] || "",
      Responsavel: raw["Responsável"] || "Não informado",
      RiscoAgente: agentRisk || 1,
      RiscoMorador: residentRisk || 1,
      RiscoDiff: Math.abs(agentRisk - residentRisk),
      Nome: raw["Nome da pessoa entrevistada"] || "Pessoa não informada",
      Idade: age || null,
      QtdPessoas: householdCount || null,
      Mobilidade: raw["Dificuldade de mobilidade no domicílio"] || "Não",
      GruposPrioritarios: raw["Grupos de atenção prioritária"] || "",
      Medicacao: raw["Há morador que utiliza medicação controlada?"] || "Não",
      QualMedicacao: raw["Qual medicação controlada?"] || "",
      Animais: raw["Há animais de estimação?"] || "Não",
      QuaisAnimais: raw["Quais animais?"] || "",
      QtdAnimais: raw["Quantidade de animais"] || "",
      Beneficios: raw["Recebeu ou recebe algum benefício?"] || "Não",
      BeneficiosRecebidos: raw["Benefícios recebidos"] || "",
      Endereco: raw["Endereço"] || "Endereço não informado",
      UnidadesLote: raw["Número de unidades residenciais no lote"] || "1",
      Terreno: raw["Característica do terreno"] || "",
      AguasChuva: raw["Destinação das águas de chuva"] || "",
      OutraAguas: raw["Outra destinação das águas"] || "",
      Cobertura: raw["Cobertura da construção"] || "",
      OutraCobertura: raw["Outra cobertura"] || "",
      Paredes: raw["Paredes"] || "",
      Ventilacao: raw["Ventilação"] || "",
      Agua: raw["Abastecimento de água"] || "",
      Esgoto: raw["Destinação do esgoto"] || "",
      LaudoDefesaCivil: raw["Possui laudo da Defesa Civil?"] || "Não",
      TipoOcupacao: raw["Tipo de ocupação do solo"] || "",
      SinaisInstabilidade: raw["Sinais de instabilidade"] || "",
      GrauInclinacao: raw["Grau de inclinação"] || "",
      ElementosHidrologicos: raw["Elementos hidrológicos"] || "",
      RiscosExpostos: raw["Riscos expostos"] || "",
      OutrosRiscos: raw["Outros riscos associados"] || "",
      Observacoes: raw["Observações"] || "",
      Photos: extractDrivePhotos(raw["URLs das fotografias"], raw["IDs das fotografias"]),
      LaudoPhotos: extractDrivePhotos(raw["URL da foto do laudo"], raw["ID da foto do laudo"]),
      ReceitaPhotos: extractDrivePhotos(raw["URL da foto da receita"], raw["ID da foto da receita"]),
      Raw: raw
    };
  }

  function getActiveRiskValue(rec) {
    if (currentMetric === "agent") return rec.RiscoAgente;
    if (currentMetric === "resident") return rec.RiscoMorador;
    if (currentMetric === "diff") return Math.min(5, Math.max(1, rec.RiscoDiff + 1));
    return rec.RiscoAgente;
  }

  function getActiveRiskLabel(rec) {
    if (currentMetric === "agent") return "Agente R" + rec.RiscoAgente;
    if (currentMetric === "resident") return "Morador R" + rec.RiscoMorador;
    if (currentMetric === "diff") return "Divergência ±" + rec.RiscoDiff;
    return "R" + rec.RiscoAgente;
  }

  function formatDatePt(isoDate) {
    if (!isoDate) return "—";
    const parts = String(isoDate).split('-');
    if (parts.length === 3) return parts[2] + "/" + parts[1] + "/" + parts[0];
    return isoDate;
  }

  function applyFilters() {
    filteredRecords = allRecords.filter(function (rec) {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fullText = (rec.PontoNum + " " + rec.Nome + " " + rec.Endereco + " " + rec.Responsavel + " " + rec.Observacoes + " " + rec.RiscosExpostos + " " + rec.ID).toLowerCase();
        if (!fullText.includes(q)) return false;
      }
      const r = getActiveRiskValue(rec);
      if (currentRiskFilter === "high" && r < 4) return false;
      if (currentRiskFilter !== "all" && currentRiskFilter !== "high" && r !== parseInt(currentRiskFilter, 10)) return false;
      if (currentAgentFilter !== "all" && rec.Responsavel !== currentAgentFilter) return false;
      if (currentDateFilter !== "all" && rec.DataInspecao !== currentDateFilter) return false;

      if (quickFilters.mobility && rec.Mobilidade !== "Sim") return false;
      if (quickFilters.medication && rec.Medicacao !== "Sim") return false;
      if (quickFilters.laudo && rec.LaudoDefesaCivil !== "Sim") return false;
      if (quickFilters.children && !rec.GruposPrioritarios.toLowerCase().includes("criança")) return false;
      if (quickFilters.elderly && !(rec.GruposPrioritarios.toLowerCase().includes("idoso") || (rec.Idade && rec.Idade >= 60))) return false;
      if (quickFilters.animals && rec.Animais !== "Sim") return false;
      if (quickFilters.deslizamento && !rec.RiscosExpostos.toLowerCase().includes("deslizamento")) return false;
      if (quickFilters.enchente && !rec.RiscosExpostos.toLowerCase().includes("enchente")) return false;
      if (quickFilters.incendio && !(rec.RiscosExpostos.toLowerCase().includes("incêndio") || rec.OutrosRiscos.toLowerCase().includes("incêndio"))) return false;
      if (quickFilters.photos && rec.Photos.length === 0) return false;

      return true;
    });

    renderMapMarkers();
    renderKPIs();
    renderPointsList();
    renderAnalyticsTab();
  }

  function renderMapMarkers() {
    markersCluster.clearLayers();
    markersSimpleGroup.clearLayers();

    if (!isPointsVisible) {
      if (map.hasLayer(markersCluster)) map.removeLayer(markersCluster);
      if (map.hasLayer(markersSimpleGroup)) map.removeLayer(markersSimpleGroup);
      return;
    }

    const targetGroup = isClusteringEnabled ? markersCluster : markersSimpleGroup;
    if (isClusteringEnabled) {
      if (map.hasLayer(markersSimpleGroup)) map.removeLayer(markersSimpleGroup);
      if (!map.hasLayer(markersCluster)) map.addLayer(markersCluster);
    } else {
      if (map.hasLayer(markersCluster)) map.removeLayer(markersCluster);
      if (!map.hasLayer(markersSimpleGroup)) map.addLayer(markersSimpleGroup);
    }

    filteredRecords.forEach(function (rec) {
      if (!rec.Latitude || !rec.Longitude || isNaN(rec.Latitude) || isNaN(rec.Longitude)) return;
      const riskVal = getActiveRiskValue(rec);
      const color = RISK_COLORS[riskVal] || "#0284c7";
      const isSelected = rec.ID === selectedRecordId;
      const isEditing = editModeState.isActive;
      const isAdjusted = !!rec.CoordenadaAjustada;

      let markerPinClass = "risk-marker-pin " + (isSelected ? "selected" : "");
      if (isEditing) markerPinClass += " draggable-active";

      const pinContent = riskVal;

      const marker = L.marker([rec.Latitude, rec.Longitude], {
        icon: L.divIcon({
          html: "<div class='" + markerPinClass + "' style='background:" + color + "; width:24px; height:24px;'>" + pinContent + "</div>",
          className: "custom-point-marker" + (isEditing ? " draggable-marker" : ""),
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        }),
        title: "Ponto " + String(rec.PontoNum).padStart(2, '0') + " · " + rec.Nome + (isEditing ? " (Arraste para ajustar posição)" : ""),
        draggable: isEditing
      });

      marker._riskValue = riskVal;
      marker._recordId = rec.ID;

      if (isEditing) {
        marker.on("dragstart", function () {
          marker.closePopup();
        });

        marker.on("dragend", function () {
          const newPos = marker.getLatLng();
          const origLat = (typeof rec.OrigLatitude === "number") ? rec.OrigLatitude : rec.Latitude;
          const origLng = (typeof rec.OrigLongitude === "number") ? rec.OrigLongitude : rec.Longitude;
          const distMoved = Math.round(L.latLng(origLat, origLng).distanceTo(newPos) * 10) / 10;

          rec.OrigLatitude = origLat;
          rec.OrigLongitude = origLng;
          rec.Latitude = newPos.lat;
          rec.Longitude = newPos.lng;
          rec.CoordenadaAjustada = true;
          rec.DistanciaAjustada = distMoved;

          editModeState.adjustedCoords[rec.ID] = {
            id: rec.ID,
            pontoNum: rec.PontoNum,
            nome: rec.Nome,
            endereco: rec.Endereco,
            responsavel: rec.Responsavel,
            lat: newPos.lat,
            lng: newPos.lng,
            origLat: origLat,
            origLng: origLng,
            distMeters: distMoved,
            timestamp: new Date().toISOString()
          };

          try {
            localStorage.setItem("pcra_adjusted_coords_v1", JSON.stringify(editModeState.adjustedCoords));
          } catch (e) {}

          updateAdjustedUI();
          renderPointsList();
          if (selectedRecordId === rec.ID) {
            renderDetailsTab(rec);
          }

          L.popup({ offset: [0, -10], className: "edit-confirm-popup", closeButton: true })
            .setLatLng(newPos)
            .setContent(
              "<div class='popup-custom-card' style='padding:4px;'>" +
                "<div style='font-size:0.80rem;font-weight:700;color:#075c2a;margin-bottom:4px;'>📍 Ponto " + String(rec.PontoNum).padStart(2, '0') + " Reposicionado</div>" +
                "<div style='font-size:0.75rem;line-height:1.4;margin-bottom:6px;'>" +
                  "<strong>Nova Coordenada:</strong> " + newPos.lat.toFixed(6) + ", " + newPos.lng.toFixed(6) + "<br>" +
                  "<strong>Deslocamento:</strong> <span style='color:#dc2626;font-weight:700;'>" + distMoved + " m</span> do GPS original" +
                "</div>" +
                "<div style='display:flex;gap:6px;'>" +
                  "<button class='btn btn-primary' style='padding:4px 10px;font-size:0.72rem;flex:1;' onclick='window.confirmPointPosition(\"" + rec.ID + "\")'>✓ Confirmado</button>" +
                  "<button class='btn btn-secondary' style='padding:4px 8px;font-size:0.72rem;' onclick='window.revertPointPosition(\"" + rec.ID + "\")'>↺ Reverter</button>" +
                "</div>" +
              "</div>"
            ).openOn(map);
        });
      }

      const thumb = rec.Photos.length > 0
        ? ("<div style='margin-top:6px;border-radius:6px;overflow:hidden;height:110px;background:#1e293b;position:relative;'><img src='" + rec.Photos[0].thumbUrl + "' style='width:100%;height:100%;object-fit:cover;' loading='lazy' referrerpolicy='no-referrer' onerror='this.onerror=null; this.src=\"https://drive.google.com/thumbnail?id=" + rec.Photos[0].id + "&sz=w600\";'><div style='position:absolute;bottom:4px;right:6px;background:rgba(0,0,0,0.65);color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600;'>📸 " + rec.Photos.length + " foto(s)</div></div>")
        : "";

      marker.bindPopup(
        "<div class='popup-custom-card'>" +
          "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;padding-right:20px;'>" +
            "<span style='font-size:0.7rem;font-weight:700;color:var(--primary);'>PONTO " + String(rec.PontoNum).padStart(2, '0') + "</span>" +
            "<span style='background:" + color + ";color:#fff;font-size:0.68rem;font-weight:700;padding:2px 6px;border-radius:99px;'>" + getActiveRiskLabel(rec) + "</span>" +
          "</div>" +
          "<div class='popup-custom-header'>" + rec.Nome + "</div>" +
          "<div class='popup-custom-addr'>" + rec.Endereco + "</div>" +
          (isAdjusted ? ("<div style='margin:4px 0;'><span class='point-adjusted-tag'>📌 Coordenada Ajustada (+ " + rec.DistanciaAjustada + "m)</span></div>") : "") +
          "<div style='font-size:0.75rem;color:var(--text-muted);'>" +
            "Vistoriado por: <strong>" + rec.Responsavel + "</strong><br>" +
            "Data: " + formatDatePt(rec.DataInspecao) +
          "</div>" +
          thumb +
          "<div class='popup-custom-footer'>" +
            "<button class='btn btn-primary' style='width:100%;padding:4px 8px;font-size:0.75rem;' onclick='window.selectAndOpenPoint(\"" + rec.ID + "\")'>Ver Ficha Completa</button>" +
          "</div>" +
        "</div>", { maxWidth: 280 }
      );

      marker.on("click", function () {
        if (measureState && measureState.mode) {
          marker.closePopup();
          return;
        }
        selectPoint(rec.ID, false);
      });
      marker.on("popupopen", function () {
        if (measureState && measureState.mode) {
          marker.closePopup();
        }
      });
      targetGroup.addLayer(marker);
    });
  }

  function renderKPIs() {
    const total = filteredRecords.length;
    els.kpiTotal.textContent = total;
    const highRiskCount = filteredRecords.filter(function(r) { return r.RiscoAgente >= 4; }).length;
    const highRiskPct = total > 0 ? Math.round((highRiskCount / total) * 100) : 0;
    els.kpiHighRisk.textContent = highRiskCount + " (" + highRiskPct + "%)";

    const sumAgentRisk = filteredRecords.reduce(function(acc, r) { return acc + r.RiscoAgente; }, 0);
    els.kpiAvgRisk.textContent = total > 0 ? (sumAgentRisk / total).toFixed(1) : "—";

    const vulnerableCount = filteredRecords.filter(function(r) {
      return r.Mobilidade === "Sim" || r.Medicacao === "Sim" || r.LaudoDefesaCivil === "Sim";
    }).length;
    els.kpiVulnerable.textContent = vulnerableCount;

    const validGps = filteredRecords.map(function(r) { return r.PrecisaoGPS; }).filter(function(v) { return v > 0; });
    const avgGps = validGps.length > 0 ? (validGps.reduce(function(a, b) { return a + b; }, 0) / validGps.length).toFixed(1) : "—";
    els.kpiGps.textContent = avgGps + " m";
    els.pointsCountBadge.textContent = total;
  }

  function renderPointsList() {
    if (filteredRecords.length === 0) {
      els.pointsList.innerHTML = "<div class='detail-empty-state'><p>Nenhum levantamento encontrado com os filtros selecionados.</p></div>";
      return;
    }
    els.pointsList.innerHTML = filteredRecords.map(function (rec) {
      const riskVal = getActiveRiskValue(rec);
      const color = RISK_COLORS[riskVal] || "#0284c7";
      const isActive = rec.ID === selectedRecordId;
      const tags = [];
      if (rec.CoordenadaAjustada) tags.push("<span class='point-mini-tag' style='background:#fef3c7;color:#92400e;border:1px solid #fcd34d;'>📌 Ajustado</span>");
      if (rec.Mobilidade === "Sim") tags.push("<span class='point-mini-tag'>♿ Mobilidade</span>");
      if (rec.Medicacao === "Sim") tags.push("<span class='point-mini-tag'>💊 Medicação</span>");
      if (rec.LaudoDefesaCivil === "Sim") tags.push("<span class='point-mini-tag'>📋 Laudo</span>");
      if (rec.Photos.length > 0) tags.push("<span class='point-mini-tag'>📸 " + rec.Photos.length + " fotos</span>");

      return (
        "<div class='point-card " + (isActive ? "active" : "") + "' data-id='" + rec.ID + "'>" +
          "<div class='point-card-header'>" +
            "<span style='font-size:0.72rem;font-weight:700;color:var(--primary);'>PONTO " + String(rec.PontoNum).padStart(2, '0') + "</span>" +
            "<span class='point-risk-badge' style='background:" + color + ";'>" + getActiveRiskLabel(rec) + "</span>" +
          "</div>" +
          "<div class='point-card-title'>" + rec.Nome + "</div>" +
          "<div class='point-card-meta'>" + rec.Endereco + "</div>" +
          "<div style='display:flex;justify-content:space-between;align-items:center;font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;'>" +
            "<span>Agente: <strong>" + rec.Responsavel + "</strong></span>" +
            "<span>" + formatDatePt(rec.DataInspecao) + "</span>" +
          "</div>" +
          "<div class='point-tags-row'>" + tags.join("") + "</div>" +
        "</div>"
      );
    }).join("");

    els.pointsList.querySelectorAll(".point-card").forEach(function (card) {
      card.addEventListener("click", function () { selectPoint(card.dataset.id, true); });
    });
  }

  function renderDetailsTab(rec) {
    if (!rec) {
      els.detailContainer.innerHTML = 
        "<div class='detail-empty-state'>" +
          "<svg width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5'><circle cx='12' cy='12' r='10'/><path d='M12 8v4'/><path d='M12 16h.01'/></svg>" +
          "<h3>Nenhum ponto selecionado</h3>" +
          "<p>Clique em um marcador no mapa ou em um item da lista para abrir o formulário cadastral completo e as fotografias.</p>" +
        "</div>";
      return;
    }

    const agentColor = RISK_COLORS[rec.RiscoAgente] || "#0284c7";
    const resColor = RISK_COLORS[rec.RiscoMorador] || "#0284c7";

    let photosHtml = rec.Photos.length > 0
      ? "<div class='photo-gallery-grid'>" + rec.Photos.map(function (p, i) {
          return (
            "<div class='photo-thumb-card' onclick='window.openPhotoLightbox(\"" + p.id + "\", \"Fotografia " + (i + 1) + " · Ponto " + rec.PontoNum + "\")'>" +
              "<img src='" + p.thumbUrl + "' alt='Foto " + (i + 1) + "' loading='lazy' referrerpolicy='no-referrer' onerror='this.onerror=null; this.src=\"https://drive.google.com/thumbnail?id=" + p.id + "&sz=w600\";'>" +
              "<div class='photo-thumb-overlay'>" +
                "<span>Foto " + (i + 1) + "</span>" +
                "<a href='" + p.viewUrl + "' target='_blank' rel='noopener noreferrer' class='direct-drive-link' onclick='event.stopPropagation()'>Drive ↗</a>" +
              "</div>" +
            "</div>"
          );
        }).join("") + "</div>"
      : "<p style='font-size:0.78rem;color:var(--text-muted);'>Nenhuma fotografia anexada.</p>";

    let attachmentsHtml = "";
    if (rec.LaudoPhotos.length > 0) {
      attachmentsHtml += "<div style='margin-top:8px;'><strong style='font-size:0.75rem;color:var(--text-muted);'>Foto do Laudo da Defesa Civil:</strong><div class='photo-gallery-grid' style='grid-template-columns:1fr;margin-top:4px;'>" + rec.LaudoPhotos.map(function (p) {
        return "<div class='photo-thumb-card' style='aspect-ratio:16/9;' onclick='window.openPhotoLightbox(\"" + p.id + "\", \"Laudo da Defesa Civil · Ponto " + rec.PontoNum + "\")'><img src='" + p.thumbUrl + "' alt='Laudo' loading='lazy' referrerpolicy='no-referrer' onerror='this.onerror=null; this.src=\"https://drive.google.com/thumbnail?id=" + p.id + "&sz=w600\";'><div class='photo-thumb-overlay'><span>Laudo Oficial</span><a href='" + p.viewUrl + "' target='_blank' rel='noopener noreferrer' class='direct-drive-link' onclick='event.stopPropagation()'>Drive ↗</a></div></div>";
      }).join("") + "</div></div>";
    }
    if (rec.ReceitaPhotos.length > 0) {
      attachmentsHtml += "<div style='margin-top:8px;'><strong style='font-size:0.75rem;color:var(--text-muted);'>Foto da Receita Médica:</strong><div class='photo-gallery-grid' style='grid-template-columns:1fr;margin-top:4px;'>" + rec.ReceitaPhotos.map(function (p) {
        return "<div class='photo-thumb-card' style='aspect-ratio:16/9;' onclick='window.openPhotoLightbox(\"" + p.id + "\", \"Receita Médica · Ponto " + rec.PontoNum + "\")'><img src='" + p.thumbUrl + "' alt='Receita' loading='lazy' referrerpolicy='no-referrer' onerror='this.onerror=null; this.src=\"https://drive.google.com/thumbnail?id=" + p.id + "&sz=w600\";'><div class='photo-thumb-overlay'><span>Receita Médica</span><a href='" + p.viewUrl + "' target='_blank' rel='noopener noreferrer' class='direct-drive-link' onclick='event.stopPropagation()'>Drive ↗</a></div></div>";
      }).join("") + "</div></div>";
    }
    if (!attachmentsHtml) attachmentsHtml = "<p style='font-size:0.78rem;color:var(--text-muted);'>Nenhum documento anexado.</p>";

    let adjustedCoordHtml = "";
    if (rec.CoordenadaAjustada) {
      adjustedCoordHtml = 
        "<div class='detail-item' style='grid-column: 1 / -1; background: rgba(245, 158, 11, 0.08); padding: 8px 10px; border-radius: 6px; border: 1px dashed #f59e0b;'>" +
          "<dt style='color:#b45309; font-weight:700;'>Calibração Espacial</dt>" +
          "<dd style='display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;'>" +
            "<span class='point-adjusted-tag'>📌 Posição Ajustada por Georebs (+ " + rec.DistanciaAjustada + "m do GPS original)</span>" +
            "<button class='btn btn-secondary' style='padding:2px 8px; font-size:0.70rem;' onclick='window.revertPointPosition(\"" + rec.ID + "\")'>↺ Restaurar Coordenada Original</button>" +
          "</dd>" +
        "</div>";
    }

    els.detailContainer.innerHTML = 
      "<div class='detail-header-card'>" +
        "<div class='detail-ponto-number'>Levantamento de Risco · Ponto " + String(rec.PontoNum).padStart(2, '0') + "</div>" +
        "<div class='detail-main-name'>" + rec.Nome + "</div>" +
        "<div class='detail-main-address'>" +
          "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/><circle cx='12' cy='10' r='3'/></svg> " +
          rec.Endereco +
        "</div>" +
        "<div class='risk-comparison-box'>" +
          "<div class='risk-comparison-card'>" +
            "<div class='role'>Avaliação do Agente</div>" +
            "<div class='score' style='color:" + agentColor + ";'>Risco " + rec.RiscoAgente + "</div>" +
          "</div>" +
          "<div class='risk-comparison-card'>" +
            "<div class='role'>Percepção do Morador</div>" +
            "<div class='score' style='color:" + resColor + ";'>Risco " + rec.RiscoMorador + "</div>" +
          "</div>" +
        "</div>" +
      "</div>" +

      "<div class='detail-section'>" +
        "<div class='detail-section-title'>" +
          "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><rect x='3' y='4' width='18' height='18' rx='2' ry='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/></svg>" +
          "Identificação da Inspeção" +
        "</div>" +
        "<dl class='detail-grid-dl'>" +
          adjustedCoordHtml +
          "<div class='detail-item'><dt>Responsável Técnico</dt><dd>" + rec.Responsavel + "</dd></div>" +
          "<div class='detail-item'><dt>Data da Inspeção</dt><dd>" + formatDatePt(rec.DataInspecao) + (rec.DataHoraEnvio ? (" · " + rec.DataHoraEnvio.split('T')[1].slice(0, 5)) : "") + "</dd></div>" +
          "<div class='detail-item'><dt>Precisão do GPS</dt><dd>" + (rec.PrecisaoGPS ? (rec.PrecisaoGPS + " metros") : "Não registrada") + "</dd></div>" +
          "<div class='detail-item'><dt>Coordenadas (Lat, Long)</dt><dd>" + rec.Latitude.toFixed(6) + ", " + rec.Longitude.toFixed(6) + " (<a href='https://maps.google.com/?q=" + rec.Latitude + "," + rec.Longitude + "' target='_blank' style='color:var(--primary);'>Google Maps ↗</a>)</dd></div>" +
          "<div class='detail-item'><dt>ID do Registro</dt><dd style='font-family:monospace;font-size:0.7rem;'>" + rec.ID + "</dd></div>" +
        "</dl>" +
      "</div>" +

      "<div class='detail-section'>" +
        "<div class='detail-section-title'>" +
          "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'/><line x1='12' y1='9' x2='12' y2='13'/><line x1='12' y1='17' x2='12.01' y2='17'/></svg>" +
          "Diagnóstico e Fatores de Risco" +
        "</div>" +
        "<dl class='detail-grid-dl'>" +
          "<div class='detail-item'><dt>Riscos Expostos</dt><dd><strong style='color:var(--r5);'>" + (rec.RiscosExpostos || "Nenhum informado") + "</strong></dd></div>" +
          "<div class='detail-item'><dt>Outros Riscos Associados</dt><dd>" + (rec.OutrosRiscos || "Nenhum informado") + "</dd></div>" +
          "<div class='detail-item'><dt>Tipo de Ocupação</dt><dd>" + (rec.TipoOcupacao || "Não informado") + "</dd></div>" +
          "<div class='detail-item'><dt>Sinais de Instabilidade</dt><dd>" + (rec.SinaisInstabilidade || "Nenhum sinal aparente") + "</dd></div>" +
          "<div class='detail-item'><dt>Grau de Inclinação</dt><dd>" + (rec.GrauInclinacao || "Não informado") + "</dd></div>" +
          "<div class='detail-item'><dt>Elementos Hidrológicos</dt><dd>" + (rec.ElementosHidrologicos || "Não informado") + "</dd></div>" +
          "<div class='detail-item'><dt>Observações de Campo</dt><dd style='font-style:italic;'>" + (rec.Observacoes || "Sem observações adicionais") + "</dd></div>" +
        "</dl>" +
      "</div>" +

      "<div class='detail-section'>" +
        "<div class='detail-section-title'>" +
          "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>" +
          "Perfil do Morador e Família" +
        "</div>" +
        "<dl class='detail-grid-dl'>" +
          "<div class='detail-item'><dt>Pessoa Entrevistada</dt><dd>" + rec.Nome + (rec.Idade ? (" (" + rec.Idade + " anos)") : "") + "</dd></div>" +
          "<div class='detail-item'><dt>Moradores no Domicílio</dt><dd>" + (rec.QtdPessoas ? (rec.QtdPessoas + " pessoas") : "Não informado") + "</dd></div>" +
          "<div class='detail-item'><dt>Dificuldade de Mobilidade</dt><dd><span style='color:" + (rec.Mobilidade === "Sim" ? "var(--r5)" : "inherit") + ";font-weight:700;'>" + rec.Mobilidade + "</span></dd></div>" +
          "<div class='detail-item'><dt>Grupos de Atenção Prioritária</dt><dd>" + (rec.GruposPrioritarios || "Nenhum informado") + "</dd></div>" +
          "<div class='detail-item'><dt>Uso de Medicação Controlada</dt><dd>" + rec.Medicacao + (rec.QualMedicacao ? (" — <em>" + rec.QualMedicacao + "</em>") : "") + "</dd></div>" +
          "<div class='detail-item'><dt>Animais de Estimação</dt><dd>" + rec.Animais + (rec.QuaisAnimais ? (" (" + rec.QuaisAnimais + " - Qtd: " + (rec.QtdAnimais || "1") + ")") : "") + "</dd></div>" +
          "<div class='detail-item'><dt>Benefícios Sociais</dt><dd>" + rec.Beneficios + (rec.BeneficiosRecebidos ? (" — <em>" + rec.BeneficiosRecebidos + "</em>") : "") + "</dd></div>" +
        "</dl>" +
      "</div>" +

      "<div class='detail-section'>" +
        "<div class='detail-section-title'>" +
          "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/><polyline points='9 22 9 12 15 12 15 22'/></svg>" +
          "Características do Imóvel e Lote" +
        "</div>" +
        "<dl class='detail-grid-dl'>" +
          "<div class='detail-item'><dt>Unidades Residenciais no Lote</dt><dd>" + rec.UnidadesLote + "</dd></div>" +
          "<div class='detail-item'><dt>Característica do Terreno</dt><dd>" + (rec.Terreno || "Não informado") + "</dd></div>" +
          "<div class='detail-item'><dt>Destinação das Águas de Chuva</dt><dd>" + rec.AguasChuva + (rec.OutraAguas ? (" (" + rec.OutraAguas + ")") : "") + "</dd></div>" +
          "<div class='detail-item'><dt>Cobertura da Construção</dt><dd>" + rec.Cobertura + (rec.OutraCobertura ? (" (" + rec.OutraCobertura + ")") : "") + "</dd></div>" +
          "<div class='detail-item'><dt>Paredes / Estrutura</dt><dd>" + (rec.Paredes || "Não informado") + "</dd></div>" +
          "<div class='detail-item'><dt>Ventilação</dt><dd>" + (rec.Ventilacao || "Não informado") + "</dd></div>" +
          "<div class='detail-item'><dt>Abastecimento de Água</dt><dd>" + (rec.Agua || "Não informado") + "</dd></div>" +
          "<div class='detail-item'><dt>Destinação do Esgoto</dt><dd>" + (rec.Esgoto || "Não informado") + "</dd></div>" +
          "<div class='detail-item'><dt>Possui Laudo da Defesa Civil?</dt><dd><span style='color:" + (rec.LaudoDefesaCivil === "Sim" ? "var(--r5)" : "inherit") + ";font-weight:700;'>" + rec.LaudoDefesaCivil + "</span></dd></div>" +
        "</dl>" +
      "</div>" +

      "<div class='detail-section'>" +
        "<div class='detail-section-title'>" +
          "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'/><circle cx='12' cy='13' r='4'/></svg>" +
          "Fotografias de Campo (" + rec.Photos.length + ")" +
        "</div>" +
        photosHtml +
      "</div>" +

      "<div class='detail-section'>" +
        "<div class='detail-section-title'>" +
          "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'/><polyline points='14 2 14 8 20 8'/></svg>" +
          "Documentos e Laudos" +
        "</div>" +
        attachmentsHtml +
      "</div>";
  }


  function renderAnalyticsTab() {
    const total = filteredRecords.length;
    if (total === 0) return;

    const riskCounts = [1, 2, 3, 4, 5].map(function (r) {
      return {
        risk: r,
        agentCount: filteredRecords.filter(function(d) { return d.RiscoAgente === r; }).length,
        resCount: filteredRecords.filter(function(d) { return d.RiscoMorador === r; }).length
      };
    });
    const maxRiskCount = Math.max.apply(null, [1].concat(riskCounts.map(function(d) { return Math.max(d.agentCount, d.resCount); })));

    els.chartRiskBars.innerHTML = riskCounts.map(function (d) {
      return (
        "<div class='horizontal-bar-row'>" +
          "<span>Risco " + d.risk + "</span>" +
          "<div class='horizontal-bar-track'><div class='horizontal-bar-fill' style='width:" + ((d.agentCount / maxRiskCount) * 100) + "%;background:" + RISK_COLORS[d.risk] + ";'></div></div>" +
          "<strong>" + d.agentCount + "</strong>" +
        "</div>"
      );
    }).join("");

    const byDate = {};
    filteredRecords.forEach(function (r) {
      const d = r.DataInspecao || "Sem data";
      byDate[d] = (byDate[d] || 0) + 1;
    });
    const sortedDates = Object.keys(byDate).sort();
    const maxDay = Math.max.apply(null, [1].concat(Object.values(byDate)));

    els.chartDaysBars.innerHTML = sortedDates.map(function (d) {
      const count = byDate[d];
      return (
        "<div class='horizontal-bar-row'>" +
          "<span>" + formatDatePt(d).slice(0, 5) + "</span>" +
          "<div class='horizontal-bar-track'><div class='horizontal-bar-fill' style='width:" + ((count / maxDay) * 100) + "%;background:var(--primary);'></div></div>" +
          "<strong>" + count + "</strong>" +
        "</div>"
      );
    }).join("");

    const byAgent = {};
    filteredRecords.forEach(function (r) {
      const a = r.Responsavel || "Não informado";
      byAgent[a] = (byAgent[a] || 0) + 1;
    });
    const sortedAgents = Object.keys(byAgent).sort(function (a, b) { return byAgent[b] - byAgent[a]; });
    const maxAgent = Math.max.apply(null, [1].concat(Object.values(byAgent)));

    els.chartAgentsBars.innerHTML = sortedAgents.map(function (a) {
      const count = byAgent[a];
      return (
        "<div class='horizontal-bar-row'>" +
          "<span title='" + a + "' style='overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'>" + a.split(' ')[0] + "</span>" +
          "<div class='horizontal-bar-track'><div class='horizontal-bar-fill' style='width:" + ((count / maxAgent) * 100) + "%;background:#0ea5e9;'></div></div>" +
          "<strong>" + count + "</strong>" +
        "</div>"
      );
    }).join("");

    const mobCount = filteredRecords.filter(function (r) { return r.Mobilidade === "Sim"; }).length;
    const medCount = filteredRecords.filter(function (r) { return r.Medicacao === "Sim"; }).length;
    const laudoCount = filteredRecords.filter(function (r) { return r.LaudoDefesaCivil === "Sim"; }).length;
    const deslCount = filteredRecords.filter(function (r) { return r.RiscosExpostos.toLowerCase().includes("deslizamento"); }).length;
    const animCount = filteredRecords.filter(function (r) { return r.Animais === "Sim"; }).length;

    const vulnList = [
      { label: "Risco Deslizamento", count: deslCount, color: "var(--r5)" },
      { label: "Mobilidade Reduzida", count: mobCount, color: "var(--r4)" },
      { label: "Medicação Controlada", count: medCount, color: "var(--r3)" },
      { label: "Laudo Defesa Civil", count: laudoCount, color: "var(--primary)" },
      { label: "Com Animais", count: animCount, color: "var(--r1)" }
    ];

    els.chartVulnerabilities.innerHTML = vulnList.map(function (v) {
      return (
        "<div class='horizontal-bar-row'>" +
          "<span>" + v.label + "</span>" +
          "<div class='horizontal-bar-track'><div class='horizontal-bar-fill' style='width:" + ((v.count / total) * 100) + "%;background:" + v.color + ";'></div></div>" +
          "<strong>" + v.count + "</strong>" +
        "</div>"
      );
    }).join("");
  }

  function selectPoint(id, panToMap) {
    if (panToMap === undefined) panToMap = true;
    selectedRecordId = id;
    const record = allRecords.find(function(r) { return r.ID === id; });
    renderMapMarkers();
    renderPointsList();
    renderDetailsTab(record);
    if (panToMap && record && record.Latitude && record.Longitude) {
      map.flyTo([record.Latitude, record.Longitude], 19, { duration: 0.6 });
    }
    switchTab("details");
  }

  window.selectAndOpenPoint = function (id) {
    selectPoint(id, false);
  };

  function switchTab(tabName) {
    currentTab = tabName;
    els.tabBtns.forEach(function(btn) {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    els.tabContents.forEach(function(content) {
      content.style.display = content.id === ("tab-" + tabName) ? "block" : "none";
    });
  }

  function populateFilterOptions() {
    const agents = Array.from(new Set(allRecords.map(function(r) { return r.Responsavel; }).filter(Boolean))).sort();
    els.agentSelect.innerHTML = "<option value='all'>Todos os Agentes</option>" +
      agents.map(function(a) { return "<option value='" + a + "'>" + a + "</option>"; }).join("");

    const dates = Array.from(new Set(allRecords.map(function(r) { return r.DataInspecao; }).filter(Boolean))).sort();
    els.dateSelect.innerHTML = "<option value='all'>Todas as Datas</option>" +
      dates.map(function(d) { return "<option value='" + d + "'>" + formatDatePt(d) + "</option>"; }).join("");
  }

  function syncData() {
    if (isSyncing) return;
    isSyncing = true;
    els.syncPulse.classList.add("syncing");
    els.syncText.textContent = "Sincronizando...";

    const t = Date.now();
    const fetchInspections = fetch(SHEET_CSV_URL + "&t=" + t)
      .then(function (response) {
        if (!response.ok) throw new Error("Falha HTTP " + response.status);
        return response.text();
      })
      .then(function (csvText) {
        return new Promise(function (resolve, reject) {
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function (results) { resolve(results.data || []); },
            error: reject
          });
        });
      });

    const fetchPontosEncontro = fetch(PONTOS_ENCONTRO_CSV_URL + "&t=" + t)
      .then(function (response) {
        if (!response.ok) throw new Error("Falha HTTP " + response.status);
        return response.text();
      })
      .then(function (csvText) {
        return new Promise(function (resolve, reject) {
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function (results) { resolve(results.data || []); },
            error: reject
          });
        });
      });

    Promise.allSettled([fetchInspections, fetchPontosEncontro])
      .then(function (results) {
        const inspRes = results[0];
        const peRes = results[1];

        let isOnline = false;

        if (inspRes.status === "fulfilled" && inspRes.value.length > 0) {
          allRecords = inspRes.value.map(function(row, idx) { return normalizeRecord(row, idx); });
          isOnline = true;
        } else {
          fallbackToInitialRecords();
        }

        if (peRes.status === "fulfilled" && peRes.value.length > 0) {
          allPontosEncontro = peRes.value.map(function(row, idx) { return normalizePontoEncontro(row, idx); });
          renderPontosEncontro(allPontosEncontro);
        } else {
          fallbackToInitialPontosEncontro();
        }

        onDataLoaded(isOnline);
      })
      .catch(function () {
        fallbackToInitialRecords();
        fallbackToInitialPontosEncontro();
      })
      .finally(function () {
        isSyncing = false;
        els.syncPulse.classList.remove("syncing");
      });
  }

  function fallbackToInitialRecords() {
    if (window.INITIAL_RECORDS && window.INITIAL_RECORDS.length > 0 && allRecords.length === 0) {
      allRecords = window.INITIAL_RECORDS.map(function(row, idx) { return normalizeRecord(row, idx); });
      onDataLoaded(false);
    }
  }

  function onDataLoaded(isOnline) {
    lastSyncTime = new Date();
    const timeStr = lastSyncTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const peCount = allPontosEncontro.length > 0 ? (" · " + allPontosEncontro.length + " PE") : "";
    els.syncText.textContent = isOnline
      ? ("Conectado · " + allRecords.length + " pontos" + peCount + " (" + timeStr + ")")
      : ("Modo Local · " + allRecords.length + " pontos" + peCount);
    populateFilterOptions();
    applyFilters();
  }

  let viewerState = {
    scale: 1,
    rotation: 0,
    posX: 0,
    posY: 0,
    isDragging: false,
    startX: 0,
    startY: 0
  };

  function updateViewerTransform() {
    if (!els.modalPhotoImg) return;
    els.modalPhotoImg.style.transform = "translate(" + viewerState.posX + "px, " + viewerState.posY + "px) scale(" + viewerState.scale + ") rotate(" + viewerState.rotation + "deg)";
    if (els.zoomLevelBadge) {
      els.zoomLevelBadge.textContent = Math.round(viewerState.scale * 100) + "%";
    }
  }

  function resetViewer() {
    viewerState.scale = 1;
    viewerState.rotation = 0;
    viewerState.posX = 0;
    viewerState.posY = 0;
    viewerState.isDragging = false;
    updateViewerTransform();
  }

  function zoomBy(factor) {
    viewerState.scale = Math.min(6, Math.max(0.3, viewerState.scale * factor));
    updateViewerTransform();
  }

  function rotateBy(deg) {
    viewerState.rotation = (viewerState.rotation + deg) % 360;
    updateViewerTransform();
  }

  window.openPhotoLightbox = function (photoId, caption) {
    if (!photoId) return;
    resetViewer();
    if (els.modalLoader) els.modalLoader.style.display = "flex";
    els.modalPhotoImg.style.opacity = "0";
    els.modalPhotoImg.referrerPolicy = "no-referrer";

    const highResUrl = "https://lh3.googleusercontent.com/d/" + photoId + "=w2048";
    const fallbackUrl = "https://drive.google.com/thumbnail?id=" + photoId + "&sz=w1600";
    const driveViewUrl = "https://drive.google.com/file/d/" + photoId + "/view?usp=drivesdk";

    els.modalPhotoImg.onload = function () {
      if (els.modalLoader) els.modalLoader.style.display = "none";
      els.modalPhotoImg.style.opacity = "1";
    };
    els.modalPhotoImg.onerror = function () {
      if (this.src !== fallbackUrl) {
        this.src = fallbackUrl;
      } else {
        if (els.modalLoader) els.modalLoader.style.display = "none";
        els.modalPhotoImg.style.opacity = "1";
      }
    };

    els.modalPhotoImg.src = highResUrl;
    els.modalPhotoCaption.textContent = caption || "Documento / Fotografia";
    if (els.modalDriveLink) els.modalDriveLink.href = driveViewUrl;
    if (els.modalTabLink) els.modalTabLink.href = highResUrl;
    els.photoModal.classList.add("open");
  };

  function convertGeoJSONToKML(geojson, docTitle) {
    let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n';
    kml += '<name>' + (docTitle || 'Camada PCRA') + '</name>\n';
    
    (geojson.features || []).forEach(function (f) {
      const p = f.properties || {};
      const g = f.geometry || {};
      const name = p.nome || p.Nome || p.id_unidade || p.id || p.bo_no || (p.PontoNum ? 'Ponto ' + p.PontoNum : 'Elemento');
      
      kml += '<Placemark>\n';
      kml += '<name>' + String(name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</name>\n';
      kml += '<description><![CDATA[\n<table border="1" cellpadding="4" cellspacing="0" style="font-family:sans-serif;font-size:12px;">\n';
      Object.keys(p).forEach(function (k) {
        if (p[k] !== undefined && p[k] !== null && p[k] !== "") {
          kml += '<tr><td style="background:#f1f5f9;font-weight:bold;">' + k + '</td><td>' + p[k] + '</td></tr>\n';
        }
      });
      kml += '</table>\n]]></description>\n';
      
      if (g.type === 'Point' && g.coordinates) {
        kml += '<Point><coordinates>' + g.coordinates[0] + ',' + g.coordinates[1] + ',0</coordinates></Point>\n';
      } else if (g.type === 'Polygon' && g.coordinates && g.coordinates[0]) {
        kml += '<Polygon><outerBoundaryIs><LinearRing><coordinates>\n';
        g.coordinates[0].forEach(function (c) {
          kml += c[0] + ',' + c[1] + ',0 ';
        });
        kml += '\n</coordinates></LinearRing></outerBoundaryIs></Polygon>\n';
      } else if (g.type === 'MultiPolygon' && g.coordinates) {
        kml += '<MultiGeometry>\n';
        g.coordinates.forEach(function (poly) {
          if (poly && poly[0]) {
            kml += '<Polygon><outerBoundaryIs><LinearRing><coordinates>\n';
            poly[0].forEach(function (c) {
              kml += c[0] + ',' + c[1] + ',0 ';
            });
            kml += '\n</coordinates></LinearRing></outerBoundaryIs></Polygon>\n';
          }
        });
        kml += '</MultiGeometry>\n';
      }
      kml += '</Placemark>\n';
    });
    
    kml += '</Document>\n</kml>';
    return kml;
  }

  function triggerDownload(blob, filename) {
    try {
      if (typeof saveAs === "function") {
        saveAs(blob, filename);
        return;
      }
    } catch (e) {
      console.warn("saveAs error:", e);
    }
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, filename);
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.setAttribute("download", filename);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(function () {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 4000);
  }

  function downloadLayerData(layerKey, format, triggerBtn) {
    let geojson = null;
    let fileName = "pcra_" + layerKey;
    const allLayers = window.PCRA_LAYERS || layersData || {};
    
    let originalText = "";
    if (triggerBtn) {
      originalText = triggerBtn.textContent;
      triggerBtn.textContent = "⏳...";
    }

    if (layerKey === "vistorias_campo") {
      const recordsToExport = (filteredRecords && filteredRecords.length > 0) ? filteredRecords : allRecords;
      geojson = {
        type: "FeatureCollection",
        name: "vistorias_campo",
        features: recordsToExport.map(function(r) {
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: [r.Longitude, r.Latitude] },
            properties: {
              ponto_num: r.PontoNum,
              nome_entrevistado: r.Nome,
              endereco: r.Endereco,
              risco_agente: r.RiscoAgente,
              risco_morador: r.RiscoMorador,
              responsavel: r.Responsavel,
              data_inspecao: r.DataInspecao,
              precisao_gps: r.PrecisaoGPS,
              mobilidade_reduzida: r.Mobilidade,
              medicacao_controlada: r.Medicacao,
              laudo_defesa_civil: r.LaudoDefesaCivil,
              riscos_expostos: r.RiscosExpostos
            }
          };
        })
      };
      fileName = "pcra_vistorias_campo";
    } else if (layerKey === "equipamentos") {
      const featList = [];
      if (allLayers.equip_escolas && allLayers.equip_escolas.features) featList.push.apply(featList, allLayers.equip_escolas.features);
      if (allLayers.equip_saude && allLayers.equip_saude.features) featList.push.apply(featList, allLayers.equip_saude.features);
      if (allLayers.equip_instituicoes_religiosas && allLayers.equip_instituicoes_religiosas.features) featList.push.apply(featList, allLayers.equip_instituicoes_religiosas.features);
      geojson = { type: "FeatureCollection", name: "equipamentos_comunitarios", features: featList };
      fileName = "pcra_equipamentos_comunitarios";
    } else if (layerKey === "percepcao_simbolos") {
      geojson = allLayers.percepcao_simbolos;
      fileName = "percepcao_simbolos_participativos";
    } else if (layerKey === "percepcao_anotacoes") {
      geojson = allLayers.percepcao_anotacoes;
      fileName = "percepcao_anotacoes_comunidade";
    } else if (layerKey === "percepcao_caminhos") {
      geojson = allLayers.percepcao_caminhos;
      fileName = "percepcao_caminhos_e_escadoes";
    } else if (layerKey === "percepcao_areas") {
      geojson = allLayers.percepcao_areas;
      fileName = "percepcao_areas_risco";
    } else if (layerKey === "percepcao_limite") {
      geojson = allLayers.percepcao_limite;
      fileName = "percepcao_limite_participativo";
    } else if (layerKey === "obras_contencao") {
      geojson = allLayers.obras_contencao;
      fileName = "obras_contencao_secretaria_de_obras";
    } else if (allLayers[layerKey]) {
      geojson = allLayers[layerKey];
    }
    
    if (!geojson) {
      if (triggerBtn) triggerBtn.textContent = originalText;
      alert("Camada não encontrada ou ainda carregando.");
      return;
    }
    
    try {
      if (format === "geojson") {
        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json;charset=utf-8" });
        triggerDownload(blob, fileName + ".geojson");
      } else if (format === "kml") {
        const kmlStr = convertGeoJSONToKML(geojson, fileName);
        const blob = new Blob([kmlStr], { type: "application/vnd.google-earth.kml+xml;charset=utf-8" });
        triggerDownload(blob, fileName + ".kml");
      } else if (format === "csv") {
        const features = geojson.features || [];
        if (features.length === 0) {
          alert("Não há feições para exportar em CSV.");
          if (triggerBtn) triggerBtn.textContent = originalText;
          return;
        }
        const propSet = new Set();
        features.forEach(function (f) {
          Object.keys(f.properties || {}).forEach(function (k) { propSet.add(k); });
        });
        const allPropKeys = Array.from(propSet);
        const headers = ["latitude", "longitude"].concat(allPropKeys);
        const csvRows = [headers.join(";")];
        features.forEach(function (f) {
          const coords = f.geometry && f.geometry.type === "Point" ? f.geometry.coordinates : ["", ""];
          const row = [coords[1] || "", coords[0] || ""].concat(
            allPropKeys.map(function (k) {
              return '"' + String((f.properties && f.properties[k]) !== undefined ? f.properties[k] : "").replace(/"/g, '""') + '"';
            })
          );
          csvRows.push(row.join(";"));
        });
        const blob = new Blob(["\uFEFF" + csvRows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
        triggerDownload(blob, fileName + ".csv");
      }
    } catch (err) {
      console.error("Erro no download:", err);
      alert("Erro ao processar download: " + err.message);
    } finally {
      if (triggerBtn) {
        setTimeout(function () { triggerBtn.textContent = originalText; }, 600);
      }
    }
  }

  async function downloadAllLayersAsZip(btn) {
    if (typeof JSZip === "undefined") {
      alert("Biblioteca de compactação ZIP carregando... tente em instantes.");
      return;
    }
    const allLayers = window.PCRA_LAYERS || layersData || {};
    const zip = new JSZip();
    const folder = zip.folder("PCRA_Parque_Burnier_Camadas_SIG");
    
    let originalBtnText = "";
    if (btn && btn.textContent) {
      originalBtnText = btn.textContent;
      btn.textContent = "⏳ Compactando camadas...";
      btn.disabled = true;
    }

    try {
      // 1. Survey GeoJSON & KML
      const surveyGeoJSON = {
        type: "FeatureCollection",
        name: "01_vistorias_campo_pcra",
        features: allRecords.map(function (r) {
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: [r.Longitude, r.Latitude] },
            properties: {
              ponto_num: r.PontoNum,
              nome_entrevistado: r.Nome,
              endereco: r.Endereco,
              risco_agente: r.RiscoAgente,
              risco_morador: r.RiscoMorador,
              responsavel: r.Responsavel,
              data_inspecao: r.DataInspecao,
              precisao_gps: r.PrecisaoGPS,
              mobilidade_reduzida: r.Mobilidade,
              medicacao_controlada: r.Medicacao,
              laudo_defesa_civil: r.LaudoDefesaCivil,
              riscos_expostos: r.RiscosExpostos
            }
          };
        })
      };
      folder.file("01_vistorias_campo_pcra.geojson", JSON.stringify(surveyGeoJSON, null, 2));
      folder.file("01_vistorias_campo_pcra.kml", convertGeoJSONToKML(surveyGeoJSON, "Vistorias PCRA"));
      
      // 2. Situação Edificações
      if (allLayers.situacao_edificacoes) {
        folder.file("02_situacao_edificacoes_146.geojson", JSON.stringify(allLayers.situacao_edificacoes, null, 2));
        folder.file("02_situacao_edificacoes_146.kml", convertGeoJSONToKML(allLayers.situacao_edificacoes, "Situação das Edificações"));
      }
      // 3. Ocorrências DC
      if (allLayers.ocorrencias_defesa_civil) {
        folder.file("03_ocorrencias_defesa_civil_745.geojson", JSON.stringify(allLayers.ocorrencias_defesa_civil, null, 2));
        folder.file("03_ocorrencias_defesa_civil_745.kml", convertGeoJSONToKML(allLayers.ocorrencias_defesa_civil, "Ocorrências Defesa Civil"));
      }
      // 4. Áreas Inaproveitáveis
      if (allLayers.area_inaproveitavel) {
        folder.file("04_area_inaproveitavel.geojson", JSON.stringify(allLayers.area_inaproveitavel, null, 2));
        folder.file("04_area_inaproveitavel.kml", convertGeoJSONToKML(allLayers.area_inaproveitavel, "Áreas Inaproveitáveis"));
      }
      // 5. Lotes Caixa
      if (allLayers.lotes_caixa) {
        folder.file("05_lotes_caixa_economica.geojson", JSON.stringify(allLayers.lotes_caixa, null, 2));
        folder.file("05_lotes_caixa_economica.kml", convertGeoJSONToKML(allLayers.lotes_caixa, "Lotes Caixa Econômica"));
      }
      // 6. Setores Risco
      if (allLayers.risco_geologico) {
        folder.file("06_setores_risco_geologico.geojson", JSON.stringify(allLayers.risco_geologico, null, 2));
        folder.file("06_setores_risco_geologico.kml", convertGeoJSONToKML(allLayers.risco_geologico, "Setores Risco Geológico"));
      }
      // 7. Área de Atuação PCRA
      if (allLayers.area_atuacao_pcra) {
        folder.file("07_area_atuacao_pcra_burnier.geojson", JSON.stringify(allLayers.area_atuacao_pcra, null, 2));
        folder.file("07_area_atuacao_pcra_burnier.kml", convertGeoJSONToKML(allLayers.area_atuacao_pcra, "Área de Atuação PCRA"));
      }
      // 8. Áreas Prioritárias (Plano de Ação)
      if (allLayers.areas_prioritarias) {
        folder.file("08_areas_prioritarias_plano_de_acao.geojson", JSON.stringify(allLayers.areas_prioritarias, null, 2));
        folder.file("08_areas_prioritarias_plano_de_acao.kml", convertGeoJSONToKML(allLayers.areas_prioritarias, "Áreas Prioritárias (Plano de Ação)"));
      }
      // 9. Obras de Contenção
      if (allLayers.obras_contencao) {
        folder.file("09_obras_contencao_secretaria_de_obras.geojson", JSON.stringify(allLayers.obras_contencao, null, 2));
        folder.file("09_obras_contencao_secretaria_de_obras.kml", convertGeoJSONToKML(allLayers.obras_contencao, "Obras de Contenção - Secretaria de Obras"));
      }
      // 10. ADES HIS
      if (allLayers.ades_his) {
        folder.file("10_ades_his_parque_burnier.geojson", JSON.stringify(allLayers.ades_his, null, 2));
        folder.file("10_ades_his_parque_burnier.kml", convertGeoJSONToKML(allLayers.ades_his, "ADES HIS Parque Burnier"));
      }
      // 11. Equipamentos Comunitários
      const featEquip = [];
      if (allLayers.equip_escolas && allLayers.equip_escolas.features) featEquip.push.apply(featEquip, allLayers.equip_escolas.features);
      if (allLayers.equip_saude && allLayers.equip_saude.features) featEquip.push.apply(featEquip, allLayers.equip_saude.features);
      if (allLayers.equip_instituicoes_religiosas && allLayers.equip_instituicoes_religiosas.features) featEquip.push.apply(featEquip, allLayers.equip_instituicoes_religiosas.features);
      if (featEquip.length > 0) {
        const equipGeoJSON = { type: "FeatureCollection", name: "equipamentos_comunitarios", features: featEquip };
        folder.file("11_equipamentos_comunitarios.geojson", JSON.stringify(equipGeoJSON, null, 2));
        folder.file("11_equipamentos_comunitarios.kml", convertGeoJSONToKML(equipGeoJSON, "Equipamentos Comunitários"));
      }
            // 12. Mapeamento Participativo
      if (allLayers.percepcao_simbolos) {
        folder.file("12_percepcao_simbolos_participativos.geojson", JSON.stringify(allLayers.percepcao_simbolos, null, 2));
        folder.file("12_percepcao_simbolos_participativos.kml", convertGeoJSONToKML(allLayers.percepcao_simbolos, "Símbolos Participativos"));
      }
      if (allLayers.percepcao_anotacoes) {
        folder.file("13_percepcao_anotacoes_comunidade.geojson", JSON.stringify(allLayers.percepcao_anotacoes, null, 2));
        folder.file("13_percepcao_anotacoes_comunidade.kml", convertGeoJSONToKML(allLayers.percepcao_anotacoes, "Anotações da Comunidade"));
      }
      if (allLayers.percepcao_caminhos) {
        folder.file("14_percepcao_caminhos_e_escadoes.geojson", JSON.stringify(allLayers.percepcao_caminhos, null, 2));
        folder.file("14_percepcao_caminhos_e_escadoes.kml", convertGeoJSONToKML(allLayers.percepcao_caminhos, "Caminhos e Escadões"));
      }
      if (allLayers.percepcao_areas) {
        folder.file("15_percepcao_areas_risco.geojson", JSON.stringify(allLayers.percepcao_areas, null, 2));
        folder.file("15_percepcao_areas_risco.kml", convertGeoJSONToKML(allLayers.percepcao_areas, "Áreas Percebidas"));
      }
      if (allLayers.percepcao_limite) {
        folder.file("16_percepcao_limite_desenhado.geojson", JSON.stringify(allLayers.percepcao_limite, null, 2));
        folder.file("16_percepcao_limite_desenhado.kml", convertGeoJSONToKML(allLayers.percepcao_limite, "Limite Desenhado"));
      }
      if (allPontosEncontro && allPontosEncontro.length > 0) {
        const peGeo = {
          type: "FeatureCollection",
          name: "pontos_encontro_rotas_de_fuga",
          features: allPontosEncontro.map(function (p) {
            return {
              type: "Feature",
              properties: {
                fid: p.fid,
                setor: p.setor,
                nome: p.nome,
                referencia: p.referencia,
                infra: p.infra,
                instalacao: p.qual,
                qtd_casas: p.qtdCasas,
                qtd_idosos: p.qtdIdoso,
                qtd_interditadas: p.qtdInterd,
                qtd_pessoas: p.qtdPessoas,
                fotografias_qtd: p.photos ? p.photos.length : 0
              },
              geometry: {
                type: "Point",
                coordinates: [p.lng, p.lat]
              }
            };
          })
        };
        folder.file("17_pontos_encontro_rotas_de_fuga.geojson", JSON.stringify(peGeo, null, 2));
        folder.file("17_pontos_encontro_rotas_de_fuga.kml", convertGeoJSONToKML(peGeo, "Pontos de Encontro (Rotas de Fuga)"));
      }
      // 18. README
      const readme = "=========================================================\n" +
        "PLANO COMUNITÁRIO DE REDUÇÃO DE RISCOS (PCRA) — PARQUE BURNIER\n" +
        "PACOTE DE DADOS GEOESPACIAIS VETORIAIS (SIG / WEBGIS)\n" +
        "=========================================================\n\n" +
        "Sistema de Referência Espacial: SIRGAS 2000 / WGS 84 (EPSG:4326)\n" +
        "Data de Exportação: " + new Date().toLocaleDateString("pt-BR") + "\n" +
        "Desenvolvido por: Rebeca Diniz Moura · GeoDeveloper\n" +
        "Parceria: Ministério das Cidades / Governo Federal & Periferia Sem Risco\n\n" +
        "Arquivos Geoespaciais incluídos:\n" +
        "- 01_vistorias_campo_pcra (Vistorias e diagnósticos de risco socioterritorial)\n" +
        "- 02_situacao_edificacoes_146 (146 imóveis cadastrados pela Defesa Civil)\n" +
        "- 03_ocorrencias_defesa_civil_745 (745 boletins históricos da Defesa Civil)\n" +
        "- 04_area_inaproveitavel (6 polígonos de restrição geotécnica - 26.429 m²)\n" +
        "- 05_lotes_caixa_economica (59 lotes cadastrados da Caixa - 18.858 m²)\n" +
        "- 06_setores_risco_geologico (Setores de Risco Geológico R1, R2, R3 e R4)\n" +
        "- 07_area_atuacao_pcra_burnier (Polígono perimetral de atuação do projeto - 17,49 ha)\n" +
        "- 08_areas_prioritarias_plano_de_acao (8 polígonos de intervenção prioritária - 6,87 ha)\n" +
        "- 09_obras_contencao_secretaria_de_obras (4 polígonos de contenção da Secretaria de Obras - PJF - 13.907 m²)\n" +
        "- 10_ades_his_parque_burnier (Perímetro da Área de Especial Interesse Social)\n" +
        "- 11_equipamentos_comunitarios (Escolas, Saúde e Instituições Religiosas)\n" +
        "- 17_pontos_encontro_rotas_de_fuga (Pontos de Encontro das Rotas de Fuga do PCRA)\n";
      folder.file("LEIAME_METADADOS.txt", readme);

      const blob = await zip.generateAsync({ type: "blob" });
      triggerDownload(blob, "PCRA_Parque_Burnier_Camadas_SIG_" + new Date().toISOString().slice(0, 10) + ".zip");
    } catch (err) {
      console.error("ZIP packaging failed:", err);
      alert("Erro ao compactar arquivos ZIP: " + err.message);
    } finally {
      if (btn && originalBtnText) {
        btn.textContent = originalBtnText;
        btn.disabled = false;
      }
    }
  }

  let selectedPdfFormat = "A3";
  let selectedPdfOrientation = "landscape";

  function getActiveLayersList() {
    const active = [];
    
    // 1. Survey Points
    if (isPointsVisible && filteredRecords.length > 0) {
      active.push({
        type: "point",
        label: "Vistorias PCRA (" + filteredRecords.length + ")",
        fill: [2, 132, 199],
        stroke: [2, 132, 199]
      });
    }

    // Helper to test if overlay layer is active on the map
    const isLayerActive = function (key) {
      const chk = document.querySelector('.layer-toggle-checkbox[data-layer="' + key + '"]');
      if (chk) return chk.checked;
      return overlayLayers[key] && map.hasLayer(overlayLayers[key]);
    };

    // Pontos de Encontro (Rotas de Fuga)
    if (isLayerActive("pontos_encontro") && allPontosEncontro.length > 0) {
      active.push({
        type: "point",
        label: "Pontos de Encontro / Rotas de Fuga (" + allPontosEncontro.length + " PE)",
        fill: [20, 83, 45],
        stroke: [255, 255, 255]
      });
    }

    // 2. Obras de Contenção
    if (isLayerActive("obras_contencao")) {
      active.push({ type: "polygon_dashed", label: "Obras de Contenção · Sec. de Obras (4 pol. · 1,39 ha)", fill: [224, 242, 254], stroke: [2, 132, 199] });
    }

    // 3. Situação Edificações (146 imóveis)
    if (isLayerActive("situacao_edificacoes")) {
      active.push({ type: "point", label: "Edificação Interditada (90)", fill: [234, 88, 12], stroke: [234, 88, 12] });
      active.push({ type: "point", label: "Edificação Destruída (22)", fill: [185, 28, 28], stroke: [185, 28, 28] });
      active.push({ type: "point", label: "Edificação Atingida (15)", fill: [147, 51, 234], stroke: [147, 51, 234] });
      active.push({ type: "point", label: "Edificação Adjacente (14)", fill: [217, 119, 6], stroke: [217, 119, 6] });
      active.push({ type: "point", label: "Não Habitacional / Outras (5)", fill: [8, 145, 178], stroke: [8, 145, 178] });
    }

    // 3. Ocorrências Defesa Civil
    if (isLayerActive("ocorrencias_defesa_civil")) {
      active.push({ type: "point", label: "Ocorrências Defesa Civil (745)", fill: [217, 119, 6], stroke: [180, 83, 9] });
    }

    // 4. Áreas Inaproveitáveis
    if (isLayerActive("area_inaproveitavel")) {
      active.push({ type: "polygon_dashed", label: "Áreas Inaproveitáveis (6 pol.)", fill: [254, 226, 226], stroke: [153, 27, 27] });
    }

    // 5. Lotes Caixa
    if (isLayerActive("lotes_caixa")) {
      active.push({ type: "polygon", label: "Lotes Caixa Econômica (59)", fill: [224, 242, 254], stroke: [2, 132, 199] });
    }

    // 6. Setores Risco
    if (isLayerActive("risco_geologico")) {
      active.push({ type: "polygon", label: "Setores Risco Geológico (R1-R4)", fill: [254, 202, 202], stroke: [220, 38, 38] });
    }

    // 7. Área de Atuação PCRA
    if (isLayerActive("area_atuacao_pcra")) {
      active.push({ type: "polygon", label: "Área de Atuação PCRA (17,49 ha)", fill: [220, 252, 231], stroke: [22, 163, 74] });
    }

    // 8. Áreas Prioritárias (Plano de Ação)
    if (isLayerActive("areas_prioritarias")) {
      active.push({ type: "polygon_dashed", label: "Áreas Prioritárias (8 áreas · 6,87 ha)", fill: [255, 228, 230], stroke: [225, 29, 72] });
    }

    // 9. ADES HIS
    if (isLayerActive("ades_his")) {
      active.push({ type: "polygon", label: "ADES HIS Parque Burnier", fill: [243, 232, 255], stroke: [124, 58, 237] });
    }

    // 8. Equipamentos
    if (isLayerActive("equip_escolas")) {
      active.push({ type: "point", label: "Escolas e Creches", fill: [2, 132, 199], stroke: [2, 132, 199] });
    }
    if (isLayerActive("equip_saude")) {
      active.push({ type: "point", label: "Postos de Saúde", fill: [220, 38, 38], stroke: [220, 38, 38] });
    }
    if (isLayerActive("equip_instituicoes_religiosas")) {
      active.push({ type: "point", label: "Igrejas / Espaços Comunitários", fill: [124, 58, 237], stroke: [124, 58, 237] });
    }

    // 9. Ortofoto Drone HD Sobreposta
    if (isLayerActive("ortofoto_overlay")) {
      active.push({ type: "polygon", label: "Ortofoto Drone HD (PCRA)", fill: [16, 185, 129], stroke: [5, 150, 105] });
    }

    // 10. Declividade ADES HIS Sobreposta
    if (isLayerActive("declividade_overlay")) {
      active.push({ type: "polygon", label: "Declividade (0-30-45% ADES HIS)", fill: [255, 193, 7], stroke: [198, 40, 40] });
    }

    return active;
  }

  async function generateCartographicPDF() {
    if (typeof jspdf === "undefined" || typeof html2canvas === "undefined") {
      alert("Bibliotecas de geração de PDF carregando... aguarde alguns instantes.");
      return;
    }

    if (els.pdfProgressBox) els.pdfProgressBox.style.display = "block";
    if (els.generatePdfSubmitBtn) els.generatePdfSubmitBtn.disabled = true;
    if (els.pdfBtnText) els.pdfBtnText.textContent = "Renderizando prancha cartográfica...";

    try {
      const mapEl = document.getElementById("map-view");
      
      // Capture map view with exact dimensions and no scroll offset to avoid displacement
      const canvas = await html2canvas(mapEl, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: mapEl.clientWidth,
        windowHeight: mapEl.clientHeight,
        ignoreElements: function (el) {
          return el.classList && (
            el.classList.contains("floating-map-widget") ||
            el.classList.contains("map-controls-widget") ||
            el.classList.contains("leaflet-control-zoom") ||
            el.classList.contains("leaflet-control-attribution")
          );
        }
      });

      const { jsPDF } = jspdf;
      const doc = new jsPDF({
        orientation: selectedPdfOrientation,
        unit: "mm",
        format: selectedPdfFormat.toLowerCase()
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Standard A3 reference scale
      const scale = selectedPdfOrientation === "landscape" ? (pageWidth / 420) : (pageWidth / 297);
      const margin = 8 * Math.sqrt(scale);
      const innerMargin = 3 * Math.sqrt(scale);

      // 1. Technical Outer Frame (Margem Técnica ABNT)
      doc.setDrawColor(27, 67, 50);
      doc.setLineWidth(1.0 * Math.sqrt(scale));
      doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);
      
      doc.setDrawColor(200, 210, 200);
      doc.setLineWidth(0.3 * Math.sqrt(scale));
      doc.rect(margin + 1.5 * Math.sqrt(scale), margin + 1.5 * Math.sqrt(scale), pageWidth - 2 * margin - 3 * Math.sqrt(scale), pageHeight - 2 * margin - 3 * Math.sqrt(scale));

      // Header, Footer and Map dimensions
      const headerH = (selectedPdfOrientation === "landscape" ? 24 : 26) * scale;
      const footerH = (els.pdfIncSeal && els.pdfIncSeal.checked) ? ((selectedPdfOrientation === "landscape" ? 20 : 22) * scale) : 0;
      
      const frameX = margin + innerMargin;
      const frameW = pageWidth - 2 * margin - 2 * innerMargin;
      const headerY = margin + innerMargin;

      // 2. Header Box (Cabeçalho Institucional & Título Centralizado)
      doc.setFillColor(255, 253, 245);
      doc.setDrawColor(45, 106, 79);
      doc.setLineWidth(0.6 * Math.sqrt(scale));
      doc.roundedRect(frameX, headerY, frameW, headerH, 2 * scale, 2 * scale, "FD");

      const incLogos = els.pdfIncLogos && els.pdfIncLogos.checked;
      const logosObj = window.APP_LOGOS || window.PCRA_LOGOS || {};
      const hasLogos = incLogos && logosObj && (logosObj.periferiaSemRisco || logosObj.planosComunitarios || logosObj.ministerioCidades);
      
      const logosSecW = hasLogos ? (frameW * (selectedPdfOrientation === "landscape" ? 0.36 : 0.42)) : 0;

      // Draw Logos in Left Section
      if (hasLogos) {
        let maxLogoH = headerH - 6 * scale;
        const totalRatio = 7.7;
        const availableLogoW = logosSecW - 14 * scale;
        if (maxLogoH * totalRatio > availableLogoW) {
          maxLogoH = availableLogoW / totalRatio;
        }
        const logoY = headerY + (headerH - maxLogoH) / 2;
        let logoX = frameX + 4 * scale;

        try {
          if (logosObj.periferiaSemRisco) {
            const lW = maxLogoH * 2.2;
            doc.addImage(logosObj.periferiaSemRisco, "PNG", logoX, logoY, lW, maxLogoH);
            logoX += lW + 3 * scale;
          }
          if (logosObj.planosComunitarios) {
            const lW = maxLogoH * 2.5;
            doc.addImage(logosObj.planosComunitarios, "PNG", logoX, logoY, lW, maxLogoH);
            logoX += lW + 3 * scale;
          }
          if (logosObj.ministerioCidades) {
            const lW = maxLogoH * 3.0;
            doc.addImage(logosObj.ministerioCidades, "PNG", logoX, logoY, lW, maxLogoH);
          }
        } catch (logoErr) {
          console.warn("Logo drawing fallback:", logoErr);
        }

        // Vertical Separator Line between Logos and Title
        doc.setDrawColor(209, 213, 219);
        doc.setLineWidth(0.4 * Math.sqrt(scale));
        doc.line(frameX + logosSecW, headerY + 3 * scale, frameX + logosSecW, headerY + headerH - 3 * scale);
      }

      // Title & Subtitle (Centered in the Title Area)
      const titleAreaW = frameW - logosSecW;
      const titleCenterX = frameX + logosSecW + titleAreaW / 2;
      const rawTitle = (els.pdfTitleInput && els.pdfTitleInput.value.trim()) || "PLANO COMUNITÁRIO DE REDUÇÃO DE RISCOS (PCRA)";
      const rawSubtitle = (els.pdfSubtitleInput && els.pdfSubtitleInput.value.trim()) || "Diagnóstico Territorial e Mapeamento de Risco · Parque Burnier";

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12 * scale);
      doc.setTextColor(27, 67, 50);
      doc.text(rawTitle, titleCenterX, headerY + headerH * 0.44, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8 * scale);
      doc.setTextColor(75, 85, 99);
      doc.text(rawSubtitle, titleCenterX, headerY + headerH * 0.74, { align: "center" });

      // 3. Technical Map Area Box
      const mapTopY = headerY + headerH + 3 * Math.sqrt(scale);
      const mapBottomY = footerH > 0 ? (pageHeight - margin - innerMargin - footerH - 3 * Math.sqrt(scale)) : (pageHeight - margin - innerMargin);
      const availMapW = frameW;
      const availMapH = mapBottomY - mapTopY;

      // Fit map maintaining exact aspect ratio of captured canvas without distortion or offset
      const cleanMapData = canvas.toDataURL("image/jpeg", 0.96);
      const canvasAspect = canvas.width / canvas.height;
      let targetMapW = availMapW;
      let targetMapH = availMapW / canvasAspect;
      let targetMapX = frameX;
      let targetMapY = mapTopY;

      if (targetMapH > availMapH) {
        targetMapH = availMapH;
        targetMapW = availMapH * canvasAspect;
        targetMapX = frameX + (availMapW - targetMapW) / 2;
      } else {
        targetMapY = mapTopY + (availMapH - targetMapH) / 2;
      }

      // Fill background
      doc.setFillColor(240, 243, 240);
      doc.rect(frameX, mapTopY, availMapW, availMapH, "F");

      // Insert Unstretched Map Image
      doc.addImage(cleanMapData, "JPEG", targetMapX, targetMapY, targetMapW, targetMapH, undefined, "FAST");

      // Draw Map Outer Border
      doc.setDrawColor(45, 106, 79);
      doc.setLineWidth(0.8 * Math.sqrt(scale));
      doc.rect(frameX, mapTopY, availMapW, availMapH);

      // 4. North Arrow Overlay Badge (Rosa dos Ventos)
      if (els.pdfIncNorth && els.pdfIncNorth.checked) {
        const northBadgeW = 16 * scale;
        const northBadgeH = 22 * scale;
        const northBadgeX = frameX + 5 * scale;
        const northBadgeY = mapTopY + 5 * scale;

        doc.setFillColor(255, 253, 245);
        doc.setDrawColor(45, 106, 79);
        doc.setLineWidth(0.5 * Math.sqrt(scale));
        doc.roundedRect(northBadgeX, northBadgeY, northBadgeW, northBadgeH, 2 * scale, 2 * scale, "FD");

        const cx = northBadgeX + northBadgeW / 2;
        const cy = northBadgeY + northBadgeH * 0.62;

        // North Text "N"
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5 * scale);
        doc.setTextColor(27, 67, 50);
        doc.text("N", cx, northBadgeY + 4.8 * scale, { align: "center" });

        // Compass Rose Triangles
        const radius = 5.2 * scale;
        doc.setFillColor(220, 38, 38);
        doc.triangle(cx, cy - radius, cx - 2.4 * scale, cy + 1.2 * scale, cx + 2.4 * scale, cy + 1.2 * scale, "FD");
        doc.setFillColor(27, 67, 50);
        doc.triangle(cx, cy + radius * 0.8, cx - 2.4 * scale, cy + 1.2 * scale, cx + 2.4 * scale, cy + 1.2 * scale, "FD");
        
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.2 * Math.sqrt(scale));
        doc.line(cx, cy - radius, cx, cy + radius * 0.8);
      }

      // 5. Graphic Scale Bar Overlay Badge (Escala Gráfica)
      if (els.pdfIncScale && els.pdfIncScale.checked) {
        const scaleBadgeW = 54 * scale;
        const scaleBadgeH = 11 * scale;
        const scaleBadgeX = frameX + 5 * scale;
        const scaleBadgeY = mapTopY + availMapH - scaleBadgeH - 5 * scale;

        doc.setFillColor(255, 253, 245);
        doc.setDrawColor(45, 106, 79);
        doc.setLineWidth(0.5 * Math.sqrt(scale));
        doc.roundedRect(scaleBadgeX, scaleBadgeY, scaleBadgeW, scaleBadgeH, 2 * scale, 2 * scale, "FD");

        // Alternating scale bar segments
        const barX = scaleBadgeX + 3 * scale;
        const barY = scaleBadgeY + 2.5 * scale;
        const barW = 48 * scale;
        const barH = 2.4 * scale;
        const segW = barW / 4;

        for (let i = 0; i < 4; i++) {
          doc.setFillColor(i % 2 === 0 ? 27 : 255, i % 2 === 0 ? 67 : 255, i % 2 === 0 ? 50 : 255);
          doc.setDrawColor(27, 67, 50);
          doc.setLineWidth(0.2 * Math.sqrt(scale));
          doc.rect(barX + i * segW, barY, segW, barH, "FD");
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.8 * scale);
        doc.setTextColor(27, 67, 50);
        doc.text("0", barX, barY + barH + 2.6 * scale, { align: "center" });
        doc.text("50m", barX + segW, barY + barH + 2.6 * scale, { align: "center" });
        doc.text("100m", barX + segW * 2, barY + barH + 2.6 * scale, { align: "center" });
        doc.text("200m", barX + barW, barY + barH + 2.6 * scale, { align: "center" });
      }

      // 6. Dynamic Cartographic Legend (Apenas camadas selecionadas / ativas)
      if (els.pdfIncLegend && els.pdfIncLegend.checked) {
        const activeLayers = getActiveLayersList();
        
        if (activeLayers.length > 0) {
          const legW = (selectedPdfOrientation === "landscape" ? 64 : 58) * scale;
          const legH = (9 + activeLayers.length * 5.6) * scale;
          const legX = frameX + availMapW - legW - 5 * scale;
          const legY = mapTopY + 5 * scale;

          doc.setFillColor(255, 253, 245);
          doc.setDrawColor(45, 106, 79);
          doc.setLineWidth(0.6 * Math.sqrt(scale));
          doc.roundedRect(legX, legY, legW, legH, 2 * scale, 2 * scale, "FD");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.2 * scale);
          doc.setTextColor(27, 67, 50);
          doc.text("LEGENDA CARTOGRÁFICA", legX + legW / 2, legY + 5.0 * scale, { align: "center" });
          
          doc.setDrawColor(45, 106, 79);
          doc.setLineWidth(0.3 * Math.sqrt(scale));
          doc.line(legX + 3 * scale, legY + 6.6 * scale, legX + legW - 3 * scale, legY + 6.6 * scale);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.8 * scale);
          doc.setTextColor(40, 40, 40);

          let itemY = legY + 10.8 * scale;
          const itemSpacing = 5.6 * scale;

          activeLayers.forEach(function (item) {
            if (item.type === "point") {
              doc.setFillColor(item.fill[0], item.fill[1], item.fill[2]);
              doc.setDrawColor(item.stroke[0], item.stroke[1], item.stroke[2]);
              doc.circle(legX + 5.5 * scale, itemY - 1.0 * scale, 1.8 * scale, "FD");
            } else if (item.type === "polygon") {
              doc.setFillColor(item.fill[0], item.fill[1], item.fill[2]);
              doc.setDrawColor(item.stroke[0], item.stroke[1], item.stroke[2]);
              doc.setLineWidth(0.4 * Math.sqrt(scale));
              doc.rect(legX + 3.8 * scale, itemY - 2.6 * scale, 3.4 * scale, 3.2 * scale, "FD");
            } else if (item.type === "polygon_dashed") {
              doc.setFillColor(item.fill[0], item.fill[1], item.fill[2]);
              doc.setDrawColor(item.stroke[0], item.stroke[1], item.stroke[2]);
              doc.setLineWidth(0.4 * Math.sqrt(scale));
              doc.rect(legX + 3.8 * scale, itemY - 2.6 * scale, 3.4 * scale, 3.2 * scale, "FD");
            }
            doc.text(item.label, legX + 9.5 * scale, itemY);
            itemY += itemSpacing;
          });
        }
      }

      // 7. Technical Seal Box (Carimbo / Selo ABNT no Rodapé)
      if (footerH > 0) {
        const sealY = mapTopY + availMapH + 3 * Math.sqrt(scale);
        doc.setFillColor(255, 253, 245);
        doc.setDrawColor(45, 106, 79);
        doc.setLineWidth(0.6 * Math.sqrt(scale));
        doc.roundedRect(frameX, sealY, frameW, footerH, 2 * scale, 2 * scale, "FD");

        const colW = frameW / 4;

        // Divider lines
        doc.setDrawColor(200, 210, 200);
        doc.setLineWidth(0.4 * Math.sqrt(scale));
        for (let i = 1; i <= 3; i++) {
          doc.line(frameX + colW * i, sealY + 2 * scale, frameX + colW * i, sealY + footerH - 2 * scale);
        }

        // Col 1: Project info
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5 * scale);
        doc.setTextColor(27, 67, 50);
        doc.text("PROJETO & LOCALIDADE", frameX + 4 * scale, sealY + 5.2 * scale);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.6 * scale);
        doc.setTextColor(55, 65, 81);
        doc.text("Plano Comunitário de Redução de Riscos (PCRA)", frameX + 4 * scale, sealY + 10.0 * scale);
        doc.text("Bairro Parque Burnier · Juiz de Fora / MG", frameX + 4 * scale, sealY + 14.8 * scale);

        // Col 2: Geodetic Datum & Projection
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5 * scale);
        doc.setTextColor(27, 67, 50);
        doc.text("SISTEMA DE REFERÊNCIA", frameX + colW + 4 * scale, sealY + 5.2 * scale);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.6 * scale);
        doc.setTextColor(55, 65, 81);
        doc.text("Datum: SIRGAS 2000 / WGS 84 (EPSG:4326)", frameX + colW + 4 * scale, sealY + 10.0 * scale);
        doc.text("Projeção Universal Transversa de Mercator (UTM)", frameX + colW + 4 * scale, sealY + 14.8 * scale);

        // Col 3: Format & Date
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5 * scale);
        doc.setTextColor(27, 67, 50);
        doc.text("FORMATO & EMISSÃO", frameX + colW * 2 + 4 * scale, sealY + 5.2 * scale);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.6 * scale);
        doc.setTextColor(55, 65, 81);
        doc.text("Prancha: " + selectedPdfFormat + " (" + (selectedPdfOrientation === "landscape" ? "Paisagem" : "Retrato") + ")", frameX + colW * 2 + 4 * scale, sealY + 10.0 * scale);
        doc.text("Data: " + new Date().toLocaleDateString("pt-BR") + " · Vistorias: " + filteredRecords.length, frameX + colW * 2 + 4 * scale, sealY + 14.8 * scale);

        // Col 4: Authorship & Signature
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5 * scale);
        doc.setTextColor(27, 67, 50);
        doc.text("DESENVOLVIMENTO & SIG", frameX + colW * 3 + 4 * scale, sealY + 5.2 * scale);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.0 * scale);
        doc.setTextColor(45, 106, 79);
        doc.text("Rebeca Diniz Moura", frameX + colW * 3 + 4 * scale, sealY + 10.0 * scale);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.4 * scale);
        doc.setTextColor(107, 114, 128);
        doc.text("GeoDeveloper · Geotecnologia & PCRA", frameX + colW * 3 + 4 * scale, sealY + 14.8 * scale);
      }

      // 8. Save PDF File
      const pdfFileName = "PCRA_Parque_Burnier_Mapa_" + selectedPdfFormat + "_" + selectedPdfOrientation + "_" + new Date().toISOString().slice(0, 10) + ".pdf";
      doc.save(pdfFileName);

      if (els.pdfMapModal) els.pdfMapModal.classList.remove("open");
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Erro ao gerar prancha em PDF: " + err.message);
    } finally {
      if (els.pdfProgressBox) els.pdfProgressBox.style.display = "none";
      if (els.generatePdfSubmitBtn) els.generatePdfSubmitBtn.disabled = false;
      if (els.pdfBtnText) els.pdfBtnText.textContent = "Gerar e Salvar Mapa em PDF";
    }
  }

  function setupEventListeners() {
    els.syncBtn.addEventListener("click", syncData);
    els.searchInput.addEventListener("input", function (e) {
      searchQuery = e.target.value.trim();
      els.clearSearchBtn.style.display = searchQuery ? "block" : "none";
      applyFilters();
    });
    els.clearSearchBtn.addEventListener("click", function () {
      els.searchInput.value = "";
      searchQuery = "";
      els.clearSearchBtn.style.display = "none";
      applyFilters();
    });
    els.metricSelect.addEventListener("change", function (e) {
      currentMetric = e.target.value;
      applyFilters();
    });
    els.riskSelect.addEventListener("change", function (e) {
      currentRiskFilter = e.target.value;
      applyFilters();
    });
    els.agentSelect.addEventListener("change", function (e) {
      currentAgentFilter = e.target.value;
      applyFilters();
    });
    els.dateSelect.addEventListener("change", function (e) {
      currentDateFilter = e.target.value;
      applyFilters();
    });
    els.chipBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const filterKey = btn.dataset.filter;
        quickFilters[filterKey] = !quickFilters[filterKey];
        btn.classList.toggle("active", quickFilters[filterKey]);
        applyFilters();
      });
    });
    els.tabBtns.forEach(function (btn) {
      btn.addEventListener("click", function () { switchTab(btn.dataset.tab); });
    });
    els.basemapBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const key = btn.dataset.basemap;
        if (basemaps[key]) {
          map.removeLayer(activeBasemapLayer);
          activeBasemapLayer = basemaps[key].addTo(map);
          if (activeBasemapLayer.eachLayer) {
            const sublayers = activeBasemapLayer.getLayers();
            if (sublayers.length >= 2) {
              if (sublayers[0].bringToBack) sublayers[0].bringToBack();
              if (sublayers[1].bringToFront) sublayers[1].bringToFront();
            } else if (activeBasemapLayer.bringToBack) {
              activeBasemapLayer.bringToBack();
            }
          } else if (activeBasemapLayer.bringToBack) {
            activeBasemapLayer.bringToBack();
          }
          els.basemapBtns.forEach(function(b) { b.classList.toggle("active", b === btn); });
        }
      });
    });
    els.layerCheckboxes.forEach(function (chk) {
      chk.addEventListener("change", function () {
        const key = chk.dataset.layer;
        const layer = overlayLayers[key];
        if (layer) {
          if (chk.checked) map.addLayer(layer);
          else map.removeLayer(layer);
        }
      });
    });

    // Ortofoto Overlay Checkbox & Slider Event Listeners
    if (els.toggleOrtofotoOverlayChk) {
      els.toggleOrtofotoOverlayChk.addEventListener("change", function () {
        if (els.ortofotoOpacityControl) {
          els.ortofotoOpacityControl.style.display = this.checked ? "flex" : "none";
        }
      });
    }
    if (els.ortofotoOpacitySlider) {
      els.ortofotoOpacitySlider.addEventListener("input", function (e) {
        const val = parseInt(e.target.value, 10);
        const opacity = val / 100;
        if (els.ortofotoOpacityLabel) {
          els.ortofotoOpacityLabel.textContent = val + "%";
        }
        if (overlayLayers.ortofoto_overlay) {
          overlayLayers.ortofoto_overlay.setOpacity(opacity);
        }
      });
    }

    // Declividade Overlay Checkbox & Slider Event Listeners
    if (els.toggleDeclividadeOverlayChk) {
      els.toggleDeclividadeOverlayChk.addEventListener("change", function () {
        if (els.declividadeOpacityControl) {
          els.declividadeOpacityControl.style.display = this.checked ? "flex" : "none";
        }
      });
    }
    if (els.declividadeOpacitySlider) {
      els.declividadeOpacitySlider.addEventListener("input", function (e) {
        const val = parseInt(e.target.value, 10);
        const opacity = val / 100;
        if (els.declividadeOpacityLabel) {
          els.declividadeOpacityLabel.textContent = val + "%";
        }
        if (overlayLayers.declividade_overlay) {
          overlayLayers.declividade_overlay.setOpacity(opacity);
        }
      });
    }
    if (els.togglePointsVisibleChk) {
      els.togglePointsVisibleChk.addEventListener("change", function () {
        isPointsVisible = this.checked;
        if (els.toggleClusteringChk) {
          els.toggleClusteringChk.disabled = !isPointsVisible;
        }
        if (els.clusteringLabelWrapper) {
          els.clusteringLabelWrapper.style.opacity = isPointsVisible ? "1" : "0.4";
          els.clusteringLabelWrapper.style.pointerEvents = isPointsVisible ? "auto" : "none";
        }
        renderMapMarkers();
      });
    }
    if (els.toggleClusteringChk) {
      els.toggleClusteringChk.addEventListener("change", function () {
        isClusteringEnabled = this.checked;
        if (isClusteringEnabled) {
          if (map.hasLayer(markersSimpleGroup)) map.removeLayer(markersSimpleGroup);
          if (!map.hasLayer(markersCluster)) map.addLayer(markersCluster);
        } else {
          if (map.hasLayer(markersCluster)) map.removeLayer(markersCluster);
          if (!map.hasLayer(markersSimpleGroup)) map.addLayer(markersSimpleGroup);
        }
        renderMapMarkers();
      });
    }
    els.themeToggle.addEventListener("click", function () {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      document.documentElement.setAttribute("data-theme", isDark ? "light" : "dark");
    });
    if (els.zoomInBtn) els.zoomInBtn.addEventListener("click", function () { zoomBy(1.3); });
    if (els.zoomOutBtn) els.zoomOutBtn.addEventListener("click", function () { zoomBy(0.75); });
    if (els.zoomResetBtn) els.zoomResetBtn.addEventListener("click", resetViewer);
    if (els.rotateBtn) els.rotateBtn.addEventListener("click", function () { rotateBy(90); });

    if (els.modalViewport) {
      els.modalViewport.addEventListener("wheel", function (e) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        zoomBy(factor);
      }, { passive: false });

      els.modalViewport.addEventListener("mousedown", function (e) {
        if (e.target === els.modalCloseBtn || (e.target.closest && e.target.closest(".modal-toolbar-actions"))) return;
        viewerState.isDragging = true;
        viewerState.startX = e.clientX - viewerState.posX;
        viewerState.startY = e.clientY - viewerState.posY;
      });

      window.addEventListener("mousemove", function (e) {
        if (!viewerState.isDragging) return;
        viewerState.posX = e.clientX - viewerState.startX;
        viewerState.posY = e.clientY - viewerState.startY;
        updateViewerTransform();
      });

      window.addEventListener("mouseup", function () {
        viewerState.isDragging = false;
      });

      els.modalViewport.addEventListener("dblclick", function () {
        if (viewerState.scale > 1.2) resetViewer();
        else zoomBy(2.2);
      });
    }

    window.addEventListener("keydown", function (e) {
      if (!els.photoModal || !els.photoModal.classList.contains("open")) return;
      if (e.key === "Escape") els.photoModal.classList.remove("open");
      if (e.key === "+" || e.key === "=") zoomBy(1.3);
      if (e.key === "-") zoomBy(0.75);
      if (e.key === "0") resetViewer();
      if (e.key === "r" || e.key === "R") rotateBy(90);
    });

    els.modalCloseBtn.addEventListener("click", function () { els.photoModal.classList.remove("open"); });
    els.photoModal.addEventListener("click", function (e) {
      if (e.target === els.photoModal) els.photoModal.classList.remove("open");
    });
    
    // Export Modal Controls
    els.exportBtn.addEventListener("click", function () { els.exportModal.classList.add("open"); });
    els.exportCloseBtn.addEventListener("click", function () { els.exportModal.classList.remove("open"); });
    els.exportModal.addEventListener("click", function (e) {
      if (e.target === els.exportModal) els.exportModal.classList.remove("open");
    });
    
    // Export Modal Tabs
    els.exportTabBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const target = btn.dataset.target;
        els.exportTabBtns.forEach(function (b) { b.classList.toggle("active", b === btn); });
        els.exportTabContents.forEach(function (c) { c.classList.toggle("active", c.id === target); });
      });
    });

    // Global Event Delegation for all Layer Download Buttons (100% fail-proof)
    document.addEventListener("click", function (e) {
      const dlBtn = e.target.closest(".btn-dl-fmt");
      if (dlBtn) {
        e.preventDefault();
        e.stopPropagation();
        const layerKey = dlBtn.getAttribute("data-dl-layer") || dlBtn.dataset.dlLayer;
        const fmt = dlBtn.getAttribute("data-dl-fmt") || dlBtn.dataset.dlFmt;
        downloadLayerData(layerKey, fmt, dlBtn);
        return;
      }
      
      const zipBtn = e.target.closest("#download-all-zip-btn");
      if (zipBtn) {
        e.preventDefault();
        e.stopPropagation();
        downloadAllLayersAsZip(zipBtn);
        return;
      }
    });

    // Survey Export Options in Tab 1
    if (els.exportGeojsonBtn) {
      els.exportGeojsonBtn.addEventListener("click", function () {
        downloadLayerData("vistorias_campo", "geojson", els.exportGeojsonBtn);
        els.exportModal.classList.remove("open");
      });
    }
    if (els.exportCsvBtn) {
      els.exportCsvBtn.addEventListener("click", function () {
        downloadLayerData("vistorias_campo", "csv", els.exportCsvBtn);
        els.exportModal.classList.remove("open");
      });
    }
    if (els.exportKmlSurveyBtn) {
      els.exportKmlSurveyBtn.addEventListener("click", function () {
        downloadLayerData("vistorias_campo", "kml", els.exportKmlSurveyBtn);
        els.exportModal.classList.remove("open");
      });
    }
    els.printReportBtn.addEventListener("click", function () { window.print(); });

    // PDF Map Generator Modal Controls
    if (els.openPdfMapBtn) {
      els.openPdfMapBtn.addEventListener("click", function () {
        if (els.pdfMapModal) els.pdfMapModal.classList.add("open");
      });
    }
    if (els.pdfMapCloseBtn) {
      els.pdfMapCloseBtn.addEventListener("click", function () {
        if (els.pdfMapModal) els.pdfMapModal.classList.remove("open");
      });
    }
    if (els.pdfMapModal) {
      els.pdfMapModal.addEventListener("click", function (e) {
        if (e.target === els.pdfMapModal) els.pdfMapModal.classList.remove("open");
      });
    }

    // Format & Orientation Pills
    els.formatPillBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectedPdfFormat = btn.dataset.format;
        els.formatPillBtns.forEach(function (b) { b.classList.toggle("active", b === btn); });
      });
    });
    els.orientationPillBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectedPdfOrientation = btn.dataset.orientation;
        els.orientationPillBtns.forEach(function (b) { b.classList.toggle("active", b === btn); });
      });
    });

    // Generate PDF Button
    if (els.generatePdfSubmitBtn) {
      els.generatePdfSubmitBtn.addEventListener("click", generateCartographicPDF);
    }

    // Setup User Layer Import (Opção 3)
    setupUserImportFeature();

    window.addEventListener("resize", function () {
      map.invalidateSize();
    });

    setInterval(function () {
      if (document.visibilityState === "visible") syncData();
    }, 60000);
  }

  const userImportedLayers = {};
  let pendingImportData = null;
  let selectedImportColor = "#0284c7";

  function parseKMLToGeoJSON(kmlText) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, "text/xml");
    const placemarks = xml.querySelectorAll("Placemark");
    const features = [];

    placemarks.forEach(function (pm, idx) {
      const props = {};
      const nameEl = pm.querySelector("name");
      if (nameEl) props.name = nameEl.textContent.trim();
      const descEl = pm.querySelector("description");
      if (descEl) props.description = descEl.textContent.trim();

      pm.querySelectorAll("Data, SimpleData").forEach(function (d) {
        const key = d.getAttribute("name") || d.getAttribute("key");
        const valEl = d.querySelector("value");
        const val = valEl ? valEl.textContent.trim() : d.textContent.trim();
        if (key) props[key] = val;
      });

      // Point
      const pointEl = pm.querySelector("Point coordinates");
      if (pointEl) {
        const parts = pointEl.textContent.trim().split(/[\s,]+/);
        if (parts.length >= 2) {
          const lon = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);
          if (!isNaN(lon) && !isNaN(lat) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            features.push({
              type: "Feature",
              id: idx + 1,
              properties: props,
              geometry: { type: "Point", coordinates: [lon, lat] }
            });
            return;
          }
        }
      }

      // LineString
      const lineEl = pm.querySelector("LineString coordinates");
      if (lineEl) {
        const coords = lineEl.textContent.trim().split(/\s+/).map(function (pair) {
          const p = pair.split(",").map(Number);
          return [p[0], p[1]];
        }).filter(function (c) { return !isNaN(c[0]) && !isNaN(c[1]); });
        if (coords.length > 0) {
          features.push({
            type: "Feature",
            id: idx + 1,
            properties: props,
            geometry: { type: "LineString", coordinates: coords }
          });
          return;
        }
      }

      // Polygon
      const polyEl = pm.querySelector("Polygon coordinates");
      if (polyEl) {
        const coords = polyEl.textContent.trim().split(/\s+/).map(function (pair) {
          const p = pair.split(",").map(Number);
          return [p[0], p[1]];
        }).filter(function (c) { return !isNaN(c[0]) && !isNaN(c[1]); });
        if (coords.length > 0) {
          features.push({
            type: "Feature",
            id: idx + 1,
            properties: props,
            geometry: { type: "Polygon", coordinates: [coords] }
          });
          return;
        }
      }
    });

    return { type: "FeatureCollection", features: features };
  }

  function parseCSVToGeoJSON(csvText) {
    if (typeof Papa === "undefined") {
      throw new Error("Biblioteca PapaParse não disponível.");
    }
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    if (!parsed.data || parsed.data.length === 0) {
      throw new Error("Arquivo CSV vazio ou sem linhas de dados.");
    }
    const headers = Object.keys(parsed.data[0]);
    let latKey = headers.find(function (h) {
      const norm = h.toLowerCase().trim();
      return norm === "latitude" || norm === "lat" || norm === "y" || norm === "coord_y" || norm === "latitude_decimal" || norm === "lat_y";
    });
    let lonKey = headers.find(function (h) {
      const norm = h.toLowerCase().trim();
      return norm === "longitude" || norm === "long" || norm === "lon" || norm === "lng" || norm === "x" || norm === "coord_x" || norm === "longitude_decimal" || norm === "long_x";
    });

    if (!latKey || !lonKey) {
      throw new Error("Colunas de Latitude e Longitude não identificadas no CSV. Certifique-se de que existem colunas como 'latitude' e 'longitude' ou 'lat' e 'lng'.");
    }

    const features = [];
    parsed.data.forEach(function (row, idx) {
      const latStr = String(row[latKey] || "").replace(",", ".").trim();
      const lonStr = String(row[lonKey] || "").replace(",", ".").trim();
      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        features.push({
          type: "Feature",
          id: idx + 1,
          properties: Object.assign({}, row),
          geometry: { type: "Point", coordinates: [lon, lat] }
        });
      }
    });

    return { type: "FeatureCollection", features: features };
  }

  function parseGeoJSONText(jsonText) {
    const obj = JSON.parse(jsonText);
    if (obj.type === "FeatureCollection" && Array.isArray(obj.features)) {
      return obj;
    }
    if (obj.type === "Feature") {
      return { type: "FeatureCollection", features: [obj] };
    }
    if (Array.isArray(obj)) {
      return { type: "FeatureCollection", features: obj };
    }
    throw new Error("Formato GeoJSON não reconhecido.");
  }

  function setupUserImportFeature() {
    if (!els.importLayerModal) return;

    function openImportModal() {
      pendingImportData = null;
      if (els.importFileInput) els.importFileInput.value = "";
      if (els.importConfigPanel) els.importConfigPanel.style.display = "none";
      if (els.importStatusMsg) {
        els.importStatusMsg.style.display = "none";
        els.importStatusMsg.textContent = "";
      }
      if (els.importConfirmBtn) els.importConfirmBtn.disabled = true;
      els.importLayerModal.classList.add("open");
    }

    function closeImportModal() {
      els.importLayerModal.classList.remove("open");
    }

    if (els.importLayerBtn) els.importLayerBtn.addEventListener("click", openImportModal);
    if (els.quickImportBtn) els.quickImportBtn.addEventListener("click", openImportModal);
    if (els.importLayerCloseBtn) els.importLayerCloseBtn.addEventListener("click", closeImportModal);
    if (els.importCancelBtn) els.importCancelBtn.addEventListener("click", closeImportModal);

    // Global document delegation fallback for import buttons
    document.addEventListener("click", function (e) {
      if (e.target.closest("#import-layer-btn") || e.target.closest("#quick-import-btn")) {
        e.preventDefault();
        openImportModal();
      } else if (e.target.closest("#import-layer-close-btn") || e.target.closest("#import-cancel-btn")) {
        e.preventDefault();
        closeImportModal();
      }
    });

    els.importLayerModal.addEventListener("click", function (e) {
      if (e.target === els.importLayerModal) closeImportModal();
    });

    // Dropzone events
    if (els.importDropzone) {
      els.importDropzone.addEventListener("click", function () {
        if (els.importFileInput) els.importFileInput.click();
      });

      ["dragenter", "dragover"].forEach(function (evt) {
        els.importDropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          els.importDropzone.classList.add("dragover");
        });
      });

      ["dragleave", "drop"].forEach(function (evt) {
        els.importDropzone.addEventListener(evt, function (e) {
          e.preventDefault();
          e.stopPropagation();
          els.importDropzone.classList.remove("dragover");
        });
      });

      els.importDropzone.addEventListener("drop", function (e) {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) handleSelectedFile(files[0]);
      });
    }

    if (els.importFileInput) {
      els.importFileInput.addEventListener("change", function () {
        if (els.importFileInput.files && els.importFileInput.files.length > 0) {
          handleSelectedFile(els.importFileInput.files[0]);
        }
      });
    }

    function showStatus(msg, isError) {
      if (!els.importStatusMsg) return;
      els.importStatusMsg.style.display = "block";
      els.importStatusMsg.style.background = isError ? "#fee2e2" : "#dcfce7";
      els.importStatusMsg.style.color = isError ? "#991b1b" : "#166534";
      els.importStatusMsg.style.border = "1px solid " + (isError ? "#f87171" : "#86efac");
      els.importStatusMsg.textContent = msg;
    }

    function handleSelectedFile(file) {
      if (!file) return;
      const fname = file.name;
      const ext = fname.split(".").pop().toLowerCase();
      const defaultName = fname.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

      const reader = new FileReader();
      reader.onload = function (e) {
        const text = e.target.result;
        try {
          let geojson = null;
          if (ext === "geojson" || ext === "json") {
            geojson = parseGeoJSONText(text);
          } else if (ext === "kml") {
            geojson = parseKMLToGeoJSON(text);
          } else if (ext === "csv") {
            geojson = parseCSVToGeoJSON(text);
          } else {
            throw new Error("Formato não suportado: ." + ext + ". Utilize .geojson, .kml ou .csv");
          }

          if (!geojson || !geojson.features || geojson.features.length === 0) {
            throw new Error("Nenhuma feição geográfica encontrada no arquivo selecionado.");
          }

          pendingImportData = {
            filename: fname,
            defaultName: defaultName,
            geojson: geojson
          };

          if (els.importLayerName) els.importLayerName.value = defaultName;
          if (els.importSummaryFilename) els.importSummaryFilename.textContent = fname;
          if (els.importSummaryCount) els.importSummaryCount.textContent = geojson.features.length + " feições carregadas";
          if (els.importConfigPanel) els.importConfigPanel.style.display = "block";
          if (els.importStatusMsg) els.importStatusMsg.style.display = "none";
          if (els.importConfirmBtn) els.importConfirmBtn.disabled = false;

        } catch (err) {
          console.error("File parsing error:", err);
          showStatus("Erro ao processar arquivo: " + err.message, true);
          if (els.importConfigPanel) els.importConfigPanel.style.display = "none";
          if (els.importConfirmBtn) els.importConfirmBtn.disabled = true;
        }
      };

      reader.onerror = function () {
        showStatus("Erro na leitura do arquivo pelo navegador.", true);
      };

      reader.readAsText(file, "UTF-8");
    }

    // Color picker
    if (els.importColorDotBtns) {
      els.importColorDotBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
          selectedImportColor = btn.dataset.color;
          els.importColorDotBtns.forEach(function (b) {
            b.classList.toggle("active", b === btn);
            b.style.boxShadow = b === btn ? "0 0 0 2px " + selectedImportColor : "0 0 0 1px #cbd5e1";
          });
          if (els.importCustomColor) els.importCustomColor.value = selectedImportColor;
        });
      });
    }

    if (els.importCustomColor) {
      els.importCustomColor.addEventListener("input", function (e) {
        selectedImportColor = e.target.value;
        if (els.importColorDotBtns) {
          els.importColorDotBtns.forEach(function (b) {
            b.classList.remove("active");
            b.style.boxShadow = "0 0 0 1px #cbd5e1";
          });
        }
      });
    }

    // Confirm button
    if (els.importConfirmBtn) {
      els.importConfirmBtn.addEventListener("click", function () {
        if (!pendingImportData) return;

        const layerName = (els.importLayerName && els.importLayerName.value.trim()) || pendingImportData.defaultName || "Camada Importada";
        const layerColor = selectedImportColor || "#0284c7";
        const layerId = "usr_layer_" + Date.now();

        // Create Leaflet layer
        const leafletLayer = L.geoJSON(pendingImportData.geojson, {
          pointToLayer: function (feat, latlng) {
            return L.circleMarker(latlng, {
              radius: 7,
              fillColor: layerColor,
              color: "#ffffff",
              weight: 2,
              opacity: 1,
              fillOpacity: 0.85
            });
          },
          style: function (feat) {
            return {
              color: layerColor,
              weight: 2.5,
              opacity: 0.9,
              fillColor: layerColor,
              fillOpacity: 0.35
            };
          },
          onEachFeature: function (feat, layer) {
            const props = feat.properties || {};
            let html = "<div class='popup-custom-card'>" +
              "<div style='font-size:0.7rem;font-weight:700;color:var(--forest-dark);margin-bottom:4px;'>" +
                "<span style='background:" + layerColor + ";color:#fff;font-size:0.68rem;font-weight:700;padding:2px 6px;border-radius:99px;'>" + layerName + "</span>" +
              "</div>";
            
            if (props.name || props.nome || props.Nome) {
              html += "<div class='popup-custom-header'>" + (props.name || props.nome || props.Nome) + "</div>";
            }
            
            html += "<div style='max-height:160px;overflow-y:auto;font-size:0.74rem;color:var(--text-main);margin-top:6px;line-height:1.4;'>";
            let countProps = 0;
            for (let k in props) {
              if (k !== "name" && k !== "nome" && k !== "Nome") {
                html += "<strong>" + k + ":</strong> " + props[k] + "<br>";
                countProps++;
                if (countProps >= 8) break;
              }
            }
            if (countProps === 0 && (props.name || props.nome || props.Nome)) {
              html += "<em>Sem atributos adicionais</em>";
            }
            html += "</div></div>";
            layer.bindPopup(html, { maxWidth: 280 });
          }
        }).addTo(map);

        userImportedLayers[layerId] = {
          id: layerId,
          name: layerName,
          color: layerColor,
          layer: leafletLayer,
          count: pendingImportData.geojson.features.length,
          data: pendingImportData.geojson
        };

        renderUserImportedList();

        try {
          const bounds = leafletLayer.getBounds();
          if (bounds && bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
          }
        } catch (e) {
          console.warn("Could not fit bounds to user layer:", e);
        }

        closeImportModal();
      });
    }

    function renderUserImportedList() {
      if (!els.userImportedLayersList || !els.userImportedSection) return;
      const keys = Object.keys(userImportedLayers);
      if (keys.length === 0) {
        els.userImportedSection.style.display = "none";
        els.userImportedLayersList.innerHTML = "";
        return;
      }

      els.userImportedSection.style.display = "block";
      let html = "";
      keys.forEach(function (k) {
        const item = userImportedLayers[k];
        html += "<div class='user-layer-item' id='item-" + k + "'>" +
          "<div class='user-layer-info'>" +
            "<input type='checkbox' class='user-layer-chk' data-usr-layer='" + k + "' checked> " +
            "<span style='display:inline-block;width:10px;height:10px;border-radius:50%;background:" + item.color + ";flex-shrink:0;'></span>" +
            "<span title='" + item.name + " (" + item.count + ")'>" + item.name + " <small style='color:var(--muted);'>(" + item.count + ")</small></span>" +
          "</div>" +
          "<button class='user-layer-del-btn' data-usr-del='" + k + "' title='Remover camada do mapa'>🗑️</button>" +
        "</div>";
      });

      els.userImportedLayersList.innerHTML = html;

      // Event listeners for checkboxes and delete buttons
      els.userImportedLayersList.querySelectorAll(".user-layer-chk").forEach(function (chk) {
        chk.addEventListener("change", function () {
          const id = chk.dataset.usrLayer;
          const item = userImportedLayers[id];
          if (!item) return;
          if (chk.checked) {
            if (!map.hasLayer(item.layer)) map.addLayer(item.layer);
          } else {
            if (map.hasLayer(item.layer)) map.removeLayer(item.layer);
          }
        });
      });

      els.userImportedLayersList.querySelectorAll(".user-layer-del-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          const id = btn.dataset.usrDel;
          const item = userImportedLayers[id];
          if (!item) return;
          if (map.hasLayer(item.layer)) map.removeLayer(item.layer);
          delete userImportedLayers[id];
          renderUserImportedList();
        });
      });
    }
  }

  // =========================================================================
  // Admin Point Edit Mode State & Management (Admin / Georebs)
  // =========================================================================
  function isUserAuthorized(user, pass) {
    if (!user || !pass) return false;
    const cleanUser = String(user).trim().toLowerCase();
    const cleanPass = String(pass).trim();
    const userOk = editModeState.authorizedUsers.some(function (u) {
      return u.toLowerCase() === cleanUser;
    });
    const passOk = (cleanPass === editModeState.adminPassword);
    return userOk && passOk;
  }

  window.confirmPointPosition = function (recordId) {
    if (map) map.closePopup();
    const rec = allRecords.find(function (r) { return r.ID === recordId; });
    if (rec) {
      const toast = document.createElement("div");
      toast.className = "admin-toast-notify";
      toast.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#075c2a;color:#ffffff;padding:8px 16px;border-radius:8px;font-size:0.80rem;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:9999;transition:opacity 0.3s ease;";
      toast.textContent = "✓ Ponto " + String(rec.PontoNum).padStart(2, '0') + " (" + rec.Nome + ") calibrado com sucesso!";
      document.body.appendChild(toast);
      setTimeout(function () {
        toast.style.opacity = "0";
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
      }, 2500);
    }
  };

  function toggleEditMode(enable) {
    editModeState.isActive = enable;
    const btn = document.getElementById("admin-edit-points-btn");
    const banner = document.getElementById("admin-edit-mode-banner");
    const label = document.getElementById("admin-edit-points-btn-label");

    if (enable) {
      if (btn) btn.classList.add("active");
      if (label) label.textContent = "Edição Ativa";
      if (banner) banner.style.display = "flex";
      // Temporarily disable clustering so all individual markers are directly accessible & draggable
      isClusteringEnabled = false;
      const chk = document.getElementById("toggle-clustering-chk");
      if (chk) chk.checked = false;
    } else {
      if (btn) btn.classList.remove("active");
      if (label) label.textContent = "Ajustar Pontos";
      if (banner) banner.style.display = "none";
    }

    updateAdjustedUI();
    renderMapMarkers();
    renderPointsList();
  }

  function updateAdjustedUI() {
    const count = Object.keys(editModeState.adjustedCoords).length;
    const badge = document.getElementById("admin-adjusted-count-badge");
    if (badge) {
      badge.textContent = count + (count === 1 ? " ponto ajustado" : " pontos ajustados");
    }
  }

  window.revertPointPosition = function (recordId) {
    const rec = allRecords.find(function (r) { return r.ID === recordId; });
    if (!rec) return;
    if (typeof rec.OrigLatitude === "number" && typeof rec.OrigLongitude === "number") {
      rec.Latitude = rec.OrigLatitude;
      rec.Longitude = rec.OrigLongitude;
    }
    rec.CoordenadaAjustada = false;
    rec.DistanciaAjustada = 0;
    delete editModeState.adjustedCoords[recordId];
    try {
      localStorage.setItem("pcra_adjusted_coords_v1", JSON.stringify(editModeState.adjustedCoords));
    } catch (e) {}

    updateAdjustedUI();
    renderMapMarkers();
    renderPointsList();
    if (selectedRecordId === recordId) {
      renderDetailsTab(rec);
    }
    if (map) map.closePopup();
  };

  function resetAllAdjustedPoints() {
    const count = Object.keys(editModeState.adjustedCoords).length;
    if (count === 0) {
      alert("Nenhum ponto foi ajustado até o momento.");
      return;
    }
    if (confirm("Tem certeza que deseja restaurar as coordenadas GPS originais de TODOS os " + count + " pontos ajustados?")) {
      allRecords.forEach(function (rec) {
        if (rec.CoordenadaAjustada) {
          if (typeof rec.OrigLatitude === "number" && typeof rec.OrigLongitude === "number") {
            rec.Latitude = rec.OrigLatitude;
            rec.Longitude = rec.OrigLongitude;
          }
          rec.CoordenadaAjustada = false;
          rec.DistanciaAjustada = 0;
        }
      });
      editModeState.adjustedCoords = {};
      try {
        localStorage.removeItem("pcra_adjusted_coords_v1");
      } catch (e) {}
      updateAdjustedUI();
      renderMapMarkers();
      renderPointsList();
      if (selectedRecordId) {
        const sel = allRecords.find(function (r) { return r.ID === selectedRecordId; });
        if (sel) renderDetailsTab(sel);
      }
      alert("Todas as coordenadas foram restauradas para os valores originais do levantamento de campo.");
    }
  }

  function openAdjustedSummaryModal() {
    const modal = document.getElementById("admin-adjusted-summary-modal");
    const wrapper = document.getElementById("admin-adjusted-points-table-wrapper");
    if (!modal || !wrapper) return;

    const adjustedIds = Object.keys(editModeState.adjustedCoords);
    if (adjustedIds.length === 0) {
      wrapper.innerHTML = "<div style='padding:24px;text-align:center;color:var(--text-muted);font-size:0.85rem;'>Nenhum ponto de campo foi ajustado ainda.<br>No Modo Edição, clique e arraste qualquer marcador no mapa para calibrar sua localização.</div>";
    } else {
      let tableHtml = "<table class='adjusted-table'>" +
        "<thead><tr>" +
          "<th>Ponto</th>" +
          "<th>Morador</th>" +
          "<th>Endereço</th>" +
          "<th>Coord. Ajustada</th>" +
          "<th>Coord. Original</th>" +
          "<th>Deslocamento</th>" +
          "<th>Ação</th>" +
        "</tr></thead><tbody>";

      adjustedIds.forEach(function (id) {
        const item = editModeState.adjustedCoords[id];
        tableHtml += "<tr>" +
          "<td><strong style='color:var(--primary);'>#" + String(item.pontoNum).padStart(2, '0') + "</strong></td>" +
          "<td>" + (item.nome || "—") + "</td>" +
          "<td style='font-size:0.72rem;'>" + (item.endereco || "—") + "</td>" +
          "<td style='font-family:monospace;font-size:0.72rem;'>" + item.lat.toFixed(6) + ", " + item.lng.toFixed(6) + "</td>" +
          "<td style='font-family:monospace;font-size:0.70rem;color:var(--text-muted);'>" + (typeof item.origLat === "number" ? item.origLat.toFixed(6) + ", " + item.origLng.toFixed(6) : "—") + "</td>" +
          "<td><span style='font-weight:700;color:#b45309;'>" + item.distMeters + " m</span></td>" +
          "<td><button class='btn btn-secondary' style='padding:2px 6px;font-size:0.68rem;' onclick='window.revertPointPosition(\"" + id + "\")'>↺ Reverter</button></td>" +
        "</tr>";
      });

      tableHtml += "</tbody></table>";
      wrapper.innerHTML = tableHtml;
    }

    modal.classList.add("open");
  }

  function exportAdjustedGeoJSON() {
    const adjustedIds = Object.keys(editModeState.adjustedCoords);
    if (adjustedIds.length === 0) {
      alert("Nenhum ponto ajustado para exportar.");
      return;
    }
    const features = adjustedIds.map(function (id) {
      const item = editModeState.adjustedCoords[id];
      const rec = allRecords.find(function (r) { return r.ID === id; });
      const props = rec ? Object.assign({}, rec.Raw || {}) : {};
      props.latitude_ajustada = item.lat;
      props.longitude_ajustada = item.lng;
      props.latitude_original = item.origLat;
      props.longitude_original = item.origLng;
      props.deslocamento_metros = item.distMeters;
      props.data_ajuste_admin = item.timestamp;
      props.ajustado_por = "Administrador PCRA";

      return {
        type: "Feature",
        properties: props,
        geometry: {
          type: "Point",
          coordinates: [item.lng, item.lat]
        }
      };
    });

    const geojson = {
      type: "FeatureCollection",
      name: "PCRA_Pontos_Campo_Ajustados",
      crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
      features: features
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "PCRA_Pontos_Ajustados_" + new Date().toISOString().slice(0, 10) + ".geojson";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportAdjustedCSV() {
    const adjustedIds = Object.keys(editModeState.adjustedCoords);
    if (adjustedIds.length === 0) {
      alert("Nenhum ponto ajustado para exportar.");
      return;
    }
    const rows = [
      ["ID", "Ponto", "Nome", "Endereco", "Responsavel", "Nova_Latitude", "Nova_Longitude", "Latitude_Original", "Longitude_Original", "Deslocamento_Metros", "Data_Ajuste"]
    ];

    adjustedIds.forEach(function (id) {
      const item = editModeState.adjustedCoords[id];
      rows.push([
        id,
        item.pontoNum,
        '"' + (item.nome || "").replace(/"/g, '""') + '"',
        '"' + (item.endereco || "").replace(/"/g, '""') + '"',
        '"' + (item.responsavel || "").replace(/"/g, '""') + '"',
        item.lat.toFixed(6),
        item.lng.toFixed(6),
        item.origLat ? item.origLat.toFixed(6) : "",
        item.origLng ? item.origLng.toFixed(6) : "",
        item.distMeters,
        item.timestamp
      ]);
    });

    const csvContent = "\uFEFF" + rows.map(function (r) { return r.join(";"); }).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "PCRA_Tabela_Pontos_Ajustados_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportAdjustedJS() {
    const adjustedIds = Object.keys(editModeState.adjustedCoords);
    if (adjustedIds.length === 0) {
      alert("Nenhum ponto ajustado para exportar.");
      return;
    }
    const jsContent = "/**\n * PCRA - Coordenadas Globais Calibradas\n * Sincronizacao entre multiplos dispositivos e navegadores.\n * Atualizado em: " + new Date().toISOString() + "\n */\nwindow.PCRA_GLOBAL_ADJUSTMENTS = " + JSON.stringify(editModeState.adjustedCoords, null, 2) + ";\n";
    const blob = new Blob([jsContent], { type: "application/javascript;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "adjusted_coords_data.js";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyAdjustedCoordinatesTable() {
    const adjustedIds = Object.keys(editModeState.adjustedCoords);
    if (adjustedIds.length === 0) {
      alert("Nenhum ponto ajustado para copiar.");
      return;
    }
    let text = "ID\tPonto\tNome\tEndereço\tNova_Latitude\tNova_Longitude\tDeslocamento_m\n";
    adjustedIds.forEach(function (id) {
      const item = editModeState.adjustedCoords[id];
      text += id + "\t" + item.pontoNum + "\t" + item.nome + "\t" + item.endereco + "\t" + item.lat.toFixed(6) + "\t" + item.lng.toFixed(6) + "\t" + item.distMeters + "m\n";
    });

    navigator.clipboard.writeText(text).then(function () {
      const btnSpan = document.getElementById("admin-copy-coords-btn-text");
      if (btnSpan) {
        const orig = btnSpan.textContent;
        btnSpan.textContent = "✓ Copiado!";
        setTimeout(function () { btnSpan.textContent = orig; }, 2000);
      }
    }).catch(function () {
      alert("Erro ao copiar para a área de transferência.");
    });
  }

  function setupAdminEditMode() {
    const btnToggle = document.getElementById("admin-edit-points-btn");
    const modalAuth = document.getElementById("admin-auth-modal");
    const btnAuthClose = document.getElementById("admin-auth-close-btn");
    const btnAuthSubmit = document.getElementById("admin-auth-submit-btn");
    const inputAuthUser = document.getElementById("admin-auth-user-input");
    const inputAuthPass = document.getElementById("admin-auth-pass-input");
    const msgAuthError = document.getElementById("admin-auth-error");

    const bannerExportBtn = document.getElementById("admin-export-adjusted-btn");
    const bannerResetAllBtn = document.getElementById("admin-reset-all-adjusted-btn");
    const bannerExitBtn = document.getElementById("admin-exit-edit-btn");

    const modalSummary = document.getElementById("admin-adjusted-summary-modal");
    const btnSummaryClose = document.getElementById("admin-summary-close-btn");
    const btnDownloadGeojson = document.getElementById("admin-download-adjusted-geojson-btn");
    const btnDownloadCsv = document.getElementById("admin-download-adjusted-csv-btn");
    const btnDownloadJs = document.getElementById("admin-download-adjusted-js-btn");
    const btnCopyCoords = document.getElementById("admin-copy-coords-btn");

    function openAuthModal() {
      if (modalAuth) {
        if (msgAuthError) {
          msgAuthError.style.display = "none";
          msgAuthError.textContent = "";
        }
        if (inputAuthPass) inputAuthPass.value = "";
        modalAuth.classList.add("open");
        setTimeout(function () {
          if (inputAuthPass) inputAuthPass.focus();
        }, 150);
      }
    }

    function handleToggleClick(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (editModeState.isActive) {
        toggleEditMode(false);
        return;
      }
      // Check session auth
      if (sessionStorage.getItem("pcra_auth_admin") === "true") {
        toggleEditMode(true);
      } else {
        openAuthModal();
      }
    }

    if (btnToggle) {
      btnToggle.addEventListener("click", handleToggleClick);
    }

    // Document-level fallback delegation for admin toggle button
    document.addEventListener("click", function (e) {
      const toggle = e.target.closest("#admin-edit-points-btn");
      if (toggle) {
        handleToggleClick(e);
        return;
      }
      const closeAuth = e.target.closest("#admin-auth-close-btn");
      if (closeAuth && modalAuth) {
        e.preventDefault();
        modalAuth.classList.remove("open");
        return;
      }
      const closeSummary = e.target.closest("#admin-summary-close-btn");
      if (closeSummary && modalSummary) {
        e.preventDefault();
        modalSummary.classList.remove("open");
        return;
      }
    });

    if (btnAuthClose && modalAuth) {
      btnAuthClose.addEventListener("click", function () { modalAuth.classList.remove("open"); });
      modalAuth.addEventListener("click", function (e) {
        if (e.target === modalAuth) modalAuth.classList.remove("open");
      });
    }

    function handleAuthSubmit(e) {
      if (e) {
        e.preventDefault();
      }
      const user = inputAuthUser ? inputAuthUser.value.trim() : "";
      const pass = inputAuthPass ? inputAuthPass.value.trim() : "";
      if (isUserAuthorized(user, pass)) {
        sessionStorage.setItem("pcra_auth_admin", "true");
        sessionStorage.setItem("pcra_auth_user", user);
        if (modalAuth) modalAuth.classList.remove("open");
        toggleEditMode(true);
      } else {
        if (msgAuthError) {
          msgAuthError.style.display = "block";
          msgAuthError.textContent = "Credenciais incorretas. Usuário: admin / Senha: 951951";
        }
      }
    }

    if (btnAuthSubmit) btnAuthSubmit.addEventListener("click", handleAuthSubmit);
    if (inputAuthUser) {
      inputAuthUser.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          if (inputAuthPass) inputAuthPass.focus();
        }
      });
    }
    if (inputAuthPass) {
      inputAuthPass.addEventListener("keydown", function (e) {
        if (e.key === "Enter") handleAuthSubmit(e);
      });
    }

    if (bannerExportBtn) bannerExportBtn.addEventListener("click", openAdjustedSummaryModal);
    if (bannerResetAllBtn) bannerResetAllBtn.addEventListener("click", resetAllAdjustedPoints);
    if (bannerExitBtn) bannerExitBtn.addEventListener("click", function () { toggleEditMode(false); });

    if (btnSummaryClose && modalSummary) {
      btnSummaryClose.addEventListener("click", function () { modalSummary.classList.remove("open"); });
      modalSummary.addEventListener("click", function (e) {
        if (e.target === modalSummary) modalSummary.classList.remove("open");
      });
    }

    if (btnDownloadGeojson) btnDownloadGeojson.addEventListener("click", exportAdjustedGeoJSON);
    if (btnDownloadCsv) btnDownloadCsv.addEventListener("click", exportAdjustedCSV);
    if (btnDownloadJs) btnDownloadJs.addEventListener("click", exportAdjustedJS);
    if (btnCopyCoords) btnCopyCoords.addEventListener("click", copyAdjustedCoordinatesTable);
  }

  // -------------------------------------------------------------
  // WebGIS Measurement & Annotation Helpers
  // -------------------------------------------------------------
  function computeTotalDistance(pts) {
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      total += pts[i].distanceTo(pts[i + 1]);
    }
    return total;
  }

  function computePolygonArea(pts) {
    if (!pts || pts.length < 3) return 0;
    const radius = 6378137;
    let totalArea = 0;
    const len = pts.length;
    for (let i = 0; i < len; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % len];
      const lat1 = p1.lat * Math.PI / 180;
      const lat2 = p2.lat * Math.PI / 180;
      const lng1 = p1.lng * Math.PI / 180;
      const lng2 = p2.lng * Math.PI / 180;
      totalArea += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    totalArea = Math.abs(totalArea * radius * radius / 2.0);
    return totalArea;
  }

  function formatDistance(meters) {
    if (meters >= 1000) {
      return (meters / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " km";
    }
    return meters.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " m";
  }

  function formatArea(m2) {
    if (m2 >= 10000) {
      const ha = m2 / 10000;
      return m2.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " m² (" + ha.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ha)";
    }
    return m2.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " m²";
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setupWebGISTools() {
    // Add scale bar in metric units
    L.control.scale({ imperial: false, metric: true, position: "bottomleft" }).addTo(map);

    // 1. Measurement State
    const measureState = {
      mode: null,
      points: [],
      markers: [],
      tempLine: null,
      tempPolygon: null,
      layerGroup: L.featureGroup().addTo(map)
    };

      // 2. Drawing & Annotation State
      const drawState = {
        activeTool: null, // "text", "arrow", "polygon", "line"
        selectedColor: "#dc2626", // default red
        points: [],
        tempLayer: null,
        userDrawings: [], // { id, type, layer, label, color, points, area, length }
        layerGroup: L.featureGroup().addTo(map)
      };

      // DOM Elements
      const tabMeasure = document.getElementById("tools-tab-measure");
      const tabDraw = document.getElementById("tools-tab-draw");
      const panelMeasure = document.getElementById("tools-measure-panel");
      const panelDraw = document.getElementById("tools-draw-panel");

      // Measure elements
      const btnMeasureDist = document.getElementById("measure-distance-btn");
      const btnMeasureArea = document.getElementById("measure-area-btn");
      const btnMeasureClear = document.getElementById("measure-clear-btn");
      const btnMeasureFinish = document.getElementById("measure-finish-btn");
      const boxMeasureResult = document.getElementById("measure-result-box");
      const labelMeasureMode = document.getElementById("measure-mode-label");
      const textMeasureInstruction = document.getElementById("measure-instruction");
      const valMeasurePrimary = document.getElementById("measure-primary-val");
      const titleMeasurePrimary = document.getElementById("measure-primary-title");
      const itemMeasureSecondary = document.getElementById("measure-secondary-item");
      const valMeasureSecondary = document.getElementById("measure-secondary-val");

      // Draw elements
      const btnDrawText = document.getElementById("draw-text-btn");
      const btnDrawArrow = document.getElementById("draw-arrow-btn");
      const btnDrawPolygon = document.getElementById("draw-polygon-btn");
      const btnDrawLine = document.getElementById("draw-line-btn");
      const boxDrawActive = document.getElementById("draw-active-box");
      const titleDrawActive = document.getElementById("draw-active-mode-title");
      const textDrawInstruction = document.getElementById("draw-instruction-text");
      const btnDrawFinish = document.getElementById("draw-finish-btn");
      const btnDrawCancel = document.getElementById("draw-cancel-btn");
      const badgeDrawingsCount = document.getElementById("drawings-count-badge");
      const btnDrawUndo = document.getElementById("draw-undo-btn");
      const btnDrawClearAll = document.getElementById("draw-clear-all-btn");
      const btnDrawExportGeoJSON = document.getElementById("draw-export-geojson-btn");
      const colorDots = document.querySelectorAll(".draw-color-dot");

      // Tab Switching
      function switchToolTab(tab) {
        stopAllModes();
        if (tab === "measure") {
          if (tabMeasure) tabMeasure.classList.add("active");
          if (tabDraw) tabDraw.classList.remove("active");
          if (panelMeasure) panelMeasure.style.display = "flex";
          if (panelDraw) panelDraw.style.display = "none";
        } else {
          if (tabDraw) tabDraw.classList.add("active");
          if (tabMeasure) tabMeasure.classList.remove("active");
          if (panelDraw) panelDraw.style.display = "flex";
          if (panelMeasure) panelMeasure.style.display = "none";
        }
      }

      if (tabMeasure) tabMeasure.addEventListener("click", function () { switchToolTab("measure"); });
      if (tabDraw) tabDraw.addEventListener("click", function () { switchToolTab("draw"); });

      // Color picker
      colorDots.forEach(function (dot) {
        dot.addEventListener("click", function () {
          colorDots.forEach(function (d) { d.classList.remove("active"); });
          dot.classList.add("active");
          drawState.selectedColor = dot.getAttribute("data-color") || "#dc2626";
        });
      });

      function stopAllModes() {
        // Stop measurement
        measureState.mode = null;
        if (measureState.tempLine) { map.removeLayer(measureState.tempLine); measureState.tempLine = null; }
        if (measureState.tempPolygon) { map.removeLayer(measureState.tempPolygon); measureState.tempPolygon = null; }
        if (btnMeasureDist) btnMeasureDist.classList.remove("active");
        if (btnMeasureArea) btnMeasureArea.classList.remove("active");
        if (boxMeasureResult) boxMeasureResult.style.display = "none";

        // Stop drawing
        drawState.activeTool = null;
        drawState.points = [];
        if (drawState.tempLayer) { map.removeLayer(drawState.tempLayer); drawState.tempLayer = null; }
        [btnDrawText, btnDrawArrow, btnDrawPolygon, btnDrawLine].forEach(function (b) { if (b) b.classList.remove("active"); });
        if (boxDrawActive) boxDrawActive.style.display = "none";

        map.getContainer().style.cursor = "";
        map.doubleClickZoom.enable();
      }

      // -------------------------------------------------------------
      // MEASUREMENT LOGIC
      // -------------------------------------------------------------
      function toggleMeasureMode(mode) {
        if (measureState.mode === mode) {
          stopAllModes();
          return;
        }
        stopAllModes();
        measureState.mode = mode;
        measureState.points = [];
        map.getContainer().style.cursor = "crosshair";
        map.doubleClickZoom.disable();

        if (mode === "distance" && btnMeasureDist) btnMeasureDist.classList.add("active");
        if (mode === "area" && btnMeasureArea) btnMeasureArea.classList.add("active");
        if (boxMeasureResult) boxMeasureResult.style.display = "flex";
        if (labelMeasureMode) labelMeasureMode.textContent = mode === "distance" ? "📏 Medindo Distância" : "📐 Medindo Área";
        if (textMeasureInstruction) textMeasureInstruction.textContent = "Clique no mapa para adicionar pontos. 2 cliques para concluir.";
        if (valMeasurePrimary) valMeasurePrimary.textContent = "—";
        if (itemMeasureSecondary) itemMeasureSecondary.style.display = mode === "area" ? "flex" : "none";
        if (valMeasureSecondary) valMeasureSecondary.textContent = "—";
      }

      function finishMeasurement() {
        if (!measureState.mode) return;
        const pts = measureState.points;
        const mode = measureState.mode;

        if (mode === "distance" && pts.length >= 2) {
          L.polyline(pts, { color: "#075c2a", weight: 3.5, opacity: 0.95 }).addTo(measureState.layerGroup);
          const totalDist = computeTotalDistance(pts);
          const lastPt = pts[pts.length - 1];

          L.popup({ closeButton: true, offset: [0, -8], className: "measure-badge" })
            .setLatLng(lastPt)
            .setContent("<div class='measure-badge-popup'><strong>📏 Distância Total:</strong><br><span style='font-size:0.95rem;font-weight:800;color:var(--forest-dark);'>" + formatDistance(totalDist) + "</span><br><small style='color:var(--muted);'>" + pts.length + " pontos traçados</small></div>")
            .openOn(map);
        } else if (mode === "area" && pts.length >= 3) {
          const poly = L.polygon(pts, { color: "#075c2a", weight: 2.5, fillColor: "#4ade80", fillOpacity: 0.35 }).addTo(measureState.layerGroup);
          const areaM2 = computePolygonArea(pts);
          const perimM = computeTotalDistance(pts.concat([pts[0]]));
          const center = poly.getBounds().getCenter();

          L.popup({ closeButton: true, offset: [0, 0], className: "measure-badge" })
            .setLatLng(center)
            .setContent("<div class='measure-badge-popup'><strong>📐 Área Total:</strong><br><span style='font-size:0.95rem;font-weight:800;color:var(--forest-dark);'>" + formatArea(areaM2) + "</span><br><strong>Perímetro:</strong> " + formatDistance(perimM) + "</div>")
            .openOn(map);
        }
        stopAllModes();
      }

      if (btnMeasureDist) btnMeasureDist.addEventListener("click", function () { toggleMeasureMode("distance"); });
      if (btnMeasureArea) btnMeasureArea.addEventListener("click", function () { toggleMeasureMode("area"); });
      if (btnMeasureClear) btnMeasureClear.addEventListener("click", function () {
        measureState.points = [];
        measureState.layerGroup.clearLayers();
        stopAllModes();
      });
      if (btnMeasureFinish) btnMeasureFinish.addEventListener("click", function () { finishMeasurement(); });

      // -------------------------------------------------------------
      // DRAWING & ANNOTATIONS LOGIC
      // -------------------------------------------------------------
      function updateDrawingsCount() {
        const count = drawState.userDrawings.length;
        if (badgeDrawingsCount) {
          badgeDrawingsCount.textContent = count + (count === 1 ? " desenho" : " desenhos");
        }
      }

      function toggleDrawTool(tool) {
        if (drawState.activeTool === tool) {
          stopAllModes();
          return;
        }
        stopAllModes();
        drawState.activeTool = tool;
        drawState.points = [];
        map.getContainer().style.cursor = "crosshair";
        map.doubleClickZoom.disable();

        if (tool === "text" && btnDrawText) btnDrawText.classList.add("active");
        if (tool === "arrow" && btnDrawArrow) btnDrawArrow.classList.add("active");
        if (tool === "polygon" && btnDrawPolygon) btnDrawPolygon.classList.add("active");
        if (tool === "line" && btnDrawLine) btnDrawLine.classList.add("active");

        if (boxDrawActive) boxDrawActive.style.display = "flex";
        if (btnDrawFinish) btnDrawFinish.style.display = (tool === "polygon" || tool === "line") ? "inline-block" : "none";

        if (titleDrawActive) {
          const titles = { text: "✏️ Adicionar Texto", arrow: "↗️ Desenhar Seta", polygon: "🛑 Desenhar Polígono", line: "〰️ Traçar Linha" };
          titleDrawActive.textContent = titles[tool] || "✏️ Desenhando";
        }
        if (textDrawInstruction) {
          const instrs = {
            text: "Clique no local do mapa onde deseja inserir o texto.",
            arrow: "Clique no ponto de origem e depois no destino da seta.",
            polygon: "Clique para adicionar vértices do polígono (2 cliques para concluir).",
            line: "Clique para traçar a linha (2 cliques para concluir)."
          };
          textDrawInstruction.textContent = instrs[tool] || "Clique no mapa para posicionar.";
        }
      }

      if (btnDrawText) btnDrawText.addEventListener("click", function () { toggleDrawTool("text"); });
      if (btnDrawArrow) btnDrawArrow.addEventListener("click", function () { toggleDrawTool("arrow"); });
      if (btnDrawPolygon) btnDrawPolygon.addEventListener("click", function () { toggleDrawTool("polygon"); });
      if (btnDrawLine) btnDrawLine.addEventListener("click", function () { toggleDrawTool("line"); });
      if (btnDrawCancel) btnDrawCancel.addEventListener("click", function () { stopAllModes(); });
      if (btnDrawFinish) btnDrawFinish.addEventListener("click", function () { finishCurrentDrawing(); });

      // Create Arrowhead Geometry
      function calculateArrowhead(p1LatLng, p2LatLng) {
        const p1 = map.latLngToLayerPoint(p1LatLng);
        const p2 = map.latLngToLayerPoint(p2LatLng);
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const headLen = 16;
        const headAngle = Math.PI / 6;

        const leftPt = L.point(p2.x - headLen * Math.cos(angle - headAngle), p2.y - headLen * Math.sin(angle - headAngle));
        const rightPt = L.point(p2.x - headLen * Math.cos(angle + headAngle), p2.y - headLen * Math.sin(angle + headAngle));
        const centerIndent = L.point(p2.x - (headLen * 0.65) * Math.cos(angle), p2.y - (headLen * 0.65) * Math.sin(angle));

        return [
          map.layerPointToLatLng(p2),
          map.layerPointToLatLng(leftPt),
          map.layerPointToLatLng(centerIndent),
          map.layerPointToLatLng(rightPt)
        ];
      }

      // Add Custom Text Annotation
      function promptAddTextAnnotation(latlng) {
        const popupContent = document.createElement("div");
        popupContent.style.minWidth = "220px";
        popupContent.style.fontFamily = "var(--font-sans, system-ui)";
        popupContent.innerHTML = 
          "<strong style='font-size:0.80rem;color:" + drawState.selectedColor + ";'>✏️ Inserir Texto / Rótulo</strong><br>" +
          "<input id='annot-input-field' type='text' placeholder='Ex: Trinca na encosta / Enxurrada...' style='width:100%;box-sizing:border-box;margin-top:6px;padding:6px 8px;border:1.5px solid var(--line);border-radius:5px;font-size:0.80rem;' autofocus>" +
          "<div style='display:flex;justify-content:space-between;align-items:center;margin-top:8px;'>" +
            "<span style='font-size:0.68rem;color:var(--muted);'>Pressione Enter para salvar</span>" +
            "<button id='annot-submit-btn' style='background:" + drawState.selectedColor + ";color:#ffffff;border:none;padding:5px 12px;border-radius:4px;font-size:0.75rem;font-weight:700;cursor:pointer;'>Salvar</button>" +
          "</div>";

        const tempPopup = L.popup({ closeButton: true, offset: [0, -10] })
          .setLatLng(latlng)
          .setContent(popupContent)
          .openOn(map);

        setTimeout(function () {
          const input = document.getElementById("annot-input-field");
          const btn = document.getElementById("annot-submit-btn");
          if (input) {
            input.focus();
            const submitAction = function () {
              const textVal = input.value.trim();
              if (textVal) {
                map.closePopup(tempPopup);
                saveTextAnnotation(latlng, textVal, drawState.selectedColor);
              }
            };
            if (btn) btn.addEventListener("click", submitAction);
            input.addEventListener("keydown", function (e) {
              if (e.key === "Enter") submitAction();
            });
          }
        }, 100);

        stopAllModes();
      }

      function saveTextAnnotation(latlng, text, color) {
        const divIcon = L.divIcon({
          className: "custom-text-div-icon",
          html: "<div class='map-text-badge' style='border-color:" + color + ";color:" + color + ";'>" +
                  "<span class='badge-text'>" + escapeHtml(text) + "</span>" +
                "</div>",
          iconSize: null,
          iconAnchor: [0, 0]
        });

        const marker = L.marker(latlng, { icon: divIcon, draggable: true }).addTo(drawState.layerGroup);
        const drawId = "draw_text_" + Date.now();

        const itemObj = {
          id: drawId,
          type: "text",
          layer: marker,
          label: text,
          color: color,
          latlng: latlng,
          date: new Date().toISOString()
        };

        function bindTextPopup() {
          marker.bindPopup(
            "<div class='popup-custom-card'>" +
              "<div class='popup-custom-header' style='color:" + color + ";'>✏️ ANOTAÇÃO DE TEXTO</div>" +
              "<div style='font-size:0.80rem;margin:5px 0;'><strong>Texto:</strong> <span id='popup-text-val'>" + escapeHtml(itemObj.label) + "</span></div>" +
              "<div style='font-size:0.70rem;color:var(--muted);margin-bottom:8px;'>Dica: Você pode arrastar o texto para reposicionar no mapa.</div>" +
              "<div style='display:flex;gap:5px;'>" +
                "<button id='btn-delete-drawing-" + drawId + "' style='background:#fee2e2;color:#dc2626;border:1px solid rgba(220,38,38,0.3);padding:4px 8px;border-radius:4px;font-size:0.70rem;font-weight:700;cursor:pointer;'>🗑️ Excluir</button>" +
              "</div>" +
            "</div>", { maxWidth: 280 }
          );

          marker.on("popupopen", function () {
            const delBtn = document.getElementById("btn-delete-drawing-" + drawId);
            if (delBtn) {
              delBtn.addEventListener("click", function () {
                drawState.layerGroup.removeLayer(marker);
                drawState.userDrawings = drawState.userDrawings.filter(function (d) { return d.id !== drawId; });
                updateDrawingsCount();
                map.closePopup();
              });
            }
          });
        }

        bindTextPopup();
        marker.on("dragend", function (e) {
          itemObj.latlng = e.target.getLatLng();
        });

        drawState.userDrawings.push(itemObj);
        updateDrawingsCount();
      }

      function saveArrowDrawing(p1, p2, color) {
        const shaft = L.polyline([p1, p2], { color: color, weight: 3.5, opacity: 0.95 });
        const headCoords = calculateArrowhead(p1, p2);
        const head = L.polygon(headCoords, { color: color, fillColor: color, fillOpacity: 1, weight: 1.5 });

        const arrowGroup = L.featureGroup([shaft, head]).addTo(drawState.layerGroup);
        const drawId = "draw_arrow_" + Date.now();
        const distM = p1.distanceTo(p2);

        function updateArrowHead() {
          head.setLatLngs(calculateArrowhead(p1, p2));
        }
        map.on("zoomend viewreset", updateArrowHead);

        const itemObj = {
          id: drawId,
          type: "arrow",
          layer: arrowGroup,
          label: "Seta Indicadora",
          color: color,
          points: [p1, p2],
          length_m: Math.round(distM),
          date: new Date().toISOString()
        };

        arrowGroup.bindPopup(
          "<div class='popup-custom-card'>" +
            "<div class='popup-custom-header' style='color:" + color + ";'>↗️ SETA DIRECIONAL</div>" +
            "<div style='font-size:0.75rem;margin:5px 0;line-height:1.4;'>" +
              "<strong>Extensão:</strong> " + formatDistance(distM) + "<br>" +
              "<strong>Finalidade:</strong> Direcionamento / Fluxo de Risco" +
            "</div>" +
            "<div style='display:flex;gap:5px;margin-top:6px;'>" +
              "<button id='btn-delete-drawing-" + drawId + "' style='background:#fee2e2;color:#dc2626;border:1px solid rgba(220,38,38,0.3);padding:4px 8px;border-radius:4px;font-size:0.70rem;font-weight:700;cursor:pointer;'>🗑️ Excluir</button>" +
            "</div>" +
          "</div>", { maxWidth: 280 }
        );

        arrowGroup.on("popupopen", function () {
          const delBtn = document.getElementById("btn-delete-drawing-" + drawId);
          if (delBtn) {
            delBtn.addEventListener("click", function () {
              map.off("zoomend viewreset", updateArrowHead);
              drawState.layerGroup.removeLayer(arrowGroup);
              drawState.userDrawings = drawState.userDrawings.filter(function (d) { return d.id !== drawId; });
              updateDrawingsCount();
              map.closePopup();
            });
          }
        });

        drawState.userDrawings.push(itemObj);
        updateDrawingsCount();
      }

      function savePolygonDrawing(points, color) {
        const poly = L.polygon(points, {
          color: color,
          weight: 2.8,
          dashArray: "4, 4",
          fillColor: color,
          fillOpacity: 0.30
        }).addTo(drawState.layerGroup);

        const drawId = "draw_poly_" + Date.now();
        const areaM2 = computePolygonArea(points);
        const perimM = computeTotalDistance(points.concat([points[0]]));

        const itemObj = {
          id: drawId,
          type: "polygon",
          layer: poly,
          label: "Polígono Personalizado",
          color: color,
          points: points,
          area_m2: Math.round(areaM2),
          perim_m: Math.round(perimM),
          date: new Date().toISOString()
        };

        poly.bindPopup(
          "<div class='popup-custom-card'>" +
            "<div class='popup-custom-header' style='color:" + color + ";'>🛑 POLÍGONO PERSONALIZADO</div>" +
            "<div style='font-size:0.75rem;margin:5px 0;line-height:1.4;'>" +
              "<strong>Área:</strong> " + formatArea(areaM2) + "<br>" +
              "<strong>Perímetro:</strong> " + formatDistance(perimM) + "<br>" +
              "<strong>Vértices:</strong> " + points.length + " pontos" +
            "</div>" +
            "<div style='display:flex;gap:5px;margin-top:6px;'>" +
              "<button id='btn-delete-drawing-" + drawId + "' style='background:#fee2e2;color:#dc2626;border:1px solid rgba(220,38,38,0.3);padding:4px 8px;border-radius:4px;font-size:0.70rem;font-weight:700;cursor:pointer;'>🗑️ Excluir</button>" +
            "</div>" +
          "</div>", { maxWidth: 280 }
        );

        poly.on("popupopen", function () {
          const delBtn = document.getElementById("btn-delete-drawing-" + drawId);
          if (delBtn) {
            delBtn.addEventListener("click", function () {
              drawState.layerGroup.removeLayer(poly);
              drawState.userDrawings = drawState.userDrawings.filter(function (d) { return d.id !== drawId; });
              updateDrawingsCount();
              map.closePopup();
            });
          }
        });

        drawState.userDrawings.push(itemObj);
        updateDrawingsCount();
      }

      function saveLineDrawing(points, color) {
        const line = L.polyline(points, {
          color: color,
          weight: 3.5,
          opacity: 0.95
        }).addTo(drawState.layerGroup);

        const drawId = "draw_line_" + Date.now();
        const distM = computeTotalDistance(points);

        const itemObj = {
          id: drawId,
          type: "line",
          layer: line,
          label: "Linha / Trajeto",
          color: color,
          points: points,
          length_m: Math.round(distM),
          date: new Date().toISOString()
        };

        line.bindPopup(
          "<div class='popup-custom-card'>" +
            "<div class='popup-custom-header' style='color:" + color + ";'>〰️ LINHA / TRAJETO</div>" +
            "<div style='font-size:0.75rem;margin:5px 0;line-height:1.4;'>" +
              "<strong>Comprimento:</strong> " + formatDistance(distM) + "<br>" +
              "<strong>Vértices:</strong> " + points.length + " pontos" +
            "</div>" +
            "<div style='display:flex;gap:5px;margin-top:6px;'>" +
              "<button id='btn-delete-drawing-" + drawId + "' style='background:#fee2e2;color:#dc2626;border:1px solid rgba(220,38,38,0.3);padding:4px 8px;border-radius:4px;font-size:0.70rem;font-weight:700;cursor:pointer;'>🗑️ Excluir</button>" +
            "</div>" +
          "</div>", { maxWidth: 280 }
        );

        line.on("popupopen", function () {
          const delBtn = document.getElementById("btn-delete-drawing-" + drawId);
          if (delBtn) {
            delBtn.addEventListener("click", function () {
              drawState.layerGroup.removeLayer(line);
              drawState.userDrawings = drawState.userDrawings.filter(function (d) { return d.id !== drawId; });
              updateDrawingsCount();
              map.closePopup();
            });
          }
        });

        drawState.userDrawings.push(itemObj);
        updateDrawingsCount();
      }

      function finishCurrentDrawing() {
        if (!drawState.activeTool) return;
        const tool = drawState.activeTool;
        const pts = drawState.points;
        const color = drawState.selectedColor;

        if (tool === "polygon" && pts.length >= 3) {
          savePolygonDrawing(pts, color);
        } else if (tool === "line" && pts.length >= 2) {
          saveLineDrawing(pts, color);
        }
        stopAllModes();
      }

      // Undo last drawing
      if (btnDrawUndo) {
        btnDrawUndo.addEventListener("click", function () {
          if (drawState.userDrawings.length === 0) return;
          const lastItem = drawState.userDrawings.pop();
          if (lastItem && lastItem.layer) {
            drawState.layerGroup.removeLayer(lastItem.layer);
          }
          updateDrawingsCount();
        });
      }

      // Clear all drawings
      if (btnDrawClearAll) {
        btnDrawClearAll.addEventListener("click", function () {
          if (drawState.userDrawings.length === 0) return;
          if (confirm("Deseja realmente limpar todas as anotações e desenhos criados?")) {
            drawState.layerGroup.clearLayers();
            drawState.userDrawings = [];
            updateDrawingsCount();
          }
        });
      }

      // Export drawings as GeoJSON
      if (btnDrawExportGeoJSON) {
        btnDrawExportGeoJSON.addEventListener("click", function () {
          if (drawState.userDrawings.length === 0) {
            alert("Nenhum desenho ou anotação para exportar.");
            return;
          }

          const features = drawState.userDrawings.map(function (item) {
            let geometry = null;
            if (item.type === "text") {
              geometry = { type: "Point", coordinates: [item.latlng.lng, item.latlng.lat] };
            } else if (item.type === "arrow" || item.type === "line") {
              geometry = { type: "LineString", coordinates: item.points.map(function (p) { return [p.lng, p.lat]; }) };
            } else if (item.type === "polygon") {
              const coords = item.points.map(function (p) { return [p.lng, p.lat]; });
              coords.push([item.points[0].lng, item.points[0].lat]);
              geometry = { type: "Polygon", coordinates: [coords] };
            }

            return {
              type: "Feature",
              properties: {
                id: item.id,
                tipo_desenho: item.type,
                rotulo: item.label,
                cor: item.color,
                area_m2: item.area_m2 || null,
                comprimento_m: item.length_m || null,
                data_criacao: item.date,
                projeto: "PCRA Parque Burnier"
              },
              geometry: geometry
            };
          });

          const geojson = {
            type: "FeatureCollection",
            name: "croqui_anotacoes_pcra",
            crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } },
            features: features
          };

          const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "croqui_anotacoes_pcra.geojson";
          link.click();
          URL.revokeObjectURL(url);
        });
      }

      // -------------------------------------------------------------
      // MAP EVENT HANDLERS (CLICK, MOUSEMOVE, DBLCLICK, ESCAPE)
      // -------------------------------------------------------------
      map.on("click", function (e) {
        const latlng = e.latlng;

        // Measurement click handler
        if (measureState.mode) {
          measureState.points.push(latlng);
          const isFirst = measureState.points.length === 1;
          const marker = L.circleMarker(latlng, {
            radius: isFirst ? 6 : 4.5,
            color: isFirst ? "#04431e" : "#075c2a",
            fillColor: isFirst ? "#4ade80" : "#ffffff",
            fillOpacity: 1,
            weight: 2.5
          }).addTo(measureState.layerGroup);
          measureState.markers.push(marker);

          if (boxMeasureResult) boxMeasureResult.style.display = "flex";
          if (measureState.mode === "distance") {
            const dist = computeTotalDistance(measureState.points);
            if (titleMeasurePrimary) titleMeasurePrimary.textContent = "Distância:";
            if (valMeasurePrimary) valMeasurePrimary.textContent = formatDistance(dist);
            if (itemMeasureSecondary) itemMeasureSecondary.style.display = "none";
          } else if (measureState.mode === "area") {
            const areaM2 = measureState.points.length >= 3 ? computePolygonArea(measureState.points) : 0;
            const perimM = measureState.points.length >= 2 ? computeTotalDistance(measureState.points.concat([measureState.points[0]])) : 0;
            if (titleMeasurePrimary) titleMeasurePrimary.textContent = "Área:";
            if (valMeasurePrimary) valMeasurePrimary.textContent = areaM2 > 0 ? formatArea(areaM2) : "Adicione 3+ pontos";
            if (itemMeasureSecondary) itemMeasureSecondary.style.display = "flex";
            if (valMeasureSecondary) valMeasureSecondary.textContent = formatDistance(perimM);
          }
          if (btnMeasureFinish) {
            btnMeasureFinish.style.display = (measureState.points.length >= (measureState.mode === "area" ? 3 : 2)) ? "inline-block" : "none";
          }
          return;
        }

        // Drawing click handler
        if (drawState.activeTool) {
          const tool = drawState.activeTool;

          if (tool === "text") {
            promptAddTextAnnotation(latlng);
            return;
          }

          if (tool === "arrow") {
            drawState.points.push(latlng);
            if (drawState.points.length === 1) {
              if (textDrawInstruction) textDrawInstruction.textContent = "Agora clique no ponto de destino (ponta da seta).";
            } else if (drawState.points.length === 2) {
              saveArrowDrawing(drawState.points[0], drawState.points[1], drawState.selectedColor);
              stopAllModes();
            }
            return;
          }

          if (tool === "polygon" || tool === "line") {
            drawState.points.push(latlng);
            if (btnDrawFinish) {
              btnDrawFinish.style.display = (drawState.points.length >= (tool === "polygon" ? 3 : 2)) ? "inline-block" : "none";
            }
            return;
          }
        }
      });

      map.on("mousemove", function (e) {
        const cursorPt = e.latlng;

        // Measure mousemove
        if (measureState.mode && measureState.points.length > 0) {
          const currentPoints = measureState.points.concat([cursorPt]);
          if (measureState.mode === "distance") {
            if (!measureState.tempLine) {
              measureState.tempLine = L.polyline(currentPoints, { color: "#075c2a", weight: 3, dashArray: "6, 6", opacity: 0.85 }).addTo(map);
            } else {
              measureState.tempLine.setLatLngs(currentPoints);
            }
            const dist = computeTotalDistance(currentPoints);
            if (valMeasurePrimary) valMeasurePrimary.textContent = formatDistance(dist);
          } else if (measureState.mode === "area") {
            if (!measureState.tempPolygon) {
              measureState.tempPolygon = L.polygon(currentPoints, { color: "#075c2a", weight: 2.5, dashArray: "5, 5", fillColor: "#4ade80", fillOpacity: 0.28 }).addTo(map);
            } else {
              measureState.tempPolygon.setLatLngs(currentPoints);
            }
            if (currentPoints.length >= 3) {
              const areaM2 = computePolygonArea(currentPoints);
              const perimM = computeTotalDistance(currentPoints.concat([currentPoints[0]]));
              if (valMeasurePrimary) valMeasurePrimary.textContent = formatArea(areaM2);
              if (valMeasureSecondary) valMeasureSecondary.textContent = formatDistance(perimM);
            }
          }
        }

        // Draw mousemove
        if (drawState.activeTool && drawState.points.length > 0) {
          const tool = drawState.activeTool;
          const currentPts = drawState.points.concat([cursorPt]);
          const color = drawState.selectedColor;

          if (tool === "arrow" && drawState.points.length === 1) {
            const headPts = calculateArrowhead(drawState.points[0], cursorPt);
            if (!drawState.tempLayer) {
              const shaft = L.polyline([drawState.points[0], cursorPt], { color: color, weight: 3, dashArray: "5, 5", opacity: 0.85 });
              const head = L.polygon(headPts, { color: color, fillColor: color, fillOpacity: 0.7, weight: 1.5 });
              drawState.tempLayer = L.featureGroup([shaft, head]).addTo(map);
            } else {
              const layers = drawState.tempLayer.getLayers();
              if (layers.length >= 2) {
                layers[0].setLatLngs([drawState.points[0], cursorPt]);
                layers[1].setLatLngs(headPts);
              }
            }
          } else if (tool === "polygon") {
            if (!drawState.tempLayer) {
              drawState.tempLayer = L.polygon(currentPts, { color: color, weight: 2.5, dashArray: "5, 5", fillColor: color, fillOpacity: 0.20 }).addTo(map);
            } else {
              drawState.tempLayer.setLatLngs(currentPts);
            }
          } else if (tool === "line") {
            if (!drawState.tempLayer) {
              drawState.tempLayer = L.polyline(currentPts, { color: color, weight: 3, dashArray: "5, 5", opacity: 0.85 }).addTo(map);
            } else {
              drawState.tempLayer.setLatLngs(currentPts);
            }
          }
        }
      });

      map.on("dblclick", function (e) {
        L.DomEvent.stopPropagation(e);
        if (measureState.mode) {
          if (measureState.points.length > 2) measureState.points.pop();
          finishMeasurement();
        } else if (drawState.activeTool === "polygon" || drawState.activeTool === "line") {
          if (drawState.points.length > 2) drawState.points.pop();
          finishCurrentDrawing();
        }
      });

      window.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          stopAllModes();
        }
      });
    }

    function initLogos() {
      if (window.APP_LOGOS) {
        const elPeriferia = document.getElementById("logo-periferia");
        const elPlanos = document.getElementById("logo-planos");
        const elMinisterio = document.getElementById("logo-ministerio");
        if (elPeriferia && window.APP_LOGOS.periferiaSemRisco) elPeriferia.src = window.APP_LOGOS.periferiaSemRisco;
        if (elPlanos && window.APP_LOGOS.planosComunitarios) elPlanos.src = window.APP_LOGOS.planosComunitarios;
        if (elMinisterio && window.APP_LOGOS.ministerioCidades) elMinisterio.src = window.APP_LOGOS.ministerioCidades;
      }
    }

    
        // ==========================================================
    // 👥 MAPEAMENTO PARTICIPATIVO UI HANDLERS (LINHA ÚNICA)
    // ==========================================================
    function setupMapeamentoParticipativoUI() {
      const toggleChk = document.getElementById("toggle-mapeamento-participativo") || document.getElementById("toggle-group-mapeamento-participativo");
      const openModalBtn = document.getElementById("btn-open-legenda-participativa");
      const modal = document.getElementById("modal-legenda-participativa");
      const closeModalBtn = document.getElementById("modal-legenda-participativa-close");

      const partLayersKeys = ["percepcao_simbolos", "percepcao_anotacoes", "percepcao_caminhos", "percepcao_areas", "percepcao_limite"];

      function updateMapeamentoVisibility() {
        if (!toggleChk) return;
        const isChecked = toggleChk.checked;
        partLayersKeys.forEach(function (k) {
          if (overlayLayers[k]) {
            if (isChecked) {
              if (!map.hasLayer(overlayLayers[k])) overlayLayers[k].addTo(map);
            } else {
              if (map.hasLayer(overlayLayers[k])) map.removeLayer(overlayLayers[k]);
            }
          }
        });
      }

      if (toggleChk) {
        toggleChk.addEventListener("change", updateMapeamentoVisibility);
      }

      // Legenda Modal
      if (openModalBtn && modal) {
        openModalBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          // Populate base64 icons if available
          if (window.PCRA_PERCEPCAO_ICONS) {
            modal.querySelectorAll(".modal-leg-icon-img").forEach(function (img) {
              const cat = img.dataset.iconCat;
              if (cat && window.PCRA_PERCEPCAO_ICONS[cat]) {
                img.src = window.PCRA_PERCEPCAO_ICONS[cat];
              }
            });
          }
          modal.classList.add("open");
        });
      }

      if (closeModalBtn && modal) {
        closeModalBtn.addEventListener("click", function () {
          modal.classList.remove("open");
        });
      }

      if (modal) {
        modal.addEventListener("click", function (e) {
          if (e.target === modal) modal.classList.remove("open");
        });
      }

      window.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && modal && modal.classList.contains("open")) {
          modal.classList.remove("open");
        }
      });
    }

    // ==========================================================================
    // INMET - Carregamento de Avisos e Controle de Interface
    // ==========================================================================
    async function carregarAlertasINMET() {
      const cardDot = document.getElementById("inmet-card-dot");
      const cardBtnText = document.getElementById("inmet-card-btn-text");
      const btnOpenModal = document.getElementById("btn-open-inmet-modal");
      const floatingPill = document.getElementById("inmet-floating-pill");
      const floatingText = document.getElementById("inmet-floating-text");
      const floatingDot = document.getElementById("inmet-floating-dot");
      const modalContent = document.getElementById("inmet-modal-content");
      const modalHeader = document.getElementById("inmet-modal-header");

      try {
        const response = await fetch(INMET_CONFIG.apiUrl, {
          headers: { "Accept": "application/json" }
        });

        if (!response.ok) throw new Error("HTTP Error: " + response.status);

        const payload = await response.json();
        const todosAvisos = [...(payload.hoje || []), ...(payload.futuro || [])];

        // Filtra alertas que abrangem o município de Juiz de Fora (IBGE: 3136702)
        const avisosJuizDeFora = todosAvisos.filter(function (aviso) {
          const geocodes = (aviso.geocodes || "").split(",");
          return geocodes.includes(INMET_CONFIG.codigoIBGE);
        });

        // Limpa desenhos de alertas anteriores no grupo de camadas
        inmetAlertLayerGroup.clearLayers();

        if (avisosJuizDeFora.length === 0) {
          if (cardBtnText) cardBtnText.textContent = "✅ Clima Estável (Sem avisos ativos)";
          if (cardDot) {
            cardDot.style.background = "#4ade80"; // Verde
            cardDot.classList.remove("active-alert");
          }
          if (btnOpenModal) {
            btnOpenModal.classList.add("stable");
            btnOpenModal.style.background = "#16a34a";
            btnOpenModal.style.color = "#ffffff";
          }
          if (floatingPill) floatingPill.style.display = "none";
          if (modalHeader) modalHeader.style.background = "var(--forest-dark)";
          if (modalContent) {
            modalContent.innerHTML = 
              "<div style='text-align: center; padding: 24px;'>" +
                "<p style='font-size: 1.05rem; color: var(--forest); font-weight: 700;'>Nenhum aviso de tempo severo ativo para Juiz de Fora.</p>" +
                "<p style='color: var(--text-muted); font-size: 0.8rem; margin-top: 6px;'>" +
                  "Condições climáticas regulares segundo o Instituto Nacional de Meteorologia (INMET)." +
                "</p>" +
              "</div>";
          }
          return;
        }

        // Seleciona o aviso com maior índice de severidade
        const alertaPrincipal = avisosJuizDeFora.reduce(function (max, cur) {
          return ((cur.id_severidade || 0) > (max.id_severidade || 0)) ? cur : max;
        }, avisosJuizDeFora[0]);

        const corAlerta = alertaPrincipal.aviso_cor || "#ea580c";
        const isYellow = (corAlerta === "#FFFE00" || corAlerta.toLowerCase() === "#fffe00");
        const titleCor = isYellow ? "#ca8a04" : corAlerta;

        if (cardBtnText) {
          cardBtnText.textContent = "⚠️ " + alertaPrincipal.descricao + " (" + alertaPrincipal.severidade + ") · Ver " + avisosJuizDeFora.length + " avisos";
        }
        if (cardDot) {
          cardDot.style.background = corAlerta;
          cardDot.classList.add("active-alert");
        }
        if (btnOpenModal) {
          btnOpenModal.classList.remove("stable");
          btnOpenModal.style.background = corAlerta;
          btnOpenModal.style.color = isYellow ? "#1f2937" : "#ffffff";
        }

        // Floating pill discreto no mapa
        if (floatingPill) {
          floatingPill.style.display = "flex";
          floatingPill.style.borderColor = corAlerta;
          if (floatingText) {
            floatingText.textContent = alertaPrincipal.descricao + ": " + alertaPrincipal.severidade;
          }
          if (floatingDot) {
            floatingDot.style.background = corAlerta;
          }
        }

        if (modalHeader) {
          modalHeader.style.background = corAlerta;
          modalHeader.style.color = isYellow ? "#1f2937" : "#ffffff";
        }

        // Constrói o conteúdo detalhado do Modal
        const isLayerOnMap = map.hasLayer(inmetAlertLayerGroup);
        let modalHtml = 
          "<div style='display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--line);'>" +
            "<span style='font-weight:700;font-size:0.88rem;color:var(--text-main);'>Avisos vigentes em Juiz de Fora (" + avisosJuizDeFora.length + "):</span>" +
            "<button type='button' id='btn-modal-toggle-layer' class='btn btn-secondary' style='font-size:0.75rem;padding:5px 10px;white-space:nowrap;font-weight:600;'>" +
              (isLayerOnMap ? "🗺️ Ocultar mancha no mapa" : "🗺️ Ver mancha no mapa") +
            "</button>" +
          "</div>";

        avisosJuizDeFora.forEach(function (aviso) {
          const cor = aviso.aviso_cor || "#eab308";
          const riscosText = Array.isArray(aviso.riscos) ? aviso.riscos.join("<br>") : (aviso.riscos || "Acompanhe as recomendações da Defesa Civil.");
          const instrucoesText = Array.isArray(aviso.instrucoes) ? aviso.instrucoes.join("<br>") : (aviso.instrucoes || "Evite áreas de risco de deslizamento e alagamento.");
          const avTitleCor = (cor === "#FFFE00" || cor.toLowerCase() === "#fffe00") ? "#ca8a04" : cor;

          modalHtml += 
            "<div class='inmet-alert-box' style='border-left-color: " + cor + ";'>" +
              "<div class='inmet-alert-title' style='color: " + avTitleCor + ";'>" +
                "⚠️ " + aviso.descricao + " — " + aviso.severidade +
              "</div>" +
              "<div class='inmet-alert-period'>" +
                "<strong>Vigência:</strong> " + (aviso.inicio || "—") + " até " + (aviso.fim || "—") +
              "</div>" +
              "<div class='inmet-list-section'>" +
                "<strong>Riscos Previstos:</strong>" +
                "<p>" + riscosText + "</p>" +
              "</div>" +
              "<div class='inmet-list-section' style='margin-top: 8px;'>" +
                "<strong>Instruções de Segurança / Campo:</strong>" +
                "<p>" + instrucoesText + "</p>" +
              "</div>" +
            "</div>";

          // Se houver coordenadas poligonais da mancha do evento, popula no Leaflet LayerGroup
          if (aviso.poligono) {
            try {
              let geoLayer = null;
              if (typeof aviso.poligono === "string" && aviso.poligono.trim().startsWith("{")) {
                const geoData = JSON.parse(aviso.poligono);
                geoLayer = L.geoJSON(geoData, {
                  style: {
                    color: cor,
                    weight: 2,
                    fillColor: cor,
                    fillOpacity: 0.16,
                    dashArray: "4, 4"
                  }
                });
              } else if (typeof aviso.poligono === "string") {
                const pontos = aviso.poligono.split(";").map(function (coord) {
                  const parts = coord.trim().split(",").map(Number);
                  return [parts[0], parts[1]];
                }).filter(function (c) { return !isNaN(c[0]) && !isNaN(c[1]); });

                if (pontos.length >= 3) {
                  geoLayer = L.polygon(pontos, {
                    color: cor,
                    weight: 2,
                    fillColor: cor,
                    fillOpacity: 0.16,
                    dashArray: "4, 4"
                  });
                }
              }

              if (geoLayer) {
                geoLayer.bindPopup(
                  "<div style='font-size: 0.82rem; line-height: 1.45; min-width: 180px;'>" +
                    "<strong style='color: " + avTitleCor + "; font-size: 0.9rem;'>⚠️ " + aviso.descricao + "</strong><br>" +
                    "<span><b>Grau:</b> " + aviso.severidade + "</span><br>" +
                    "<span><b>Início:</b> " + (aviso.inicio || "—") + "</span><br>" +
                    "<span><b>Término:</b> " + (aviso.fim || "—") + "</span>" +
                  "</div>"
                );
                geoLayer.addTo(inmetAlertLayerGroup);
              }
            } catch (err) {
              console.warn("Falha ao preparar polígono do alerta no Leaflet:", err);
            }
          }
        });

        if (modalContent) {
          modalContent.innerHTML = modalHtml;
          // Wire up toggle button inside modal
          const btnModalToggle = document.getElementById("btn-modal-toggle-layer");
          if (btnModalToggle) {
            btnModalToggle.addEventListener("click", function () {
              const chk = document.getElementById("toggle-inmet-alerts-layer");
              const isCurrentlyOn = map.hasLayer(inmetAlertLayerGroup);
              const newState = !isCurrentlyOn;
              if (chk) chk.checked = newState;
              if (newState) {
                map.addLayer(inmetAlertLayerGroup);
                btnModalToggle.textContent = "🗺️ Ocultar mancha no mapa";
              } else {
                map.removeLayer(inmetAlertLayerGroup);
                btnModalToggle.textContent = "🗺️ Ver mancha no mapa";
              }
            });
          }
        }

      } catch (err) {
        console.error("Erro na comunicação com a API do INMET:", err);
        if (cardBtnText) cardBtnText.textContent = "Clima: Indisponível";
        if (cardDot) {
          cardDot.style.background = "#94a3b8";
          cardDot.classList.remove("active-alert");
        }
      }
    }

    function setupINMETEvents() {
      const btnOpenModal = document.getElementById("btn-open-inmet-modal");
      const floatingPill = document.getElementById("inmet-floating-pill");
      const floatingDismiss = document.getElementById("inmet-floating-dismiss");
      const modalInmet = document.getElementById("inmet-modal");
      const chkLayer = document.getElementById("toggle-inmet-alerts-layer");

      if (btnOpenModal && modalInmet) {
        btnOpenModal.addEventListener("click", function (e) {
          e.preventDefault();
          modalInmet.classList.add("open");
        });
      }

      if (floatingPill && modalInmet) {
        floatingPill.addEventListener("click", function (e) {
          if (e.target === floatingDismiss || (e.target && e.target.closest && e.target.closest("#inmet-floating-dismiss"))) return;
          modalInmet.classList.add("open");
        });
      }

      if (floatingDismiss && floatingPill) {
        floatingDismiss.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          floatingPill.style.display = "none";
        });
      }

      if (chkLayer) {
        chkLayer.addEventListener("change", function () {
          if (this.checked) {
            if (!map.hasLayer(inmetAlertLayerGroup)) map.addLayer(inmetAlertLayerGroup);
          } else {
            if (map.hasLayer(inmetAlertLayerGroup)) map.removeLayer(inmetAlertLayerGroup);
          }
        });
      }

      window.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && modalInmet && modalInmet.classList.contains("open")) {
          modalInmet.classList.remove("open");
        }
      });
    }

    function init() {
      setupMapeamentoParticipativoUI();
      setupINMETEvents();
      initLogos();
      initReferenceLayers();
      setupEventListeners();
      setupWebGISTools();
      setupAdminEditMode();
      updateAdjustedUI();
      switchTab("list");
      fallbackToInitialRecords();
      fallbackToInitialPontosEncontro();
      setTimeout(function () { map.invalidateSize(); }, 150);
      syncData();
      carregarAlertasINMET();
      setInterval(carregarAlertasINMET, INMET_CONFIG.checkIntervalMs);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();

