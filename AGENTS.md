<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## BOX images
When adding or changing `pack_image_url`, run `npm run prepare:pack-images` and commit
`data/pack-image-bounds.json`. Use `PackImage` for BOX header and ranking artwork;
do not add per-product CSS scale overrides. Run `npm run verify:pack-images`, and
visually check the new BOX at desktop and mobile widths before release.
