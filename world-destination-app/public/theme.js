// Applique le thème choisi (clair/sombre) avant l'affichage, pour éviter un flash.
// Fichier séparé (et non script en ligne) pour respecter la politique de sécurité du contenu.
try {
  var t = localStorage.getItem('wd-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
