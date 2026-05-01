const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = '/data/wishlist.json';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadWishlist() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {}
  return [];
}

function saveWishlist(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/og-image', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.json({ image: null, title: null });
  try {
    const response = await axios.get(targetUrl, {
      timeout: 8000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WishlistBot/1.0)' },
      responseType: 'text'
    });
    const html = response.data;

    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];

    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1]
      || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];

    const parsed = new URL(targetUrl);

    let image = ogImage || null;
    if (image && image.startsWith('//')) image = parsed.protocol + image;
    else if (image && image.startsWith('/')) image = parsed.origin + image;

    res.json({ image, title: ogTitle?.trim() || null });
  } catch {
    res.json({ image: null, title: null });
  }
});

app.get('/api/wishlist', (req, res) => res.json(loadWishlist()));

app.post('/api/wishlist', (req, res) => {
  const wishlist = loadWishlist();
  const item = { id: Date.now(), url: req.body.url, title: req.body.title, image: req.body.image, toggled: false };
  wishlist.push(item);
  saveWishlist(wishlist);
  res.json(item);
});

app.patch('/api/wishlist/:id', (req, res) => {
  const wishlist = loadWishlist();
  const idx = wishlist.findIndex(i => i.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  wishlist[idx] = { ...wishlist[idx], ...req.body };
  saveWishlist(wishlist);
  res.json(wishlist[idx]);
});

app.delete('/api/wishlist/:id', (req, res) => {
  const wishlist = loadWishlist().filter(i => i.id != req.params.id);
  saveWishlist(wishlist);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Wishlist on http://localhost:${PORT}`));
