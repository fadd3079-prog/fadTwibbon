const origin = 'https://fadtwibbon.vercel.app';
const defaults = {
  '/': ['fadTwibbon','Buka kampanye atau kelola Twibbon dari satu tempat.','index,follow'],
  '/login': ['Masuk | fadTwibbon','Masuk untuk mengelola kampanye Twibbon.','noindex,nofollow'],
  '/register': ['Daftar | fadTwibbon','Buat akun pengelola kampanye Twibbon.','noindex,nofollow'],
  '/forgot-password': ['Pulihkan Password | fadTwibbon','Pulihkan akses akun fadTwibbon.','noindex,nofollow'],
  '/reset-password': ['Buat Password Baru | fadTwibbon','Buat password baru untuk akun fadTwibbon.','noindex,nofollow'],
  '/privacy': ['Privasi | fadTwibbon','Cara fadTwibbon memproses foto, akun, dan data kampanye.','index,follow'],
  '/terms': ['Ketentuan | fadTwibbon','Ketentuan penggunaan fadTwibbon.','index,follow'],
};

function meta(name,value,property=false) {
  let node=document.head.querySelector(`meta[${property?'property':'name'}="${name}"]`);
  if (!node) { node=document.createElement('meta'); node.setAttribute(property?'property':'name',name); document.head.append(node); }
  node.content=value;
}

export function setMetadata(path,campaign=null) {
  const privateRoute=/^\/(admin|superadmin|auth)(\/|$)/.test(path);
  const base=defaults[path] || (privateRoute ? ['Dashboard | fadTwibbon','Kelola kampanye fadTwibbon.','noindex,nofollow'] : ['Halaman Tidak Ditemukan | fadTwibbon','Halaman tidak ditemukan.','noindex,nofollow']);
  const title=campaign ? `${campaign.title} | fadTwibbon` : base[0];
  const description=campaign?.description?.trim() || (campaign ? 'Buat Twibbon untuk kampanye ini langsung dari browser.' : base[1]);
  const robots=campaign ? 'index,follow' : base[2];
  const canonical=`${origin}${path}`;
  document.title=title;
  meta('description',description);
  meta('robots',robots);
  meta('og:title',title,true); meta('og:description',description,true); meta('og:url',canonical,true); meta('og:type','website',true); meta('og:locale','id_ID',true);
  meta('twitter:card','summary'); meta('twitter:title',title); meta('twitter:description',description);
  let link=document.head.querySelector('link[rel="canonical"]');
  if (!link) { link=document.createElement('link'); link.rel='canonical'; document.head.append(link); }
  link.href=canonical;
}
