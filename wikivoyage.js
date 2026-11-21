// =====================================================================
// wikivoyage.js : les activités lues dans le guide libre Wikivoyage
// =====================================================================
// Wikivoyage (de la famille Wikipédia) est gratuit, sans compte ni clé.
// Ses pages contiennent des fiches « Voir », « Faire », « Manger »… avec
// le nom, le site web, le prix, les horaires et une description.
// Ce fichier lit ces fiches, devine la catégorie et le besoin de
// réservation, puis choisit celles qui vont le mieux à ton voyage.
// Contenu Wikivoyage : licence CC BY-SA (la source est citée dans l'appli).
// =====================================================================

import { lirePrix } from "./devises.js";

// ---------- 1. Interroger Wikivoyage ----------------------------------

async function api(langue, params) {
  const u = new URL(`https://${langue}.wikivoyage.org/w/api.php`);
  for (const [k, v] of Object.entries({ ...params, format: "json", formatversion: 2, origin: "*" })) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) throw new Error("Wikivoyage ne répond pas (erreur " + r.status + "). Réessaie dans un instant.");
  return r.json();
}

// Retrouve la page d'une destination : nom exact d'abord, sinon recherche
async function trouverPage(langue, destination) {
  const exact = await api(langue, { action: "query", titles: destination, redirects: 1 });
  const page = exact.query?.pages?.[0];
  if (page && !page.missing && !page.invalid) return page.title;
  const r = await api(langue, { action: "query", list: "search", srsearch: destination, srlimit: 1, srnamespace: 0 });
  return r.query?.search?.[0]?.title || null;
}

// Lit le texte source de plusieurs pages en une seule demande
async function lirePages(langue, titres) {
  const d = await api(langue, {
    action: "query", prop: "revisions|langlinks", rvprop: "content", rvslots: "main",
    lllang: "en", titles: titres.join("|"), redirects: 1,
  });
  return (d.query?.pages || [])
    .filter((p) => !p.missing && p.revisions)
    .map((p) => ({ titre: p.title, texte: p.revisions[0].slots.main.content, en: p.langlinks?.[0]?.title }));
}

// Les grandes villes sont découpées en quartiers : "Paris/Montmartre"…
async function sousPages(langue, titre) {
  const d = await api(langue, { action: "query", list: "prefixsearch", pssearch: titre + "/", pslimit: 20 });
  // La recherche est approximative ("Barcelone/" trouve aussi "Barcelonnette") : on ne garde que les vraies sous-pages
  return (d.query?.prefixsearch || []).map((p) => p.title).filter((t) => t.startsWith(titre + "/")).slice(0, 12);
}

// ---------- 2. Lire les fiches dans le texte source -------------------

// Trouve la fin d'un modèle {{…}} en tenant compte des modèles imbriqués
function finModele(texte, debut) {
  let profondeur = 0;
  for (let i = debut; i < texte.length - 1; i++) {
    if (texte[i] === "{" && texte[i + 1] === "{") { profondeur++; i++; }
    else if (texte[i] === "}" && texte[i + 1] === "}") { profondeur--; i++; if (profondeur === 0) return i + 1; }
  }
  return -1;
}

// Coupe "a=1 | b={{x|y}} | c=[[d|e]]" aux "|" qui ne sont pas imbriqués
function couperParametres(corps) {
  const morceaux = [];
  let niveau = 0, courant = "";
  for (let i = 0; i < corps.length; i++) {
    const deux = corps.slice(i, i + 2);
    if (deux === "{{" || deux === "[[") { niveau++; courant += deux; i++; continue; }
    if ((deux === "}}" || deux === "]]") && niveau > 0) { niveau--; courant += deux; i++; continue; }
    if (corps[i] === "|" && niveau === 0) { morceaux.push(courant); courant = ""; continue; }
    courant += corps[i];
  }
  morceaux.push(courant);
  const params = {};
  for (const m of morceaux.slice(1)) {
    const egal = m.indexOf("=");
    if (egal > 0) params[m.slice(0, egal).trim().toLowerCase()] = m.slice(egal + 1).trim();
  }
  return params;
}

