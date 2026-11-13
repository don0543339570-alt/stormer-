# Hosting website (static, for Vercel drop)

Plain HTML/CSS/JS, no build step. Drag this folder onto Vercel (or any static host).

## Prices

All prices live in `prices.json` in the GitHub repo set in `config.js`.
Every page reads them from GitHub when it loads, so price changes go live without redeploying.
The copy of `prices.json` in this folder is only a fallback.

## Editing prices

1. Create a GitHub fine-grained token: GitHub → Settings → Developer settings → Fine-grained tokens →
   *Only select repositories* → this repo → Repository permissions → **Contents: Read and write**.
2. Open `/settings.html` on your site, paste the token, click **Connect & load prices**.
3. Edit plan prices, billing period, names, features, "Popular" badge, domain prices, or use **Set every price at once**.
   Site details (name, tagline, currency, phone, WhatsApp, email, address) are also edited here.
4. Click **Save to GitHub**. The live site updates within a few minutes.

The token is stored only in your browser. Visitors can open the settings page but can't save without a token.
The repo must be **public** so visitors' browsers can read `prices.json`.

Order buttons open WhatsApp with a pre-filled message once a WhatsApp number is set.
