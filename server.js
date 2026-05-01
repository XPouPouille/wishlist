const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Use /data if writable, fallback to local file
const DATA_FILE = (() => {
  try {
    fs.mkdirSync('/data', { recursive: true });
    fs.accessSync('/data', fs.constants.W_OK);
    return '/data/wishlist.json';
  } catch {
    return path.join(__dirname, 'wishlist.json');
  }
})();

console.log(`Data file: ${DATA_FILE}`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadWishlist() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {}
  return [];
}

function saveWishlist(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/og-image', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.json({ image: null, title: null });
  try {
    const response = await axios.get(targetUrl, {
      timeout: 8000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      responseType: 'text'
    });
    const html = response.data;
    const parsed = new URL(targetUrl);

    const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];

    const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1]
      || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];

    let image = ogImage || null;
    if (image && image.startsWith('//')) image = parsed.protocol + image;
    else if (image && image.startsWith('/')) image = parsed.origin + image;

    res.json({ image, title: ogTitle?.trim() || null });
  } catch (err) {
    console.error('OG fetch error:', err.message);
    res.json({ image: null, title: null });
  }
});

app.get('/api/wishlist', (req, res) => {
  try { res.json(loadWishlist()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/wishlist', (req, res) => {
  try {
    const wishlist = loadWishlist();
    const item = { id: Date.now(), url: req.body.url, title: req.body.title, image: req.body.image || null, toggled: false };
    wishlist.push(item);
    saveWishlist(wishlist);
    res.json(item);
  } catch (err) {
    console.error('POST /api/wishlist error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/wishlist/:id', (req, res) => {
  try {
    const wishlist = loadWishlist();
    const idx = wishlist.findIndex(i => i.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    wishlist[idx] = { ...wishlist[idx], ...req.body };
    saveWishlist(wishlist);
    res.json(wishlist[idx]);
  } catch (err) {
    console.error('PATCH error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/wishlist/:id', (req, res) => {
  try {
    const wishlist = loadWishlist().filter(i => i.id != req.params.id);
    saveWishlist(wishlist);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Wishlist on http://localhost:${PORT}`));
