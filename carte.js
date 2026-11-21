// =====================================================================
// carte.js : la carte des activités (onglet « Carte »)
// =====================================================================
// Carte OpenStreetMap (gratuite) affichée avec la bibliothèque Leaflet,
// comme dans l'appli Where to Surf. Chaque activité est un point :
// - gris : pas encore prévue ;
// - en couleur : prévue, une couleur par jour du séjour (voir la légende),
//   pour regrouper le même jour les activités proches les unes des autres ;
// - vert foncé : prévue, jour pas encore fixé.
// Les positions viennent du guide Wikivoyage ; certaines activités n'en ont pas.
// =====================================================================

const COULEURS_JOURS = ["#1f6fb4", "#c0392b", "#7b3fa0", "#e67e22", "#16a085", "#c2185b", "#5d4037", "#2e4057"];
const COULEUR_SANS_JOUR = "#2d6a3e";
const COULEUR_PAS_PREVUE = "#8f847b";

let chargement = null;
// Leaflet n'est chargé qu'à la première ouverture de la carte
function chargerLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (chargement) return chargement;
  chargement = new Promise((ok, ko) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.append(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.onload = () => ok(window.L);
    js.onerror = () => { chargement = null; ko(new Error("La carte n'a pas pu se charger. Vérifie ta connexion internet.")); };
    document.head.append(js);
  });
  return chargement;
}

function texte(balise, contenu, classe) {
  const e = document.createElement(balise);
  e.textContent = contenu;
  if (classe) e.className = classe;
  return e;
}

