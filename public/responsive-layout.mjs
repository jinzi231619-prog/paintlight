// Move existing nodes so visual, reading and keyboard order agree on phones.
// Desktop restores the original sidebar and gallery without cloning controls.
export function setupResponsiveLayout() {
  const workspace = document.querySelector('.workspace');
  const controls = document.getElementById('exploreControls');
  const intro = document.getElementById('galleryIntro');
  const gallery = document.querySelector('.gallery');
  const info = document.getElementById('artInfo');
  const insights = document.getElementById('insights');
  const footer = document.querySelector('.gallery-footer');
  const mobile = matchMedia('(max-width: 700px)');
  function arrange() {
    if (mobile.matches) {
      workspace.prepend(intro);
      workspace.append(gallery, controls, insights, footer);
    } else {
      controls.prepend(intro);
      workspace.prepend(controls);
      info.append(insights);
      gallery.append(footer);
    }
  }
  arrange();
  mobile.addEventListener('change', arrange);
}
