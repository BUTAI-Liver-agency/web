# Scroll motion — 2026-09-13

Implemented original 5-part plan: curtain reveal on hero and special entrance; soft photo arrival; staggered hero copy and selected headings; subtle scroll zoom in two contextual photos; scroll-triggered steps.

Native scrolling remains. No CTA is hidden, disabled or placed under an input-blocking overlay. All decorative curtain layers ignore pointer events. Content is readable without JS. Reduced-motion preference and manual footer toggle disable effects. No continuous animation loop; photo calculations run only on scroll/resize while a relevant photo intersects the viewport. Smaller motion amplitudes on mobile.

Existing profile content and special page source unchanged. The old reveal engine was replaced to avoid overlapping animations.

Validation: script syntax, local asset paths and anchors checked. Desktop browser: hero curtain entered, all four steps reached after section navigation, manual toggle switched to disabled state, no page JS errors. Physical-device and mobile motion smoothness were not tested. No live LINE registration performed.

GitHub integration write permission is still unresolved; this is not a live deployment.
