/** Volta ao topo — na janela (celular) ou dentro da moldura de celular (computador) */
export function scrollToTop() {
  window.scrollTo(0, 0)
  document.querySelector('.phone-scroll')?.scrollTo(0, 0)
}
