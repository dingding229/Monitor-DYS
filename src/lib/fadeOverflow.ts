export function fadeOverflow(el: HTMLElement) {
  const update = () => el.classList.toggle("fade-end", el.scrollLeft + el.clientWidth + 1 < el.scrollWidth)
  const observer = new ResizeObserver(update)
  observer.observe(el); observer.observe(el.firstElementChild!)
  el.addEventListener("scroll", update, { passive: true })
  return { destroy() { observer.disconnect(); el.removeEventListener("scroll", update) } }
}
