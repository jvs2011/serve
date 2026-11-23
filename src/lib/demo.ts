/**
 * A demonstração (perfis de exemplo com dados fictícios) só existe no desenvolvimento local (`npm run dev`)
 * e na prévia em arquivo único. No app publicado ela não aparece em lugar nenhum, para ninguém entrar
 * num perfil de exemplo achando que são as escalas de verdade.
 */
export const DEMO_ENABLED = import.meta.env.DEV || import.meta.env.MODE === 'single'