// zone : l'élément où dessiner ; jours : [["2026-12-10", "jeudi 10 décembre"], …]
// infos(a) -> { prevu, jour, montantTexte } ; ouvrirFiche(index) : montre la carte de l'activité dans la liste
// Renvoie une fonction maj() à appeler quand les coches changent
export async function creerCarte(zone, activites, jours, infos, ouvrirFiche) {
  const L = await chargerLeaflet();
  const placees = activites.map((a, i) => ({ a, i })).filter(({ a }) => typeof a.lat === "number" && typeof a.lon === "number");
  const sansPosition = activites.length - placees.length;

  const conteneur = document.createElement("div");
  conteneur.className = "plan";
  const legende = document.createElement("div");
  legende.className = "legende";
  const note = texte("p", "", "meta");

  // Choix d'affichage : toutes les activités proposées, ou seulement celles qui sont prévues
  let seulementPrevues = false;
  try { seulementPrevues = localStorage.getItem("carte-seulement-prevues") === "oui"; } catch {}
  const choix = document.createElement("div");
  choix.className = "choix-carte";
  choix.setAttribute("role", "group");
  choix.setAttribute("aria-label", "Activités affichées sur la carte");
  const boutonToutes = texte("button", "Toutes les activités proposées", "chip");
  const boutonPrevues = texte("button", "Seulement les activités prévues", "chip");
  for (const [b, valeur] of [[boutonToutes, false], [boutonPrevues, true]]) {
    b.type = "button";
    b.addEventListener("click", () => {
      if (seulementPrevues === valeur) return;
      seulementPrevues = valeur;
      try { localStorage.setItem("carte-seulement-prevues", valeur ? "oui" : "non"); } catch {}
      maj();
      cadrer();
    });
    choix.append(b);
  }
  zone.replaceChildren(choix, conteneur, legende, note);

  if (!placees.length) {
    conteneur.remove();
    choix.remove();
    note.textContent = "Aucune activité n'a de position dans le guide pour cette destination. Relance la recherche si ces résultats datent d'avant l'ajout de la carte.";
    return () => {};
  }

  const carte = L.map(conteneur, { scrollWheelZoom: false });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(carte);
  const calque = L.layerGroup().addTo(carte);
  // Cadrage sur le cœur des activités : les 80 % les plus proches du centre
  // (les excursions lointaines restent sur la carte, visibles en dézoomant)
  const mediane = (t) => { const s = [...t].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const centre = L.latLng(mediane(placees.map(({ a }) => a.lat)), mediane(placees.map(({ a }) => a.lon)));
  const parDistance = [...placees].sort((x, y) => centre.distanceTo([x.a.lat, x.a.lon]) - centre.distanceTo([y.a.lat, y.a.lon]));
  const coeur = parDistance.slice(0, Math.max(2, Math.ceil(parDistance.length * 0.8)));
  // Activités prévues : on cadre sur toutes, même lointaines ; sinon sur le cœur des activités
  const cadrer = () => {
    const prevues = placees.filter(({ a }) => infos(a).prevu);
    const cible = seulementPrevues && prevues.length ? prevues : coeur;
    carte.fitBounds(L.latLngBounds(cible.map(({ a }) => [a.lat, a.lon])), { padding: [30, 30], maxZoom: 15 });
  };

  const couleurJour = Object.fromEntries(jours.map(([iso], n) => [iso, COULEURS_JOURS[n % COULEURS_JOURS.length]]));

  const maj = () => {
    calque.clearLayers();
    const joursUtilises = new Set();
    let sansJour = false;
    boutonToutes.setAttribute("aria-pressed", String(!seulementPrevues));
    boutonPrevues.setAttribute("aria-pressed", String(seulementPrevues));
    const visibles = seulementPrevues ? placees.filter(({ a }) => infos(a).prevu) : placees;
    // Les activités prévues sont dessinées en dernier, donc au-dessus des autres
    const ordre = [...visibles].sort((x, y) => Number(infos(x.a).prevu) - Number(infos(y.a).prevu));
    for (const { a, i } of ordre) {
      const etat = infos(a);
      const couleur = !etat.prevu ? COULEUR_PAS_PREVUE : etat.jour ? couleurJour[etat.jour] || COULEUR_SANS_JOUR : COULEUR_SANS_JOUR;
      if (etat.prevu && etat.jour) joursUtilises.add(etat.jour);
      if (etat.prevu && !etat.jour) sansJour = true;

      const point = L.circleMarker([a.lat, a.lon], {
        radius: etat.prevu ? 10 : 7,
        color: "#fff", weight: 2,
        fillColor: couleur, fillOpacity: etat.prevu ? 1 : 0.85,
      }).addTo(calque);
      point.bindTooltip(a.nom);

      // Bulle d'informations (construite sans HTML pour éviter tout code dans les textes du guide)
      const bulle = document.createElement("div");
      bulle.className = "bulle";
      bulle.append(texte("b", a.nom));
      const lignes = [a.categorie, etat.montantTexte].filter(Boolean).join(" · ");
      if (lignes) bulle.append(texte("div", lignes));
      bulle.append(texte("div", etat.prevu ? "✓ Prévu" + (etat.jour ? " le " + jours.find(([iso]) => iso === etat.jour)?.[1] : " (jour à fixer)") : "Pas encore prévu", "meta"));
      const bouton = texte("button", "Voir la fiche");
      bouton.type = "button";
      bouton.addEventListener("click", () => ouvrirFiche(i));
      bulle.append(bouton);
      point.bindPopup(bulle);
    }

    // Légende : seulement ce qui est affiché
    const elements = seulementPrevues ? [] : [[COULEUR_PAS_PREVUE, "Pas encore prévue"]];
    if (sansJour) elements.push([COULEUR_SANS_JOUR, "Prévue, jour à fixer"]);
    for (const [iso, nom] of jours) if (joursUtilises.has(iso)) elements.push([couleurJour[iso], nom]);
    legende.replaceChildren(...elements.map(([c, t]) => {
      const item = texte("span", t);
      const pastille = document.createElement("i");
      pastille.style.background = c;
      item.prepend(pastille);
      return item;
    }));
    if (seulementPrevues) {
      const prevuesSansPosition = activites.filter((a) => infos(a).prevu && typeof a.lat !== "number").length;
      note.textContent = !visibles.length
        ? "Aucune activité prévue pour l'instant : coche « Prévu / réservé » sur les fiches pour les voir ici."
        : `${visibles.length} activité(s) prévue(s) sur la carte.` + (prevuesSansPosition ? ` ${prevuesSansPosition} autre(s) prévue(s) sans position dans le guide.` : "");
    } else {
      note.textContent = (sansPosition ? `${sansPosition} activité(s) sans position dans le guide ne sont pas sur la carte. ` : "") +
        "Astuce : coche « Prévu » et choisis le jour sur les fiches : les points prennent la couleur du jour.";
    }
  };

  maj();
  cadrer();
  // La carte est créée dans une zone qui vient d'apparaître : on recalcule sa taille
  setTimeout(() => carte.invalidateSize(), 50);
  maj.carte = carte;
  return maj;
}
