# Michael Tsalkos Portfolio

Static portfolio site prepared for GitHub Pages.

## GitHub Pages Settings

Use these repository settings:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`
- Custom domain: `michaeltsalkos.com`
- Enforce HTTPS: enabled after DNS has propagated

## Domain DNS

For the apex domain `michaeltsalkos.com`, add these `A` records at the domain registrar or DNS provider:

```txt
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

For `www.michaeltsalkos.com`, add this `CNAME` record:

```txt
www -> your-github-username.github.io
```

Replace `your-github-username` with the actual GitHub username or organization that owns the Pages repository.

## Local Entry Point

The deploy entry point is:

```txt
index.html
```

## Preview images

The front page uses smaller `.preview.webp` copies; original project images stay in place.
After adding new PNG/JPEG previews, install Pillow in a development environment and run
`python3 scripts/optimize-previews.py` from the repository root. The script preserves
transparency, limits previews to 2000 pixels on their longest edge, and only substitutes
files that are at least 10% smaller. Commit the generated WebP files with `index.html`.
