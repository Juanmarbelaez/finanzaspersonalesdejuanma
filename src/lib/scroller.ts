/*
 * La app hace scroll dentro de su propio contenedor (#root), no en la página del navegador:
 * así no hay rebote, ni barra de scroll que se pueda arrastrar, y se siente app nativa.
 */
export const scroller = (): HTMLElement => document.getElementById('root') ?? document.documentElement
