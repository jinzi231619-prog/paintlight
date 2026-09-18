// One cancellable transition. No layout reads or CSS animation restarts.
export function createQuizMotion({card, reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  schedule = setTimeout, unschedule = clearTimeout}) {
  let timer, animation;
  function cancel() {
    unschedule(timer);
    timer = undefined;
    animation?.cancel();
    animation = undefined;
  }
  function arrive() {
    animation?.cancel();
    if (!reduced() && card.animate) {
      animation = card.animate([
        {opacity: 0, transform: 'translateY(4px)'},
        {opacity: 1, transform: 'translateY(0)'}
      ], {duration: 160, easing: 'ease-out'});
    }
  }
  function afterAnswer(commit) {
    cancel();
    timer = schedule(() => { timer = undefined; commit(); arrive(); }, reduced() ? 0 : 90);
  }
  return {cancel, arrive, afterAnswer};
}
