export const productName = 'SIGEP'
export const firmName = import.meta.env.VITE_DESPACHO_NOMBRE?.trim() || 'COSAN'
export const productTitle = firmName ? `${productName} · ${firmName}` : `${productName} · Gestión territorial`