const decodeur = document.createElement("textarea");
// Transforme le code wiki en texte lisible
function nettoyer(v) {
  if (!v) return "";
  let s = v;
  for (let n = 0; n < 3; n++) {
    s = s.replace(/\{\{\s*(prix|price)\s*\|([^{}]*)\}\}/gi, (_, __, p) => p.split("|").filter((x) => !x.includes("=")).join(" "));
    s = s.replace(/\{\{\s*-?(s|siècle|sp)\s*\|\s*([IVXLC]+)[^{}]*\}\}/g, "$2e siècle"); // {{s|XVII}} -> XVIIe siècle
    s = s.replace(/\{\{\s*(er|re|e|ers|res|es)\s*\}\}/g, "$1"); // {{er}} -> er
    s = s.replace(/\{\{[^{}]*\}\}/g, "");
  }
  s = s
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/\S+\]/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/'{2,}/g, "")
    .replace(/\(\s*[,;]?\s*\)/g, "") // parenthèses vidées par le retrait des modèles
    .replace(/\s+/g, " ")
    .trim();
  decodeur.innerHTML = s;
  return decodeur.value;
}

// Types de fiches : français et anglais
const TYPES = {
  voir: "voir", see: "voir",
  faire: "faire", do: "faire",
  manger: "manger", eat: "manger",
  sortir: "sortir", drink: "sortir",
  acheter: "acheter", buy: "acheter",
};

