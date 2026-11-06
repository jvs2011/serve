/** Computador (tela larga com mouse): o app aparece dentro do celular simulado */
export const DESKTOP_QUERY = '(min-width: 900px) and (hover: hover) and (pointer: fine)'
export const isDesktop = () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches
