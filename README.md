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
