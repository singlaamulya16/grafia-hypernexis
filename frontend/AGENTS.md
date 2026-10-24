<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Decisions

- The site is a single dark "detective noir" theme; do not add a light/dark toggle. All colors must use the oklch tokens in `src/styles.css` (background, primary gold, gold-soft, etc.) — never hardcode colors in components.
- The hero background is the generated scene `src/assets/hero-scene.png` (no text baked into the image); all hero copy and buttons are live HTML overlaid on it.