function lireFiches(texte, langue) {
  const fiches = [];
  const re = /\{\{\s*(voir|see|faire|do|manger|eat|sortir|drink|acheter|buy|listing)\s*\|/gi;
  let m;
  while ((m = re.exec(texte))) {
    const fin = finModele(texte, m.index);
    if (fin < 0) break;
    const p = couperParametres(texte.slice(m.index + 2, fin - 2));
    re.lastIndex = fin;
    const type = TYPES[m[1].toLowerCase()] || TYPES[(p.type || "").toLowerCase()];
    if (!type) continue;
    const nom = nettoyer(p.nom || p.name);
    if (!nom) continue;
    fiches.push({
      type, nom, langue,
      url: (p.url || "").trim(),
      prix: nettoyer(p.prix || p.price),
      horaire: nettoyer(p.horaire || p.hours),
      description: nettoyer(p.description || p.content),
      notable: Boolean(p.wikidata || p["wikipédia"] || p.wikipedia),
      wikidata: /^Q\d+$/.test((p.wikidata || "").trim()) ? p.wikidata.trim() : null,
      maj: (p["mise à jour"] || p.lastedit || "").slice(0, 4),
      ...coordonnees(p.latitude ?? p.lat, p.longitude ?? p.long),
    });
  }
  return fiches;
}

// Position d'une fiche (pour la carte) : { lat, lon } ou rien si absente ou invalide
function coordonnees(lat, lon) {
  const la = parseFloat(String(lat ?? "").replace(",", ".")), lo = parseFloat(String(lon ?? "").replace(",", "."));
  if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180 || (la === 0 && lo === 0)) return { lat: null, lon: null };
  return { lat: la, lon: lo };
}

// Écarte les positions aberrantes (erreur de saisie dans le guide) : à plus de 60 km du centre des autres
function nettoyerPositions(fiches) {
  const avec = fiches.filter((f) => f.lat != null);
  if (avec.length < 3) return;
  const mediane = (t) => { const s = [...t].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const centre = { lat: mediane(avec.map((f) => f.lat)), lon: mediane(avec.map((f) => f.lon)) };
  for (const f of avec) {
    const dLat = (f.lat - centre.lat) * 111, dLon = (f.lon - centre.lon) * 111 * Math.cos((centre.lat * Math.PI) / 180);
    if (Math.hypot(dLat, dLon) > 60) { f.lat = null; f.lon = null; }
  }
}

// Le premier paragraphe de la page sert de résumé
function resumePage(texte) {
  const lignes = texte.split("\n").map((l) => l.trim());
  const ligne = lignes.find((l) => l.startsWith("'''") && l.length > 40) || lignes.find((l) => /^[A-ZÀ-Ý']/.test(l) && l.length > 80 && !l.startsWith("{{"));
  const s = nettoyer(ligne || "");
  return s.length > 450 ? s.slice(0, 447) + "…" : s;
}

// ---------- 3. Catégorie, prix, réservation ---------------------------

const MOTS_CATEGORIE = [
  ["Parc et loisirs", /\b(zoo|aquarium|parc d'attractions|parc aquatique|amusement|theme park|water park|fête foraine)/],
  ["Nature", /\b(parc|jardin|plage|montagne|randonn|lac|cascade|forêt|réserve naturelle|colline|belvédère|park|garden|beach|hike|hiking|mountain|lake|waterfall|forest)/],
  ["Spectacle", /\b(théâtre|opéra|concert|spectacle|flamenco|cabaret|cinéma|theatre|theater|opera|show)/],
  ["Détente", /\b(spa|thermes|hammam|bains|piscine|thermal|baths|pool)/],
  ["Shopping et marchés", /\b(marché|market|halles|boutique|shopping)/],
  ["Sport et aventure", /\b(vélo|kayak|surf|plongée|escalade|accrobranche|voile|ski|stade|bike|cycling|diving|climbing|sailing|stadium|tour en)/],
  ["Culture", /\b(musée|museum|hôtel de ville|mairie|town hall|église|cathédrale|basilique|palais|château|monument|temple|mosquée|abbaye|galerie|church|cathedral|palace|castle|gallery|historique|historic)/],
];

function categorie(f) {
  if (f.type === "manger") return "Gastronomie";
  if (f.type === "sortir") return "Fête et vie nocturne";
  if (f.type === "acheter") return "Shopping et marchés";
  // Le nom d'abord (« Château… » est de la culture même si la description parle du lac), puis la description
  const nom = f.nom.toLowerCase(), t = (f.nom + " " + f.description).toLowerCase();
  for (const [cat, re] of MOTS_CATEGORIE) if (re.test(nom)) return cat;
  for (const [cat, re] of MOTS_CATEGORIE) if (re.test(t)) return cat;
  return f.type === "voir" ? "Culture" : "Sport et aventure";
}

// Prix par personne lu dans le texte, dans sa devise (« 500 TL ») puis converti dans celle du voyage.
// prixLocal : le vrai prix sur place ; prixPersonne : sa conversion (null si prix ou taux inconnu)
function lirePrixFiche(f, voyage, change) {
  const { montant, devise } = lirePrix(f.prix, change?.locale || null);
  f.prixLocal = montant;
  f.devisePrix = devise || voyage.devise;
  f.prixPersonne = change ? change.convertir(montant, f.devisePrix) : (f.devisePrix === voyage.devise ? montant : null);
}

function reservation(f, prix) {
  const t = (f.prix + " " + f.horaire + " " + f.description).toLowerCase();
  if (/réservation obligatoire|sur réservation|uniquement sur rendez-vous|reservations? (are |is )?(required|mandatory|essential)|must (be )?book|book (well |far )?(in )?advance|réserver (bien |longtemps )?à l'avance|weeks in advance|semaines à l'avance/.test(t)) {
    return ["obligatoire", "Le guide Wikivoyage indique qu'il faut réserver à l'avance."];
  }
  if (/réserv|reserv|book|billet|ticket|en ligne|online|file d'attente|queue|coupe-file/.test(t)) {
    return ["conseillee", "Le guide parle de billets ou de réservation : réserve en ligne pour éviter l'attente."];
  }
  if (prix === 0) return ["sur_place", "Accès libre, pas de réservation."];
  return ["inconnu", "Pas d'information sur la réservation : vérifie sur le site."];
}

// ---------- 4. Choisir les activités selon le voyage ------------------

const MOTS_PROFIL = {
  "famille-petits": {
    plus: /zoo|aquarium|parc|plage|jardin|enfant|children|kids|famil|science|ferme|bateau|téléphérique|funiculaire|manège|carrousel|beach|boat|cable car/,
    moins: /bar\b|discothèque|boîte de nuit|nightclub|casino|pub\b|cocktail|vin\b|wine|dégustation/,
  },
  "famille-ados": {
    plus: /parc d'attractions|aventure|surf|kayak|vélo|escalade|accrobranche|escape|stade|sport|science|téléphérique|street art|graffiti|adventure|bike|stadium/,
    moins: /casino|nightclub|discothèque/,
  },
  couple: { plus: /vue|panorama|coucher de soleil|sunset|romanti|spa|croisière|jardin|vin\b|cave|rooftop|terrasse|view|cruise|wine/, moins: /enfants?\b|kids|children/ },
  amis: { plus: /bar\b|tapas|vélo|kayak|randonn|festival|concert|stade|nightlife|soirée|brasserie|bière|beer|bike/, moins: /enfants?\b|kids/ },
  solo: { plus: /visite guidée|free tour|walking tour|musée|quartier|marché|randonn|museum|market|neighbourhood|neighborhood/, moins: /enfants?\b|kids/ },
  seniors: { plus: /musée|croisière|jardin|cathédrale|basilique|bateau|panorama|museum|cruise|garden|cathedral/, moins: /escalade|accrobranche|saut\b|bungee|nightclub|discothèque/ },
};

const INTERET_VERS_CATEGORIE = {
  Culture: "Culture", Nature: "Nature", Gastronomie: "Gastronomie", "Sport et aventure": "Sport et aventure",
  Détente: "Détente", Spectacles: "Spectacle", "Vie nocturne": "Fête et vie nocturne",
  Shopping: "Shopping et marchés", "Parcs de loisirs": "Parc et loisirs",
};

function score(f, voyage) {
  const cats = voyage.interets.map((i) => INTERET_VERS_CATEGORIE[i]).filter(Boolean);
  const t = (f.nom + " " + f.description).toLowerCase();
  let s = f.type === "voir" || f.type === "faire" ? 3 : 1;
  if (f.url) s += 2;
  if (f.description.length > 40) s += 1;
  if (f.notable) s += 2;
  if (Number(f.maj) >= 2022) s += 1;
  if (cats.includes(f.categorie)) s += 3;
  if (voyage.interets.includes("Insolite") && /insolite|étrange|secret|unusual|quirky|hidden/.test(t)) s += 3;
  const p = MOTS_PROFIL[voyage.profil];
  if (p?.plus.test(t)) s += 2;
  if (p?.moins.test(t)) s -= 5;
  if (horsSaison(f, voyage)) s -= 20;
  if (/^h[oô]tel (?!de ville)/.test(f.nom.toLowerCase())) s -= 6; // un hôtel classé en « Voir » n'est pas une activité
  return s;
}

// Un festival ou un événement dont le texte cite d'autres mois que ceux du séjour
const MOIS = [
  /janvier|january/, /février|february/, /mars\b|march\b/, /avril|april/, /\bmai\b|\bmay\b/, /juin|june/,
  /juillet|july/, /août|august/, /septembre|september/, /octobre|october/, /novembre|november/, /décembre|december/,
];
function horsSaison(f, voyage) {
  const t = (f.nom + " " + f.description + " " + f.horaire).toLowerCase();
  if (f.type !== "faire" && !/festival|fête|feria|carnaval|carnival|événement|event|fiesta|parade|procession|biennale|foire|salon/.test(t)) return false;
  const cites = MOIS.map((re, i) => (re.test(t) ? i : -1)).filter((i) => i >= 0);
  if (!cites.length) return false;
  const sejour = new Set();
  for (let d = new Date(voyage.debut); d <= new Date(voyage.fin); d.setDate(d.getDate() + 1)) sejour.add(d.getMonth());
  return !cites.some((m) => sejour.has(m));
}

// Restaurants, bars et boutiques seulement si l'intérêt est coché
function typeAutorise(f, voyage) {
  if (f.type === "manger") return voyage.interets.includes("Gastronomie");
  if (f.type === "sortir") return voyage.interets.includes("Vie nocturne") && voyage.profil !== "famille-petits";
  if (f.type === "acheter") return voyage.interets.includes("Shopping");
  return true;
}

// Prix total pour le groupe : les enfants comptés à moitié prix (estimation)
function prixGroupe(pp, voyage) {
  if (pp == null) return null;
  return Math.round(pp * (voyage.adultes + 0.5 * voyage.agesEnfants.length));
}

// Même lieu dans les deux langues : même identifiant Wikidata, sinon même nom sans accents
function cleFiche(f) {
  return f.wikidata || f.nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Fiches commerciales qu'on écarte (enterrements de vie de garçon/fille, photographes…)
const PUBLICITE = /\bevjf\b|\bevg\b|enterrement de vie|bachelor|stag (do|party)|hen (do|party)|photographe|photo ?shoot/;

// ---------- 5. Point d'entrée -----------------------------------------

// Renvoie { titre, url, langue, resume, candidates: [fiches classées] }
export async function chercherWikivoyage(voyage, suivi = () => {}, change = null) {
  suivi("Recherche de la destination dans le guide Wikivoyage…");
  let langue = "fr";
  let titre = await trouverPage("fr", voyage.destination);
  let fiches = [], resume = "", titreEn = null;

  if (titre) {
    const quartiers = await sousPages("fr", titre);
    suivi(`Lecture de la page « ${titre} »${quartiers.length ? ` et de ${quartiers.length} quartier(s)` : ""}…`);
    const pages = await lirePages("fr", [titre, ...quartiers]);
    const principale = pages.find((p) => p.titre === titre) || pages[0];
    resume = principale ? resumePage(principale.texte) : "";
    titreEn = principale?.en || null;
    for (const p of pages) fiches.push(...lireFiches(p.texte, "fr"));
  }

  // Le Wikivoyage anglais est souvent plus complet (prix, horaires) :
  // il complète les fiches françaises et ajoute celles qui manquent
  const en = titreEn || (await trouverPage("en", voyage.destination));
  if (en) {
    suivi(`Complément avec le guide en anglais (« ${en} »)…`);
    try {
      const quartiers = await sousPages("en", en);
      const pages = await lirePages("en", [en, ...quartiers]);
      const parCle = new Map(fiches.map((f) => [cleFiche(f), f]));
      for (const p of pages) {
        for (const f of lireFiches(p.texte, "en")) {
          const fr = parCle.get(cleFiche(f));
          if (fr) {
            if (!fr.prix && f.prix) { fr.prix = f.prix; fr.prixAnglais = true; }
            if (!fr.horaire && f.horaire) fr.horaire = f.horaire;
            // La fiche anglaise est plus récente : son lien a plus de chances d'être à jour
            if (f.url && (!fr.url || f.maj > fr.maj)) fr.url = f.url;
            if (f.maj > fr.maj) fr.maj = f.maj;
            if (fr.lat == null && f.lat != null) { fr.lat = f.lat; fr.lon = f.lon; }
          } else {
            fiches.push(f);
            parCle.set(cleFiche(f), f);
          }
        }
      }
      if (!titre) { titre = en; langue = "en"; resume = pages[0] ? resumePage(pages[0].texte) : ""; }
    } catch {
      // le complément anglais est facultatif
    }
  }
  if (!titre) return null;

  // Enlève les doublons et les fiches publicitaires, calcule catégorie, prix et score
  const vus = new Set();
  const candidates = [];
  for (const f of fiches) {
    const cle = cleFiche(f);
    if (vus.has(cle) || !typeAutorise(f, voyage) || PUBLICITE.test((f.nom + " " + f.description).toLowerCase())) continue;
    vus.add(cle);
    f.categorie = categorie(f);
    lirePrixFiche(f, voyage, change);
    f.score = score(f, voyage);
    candidates.push(f);
  }
  candidates.sort((a, b) => b.score - a.score);
  candidates.forEach((f, i) => (f.id = i + 1));
  nettoyerPositions(candidates);

  return {
    titre, langue, resume, candidates,
    url: `https://${langue}.wikivoyage.org/wiki/${encodeURIComponent(titre.replace(/ /g, "_"))}`,
  };
}

export function budgetActivites(voyage) {
  return voyage.typeBudget === "total" ? Math.round(voyage.budget * 0.25) : voyage.budget;
}

// TOUTES les fiches qui conviennent, sans limite de nombre :
// - qui correspondent à au moins un centre d'intérêt coché (toutes si aucun n'est coché) ;
// - pas hors saison ni déconseillées pour le profil ;
// - dont le prix seul ne dépasse pas tout le budget activités.
// Renvoie { fiches, interetsSansResultat } (classées de la plus adaptée à la moins adaptée)
export function selectionner(voyage, wv) {
  const budget = budgetActivites(voyage);
  const cats = voyage.interets.map((i) => INTERET_VERS_CATEGORIE[i]).filter(Boolean);
  const correspond = (f) =>
    cats.includes(f.categorie) ||
    (voyage.interets.includes("Insolite") && /insolite|étrange|secret|unusual|quirky|hidden/.test((f.nom + " " + f.description).toLowerCase()));

  let fiches = wv.candidates.filter((f) => f.score >= 0);
  let interetsSansResultat = false;
  if (voyage.interets.length) {
    const filtrees = fiches.filter(correspond);
    if (filtrees.length) fiches = filtrees;
    else interetsSansResultat = true; // rien pour ces centres d'intérêt : on montre tout plutôt qu'une page vide
  }
  fiches = fiches.filter((f) => {
    const prix = prixGroupe(f.prixPersonne, voyage);
    return prix == null || prix <= budget;
  });
  return { fiches, interetsSansResultat };
}

// Construit le résultat final sans IA, au même format que celui de Gemini
export function resultatSansIA(voyage, wv) {
  const { fiches, interetsSansResultat } = selectionner(voyage, wv);
  const choisies = fiches.map((f) => versActivite(f, voyage));
  return {
    avertissement: interetsSansResultat ? "Le guide n'a pas de fiche pour les centres d'intérêt cochés : voici toutes les activités de la destination." : null,
    destination: wv.titre,
    resume: wv.resume,
    meteo: null,
    budget_activites: budgetActivites(voyage),
    explication_budget: voyage.typeBudget === "total"
      ? "Sans IA, l'appli réserve 25 % du budget total aux activités (le reste pour le transport et le logement)."
      : null,
    activites: choisies,
    conseils: [],
    transport: null,
    logement: null,
    note_prix: "Prix lus dans le guide Wikivoyage, parfois anciens ; enfants comptés à moitié prix. Coche les activités que tu choisis pour suivre ton budget.",
  };
}

// Convertit une fiche Wikivoyage en activité affichable
export function versActivite(f, voyage) {
  const prix = prixGroupe(f.prixPersonne, voyage);
  const [resa, conseil] = reservation(f, f.prixPersonne);
  return {
    nom: f.nom,
    categorie: f.categorie,
    description: f.description.length > 280 ? f.description.slice(0, 277) + "…" : f.description,
    pourquoi: null,
    quand: f.horaire || null,
    duree: null,
    prix_total: prix,
    // Prix dans la monnaie du pays (le vrai prix sur place), quand elle diffère de celle du voyage
    prix_local_total: f.devisePrix && f.devisePrix !== voyage.devise && f.prixLocal != null ? prixGroupe(f.prixLocal, voyage) : null,
    devise_locale: f.devisePrix && f.devisePrix !== voyage.devise ? f.devisePrix : null,
    prix_detail: f.prix ? f.prix + (f.prixAnglais ? " (guide anglais)" : "") : "Prix non indiqué dans le guide",
    reservation: resa,
    conseil_reservation: conseil,
    lien: f.url || null,
    evenement_ponctuel: false,
    lat: f.lat ?? null,
    lon: f.lon ?? null,
    source: f.maj ? `Wikivoyage${f.langue === "en" ? " (anglais)" : ""}, fiche mise à jour en ${f.maj}` : `Wikivoyage${f.langue === "en" ? " (anglais)" : ""}`,
  };
}
