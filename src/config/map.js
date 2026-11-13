export const MAP_CENTER = [24.56, -104.68]
export const MAP_ZOOM = 7

export const wmsConfig = {
  url: import.meta.env.VITE_QGIS_WMS_URL?.trim() ?? "",
  map: import.meta.env.VITE_QGIS_MAP?.trim() ?? "",
}

export const BASEMAPS = {
  streets: {
    layer: "OpenStreetMap",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    layer: "Esri World Imagery",
    attribution:
      "Sources: Esri, Vantor, Earthstar Geographics, and the GIS User Community",
  },
  topographic: {
    layer: "Esri World Topo Map",
    attribution:
      "Sources: Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), © OpenStreetMap contributors, and the GIS User Community",
  },
}

export const isWmsConfigured = Boolean(wmsConfig.url && wmsConfig.map)
