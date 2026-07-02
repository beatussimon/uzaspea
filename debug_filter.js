const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function check() {
  const promoRes = await fetch('http://127.0.0.1:8000/api/sponsored/?public=true&page_size=16');
  const promoData = Array.isArray(promoRes.results || promoRes) ? (promoRes.results || promoRes) : [];
  
  const prodRes = await fetch('http://127.0.0.1:8000/api/products/?page_size=16');
  const prodData = Array.isArray(prodRes.results || prodRes) ? (prodRes.results || prodRes) : [];
  
  console.log(`Fetched ${promoData.length} promos and ${prodData.length} products`);
  
  const promoIds = promoData.map(p => p.product_details?.id);
  console.log('Promo Product IDs:', promoIds);
  
  const prodIds = prodData.map(p => p.id);
  console.log('Latest Product IDs:', prodIds);
  
  const filtered = prodData.filter((p) => !promoData.some((promo) => promo.product_details?.id === p.id));
  console.log('Filtered Latest IDs:', filtered.map(p => p.id));
  
  const duplicates = prodData.filter(p => promoData.some(promo => promo.product_details?.id === p.id));
  console.log('Duplicates found:', duplicates.map(p => p.id));
}

check();
