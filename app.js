// =====================================================================
// app.js : le formulaire, l'affichage des résultats et les réglages
// =====================================================================
import { liensTransport, liensLogement } from "./liens.js";
import { listeVoyages, lireVoyage, enregistrerVoyage, supprimerVoyage, exporter, importer, migrerAncienneVersion } from "./voyages.js";
import { preparerChange, formaterLocal } from "./devises.js";

const $ = (id) => document.getElementById(id);
const INTERETS = ["Culture", "Nature", "Gastronomie", "Sport et aventure", "Détente", "Spectacles", "Vie nocturne", "Shopping", "Parcs de loisirs", "Insolite"];

// --- Petite mémoire du navigateur (rien n'est envoyé ailleurs) -------
const memoire = {
  lire(cle) { try { return localStorage.getItem(cle); } catch { return null; } },
  ecrire(cle, valeur) { try { valeur == null ? localStorage.removeItem(cle) : localStorage.setItem(cle, valeur); } catch {} },
};

// --- Création d'éléments HTML sans risque (le texte n'est jamais interprété comme du code)
function el(balise, attrs = {}, ...enfants) {
  const e = document.createElement(balise);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }
  for (const c of enfants.flat()) if (c != null && c !== false) e.append(c);
  return e;
}

// N'accepte que les vrais liens web (pas de "javascript:" ou autre)
function lienSur(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch { return null; }
}

function lienExterne(url, texte, classe) {
  return el("a", { href: url, target: "_blank", rel: "noopener noreferrer", class: classe }, texte);
}

function montant(n, devise) {
  if (typeof n !== "number" || !isFinite(n)) return "Prix ?";
  if (n === 0) return "Gratuit";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise, maximumFractionDigits: 0 }).format(n);
}

// ===================== Formulaire ===================================

const interetsChoisis = new Set();

function construireInterets() {
  for (const nom of INTERETS) {
    const b = el("button", { type: "button", class: "chip", "aria-pressed": "false" }, nom);
    b.addEventListener("click", () => {
      interetsChoisis.has(nom) ? interetsChoisis.delete(nom) : interetsChoisis.add(nom);
      b.setAttribute("aria-pressed", interetsChoisis.has(nom));
    });
    $("interets").append(b);
  }
}

function majAges() {
  $("bloc-ages").hidden = Number($("enfants").value) <= 0;
}

// Choisir un profil propose un nombre de voyageurs cohérent
const VOYAGEURS_PAR_PROFIL = { solo: [1, 0], couple: [2, 0], amis: [4, 0], "famille-petits": [2, 2], "famille-ados": [2, 2], seniors: [2, 0] };
function majProfil() {
  const [a, e] = VOYAGEURS_PAR_PROFIL[$("profil").value] || [2, 0];
  $("adultes").value = a;
  $("enfants").value = e;
  majAges();
}

function remplirFormulaire(v) {
  $("destination").value = v.destination || "";
  $("debut").value = v.debut || "";
  $("fin").value = v.fin || "";
  $("budget").value = v.budget ?? "";
  $("devise").value = v.devise || "EUR";
  $("type-budget").value = v.typeBudget || "activites";
  $("profil").value = v.profil || "couple";
  $("adultes").value = v.adultes ?? 2;
  $("enfants").value = v.agesEnfants?.length ?? 0;
  $("ages").value = (v.agesEnfants || []).join(", ");
  $("depart").value = v.depart || "";
  interetsChoisis.clear();
  for (const b of $("interets").children) {
    const actif = (v.interets || []).includes(b.textContent);
    if (actif) interetsChoisis.add(b.textContent);
    b.setAttribute("aria-pressed", actif);
  }
  majAges();
}

// Lit et vérifie le formulaire ; renvoie le voyage ou affiche l'erreur
function lireFormulaire() {
  const erreur = (msg) => { $("erreur-formulaire").textContent = msg; $("erreur-formulaire").hidden = false; return null; };
  $("erreur-formulaire").hidden = true;

  const destination = $("destination").value.trim();
  const debut = $("debut").value, fin = $("fin").value;
  const budget = Number($("budget").value);
  const adultes = Math.max(1, Math.round(Number($("adultes").value) || 1));
  const nbEnfants = Math.max(0, Math.round(Number($("enfants").value) || 0));
  const aujourdhui = new Date().toISOString().slice(0, 10);

  if (!destination) return erreur("Indique ta destination.");
  if (!debut || !fin) return erreur("Indique tes dates d'arrivée et de retour.");
  if (debut < aujourdhui) return erreur("La date d'arrivée est déjà passée.");
  if (fin <= debut) return erreur("La date de retour doit être après la date d'arrivée.");
  if (!(budget > 0)) return erreur("Indique ton budget (un nombre supérieur à 0).");

  const agesEnfants = $("ages").value.split(/[,;\s]+/).filter(Boolean).map(Number);
  if (nbEnfants > 0) {
    if (agesEnfants.length !== nbEnfants || agesEnfants.some((a) => !Number.isInteger(a) || a < 0 || a > 17)) {
      return erreur(`Indique l'âge de chacun des ${nbEnfants} enfant(s), entre 0 et 17 ans, séparés par des virgules.`);
    }
  }

  return {
    destination, debut, fin, budget, adultes,
    agesEnfants: nbEnfants > 0 ? agesEnfants : [],
    devise: $("devise").value,
    typeBudget: $("type-budget").value,
    profil: $("profil").value,
    interets: [...interetsChoisis],
    depart: $("depart").value.trim(),
  };
}

// ===================== Clé Gemini (facultative) ==================

function ouvrirReglagesCle() {
  $("cle").value = memoire.lire("cle-gemini") || "";
  $("dialogue-cle").showModal();
}

$("ouvrir-cle").addEventListener("click", ouvrirReglagesCle);
$("dialogue-cle").addEventListener("close", () => {
  if ($("dialogue-cle").returnValue === "ok") memoire.ecrire("cle-gemini", $("cle").value.trim() || null);
  majBoutonCle();
});
$("effacer-cle").addEventListener("click", () => { memoire.ecrire("cle-gemini", null); $("cle").value = ""; majBoutonCle(); });
function majBoutonCle() {
  $("ouvrir-cle").textContent = memoire.lire("cle-gemini") ? "✨ Gemini activé" : "✨ Ajouter Gemini";
}

// ===================== Recherche ====================================

let controleur = null;

async function lancerRecherche(evt) {
  evt.preventDefault();
  const voyage = lireFormulaire();
  if (!voyage) return;

  const cle = memoire.lire("cle-gemini");

  $("erreur").hidden = true;
  $("resultats").hidden = true;
  $("etapes").replaceChildren();
  $("progression").classList.add("actif");
  $("lancer").disabled = true;
  controleur = new AbortController();

  const suivi = (texte) => {
    const derniere = $("etapes").lastElementChild;
    if (derniere && derniere.textContent === texte) return;
    $("etapes").append(el("li", {}, texte));
    $("etapes").scrollTop = $("etapes").scrollHeight;
  };
  try {
    // 1. Les activités du guide Wikivoyage (gratuit, sans clé)
    const { chercherWikivoyage, resultatSansIA } = await import("./wikivoyage.js");
    // Monnaie du pays et taux de change du jour, pour convertir les prix locaux (TL, yens…)
    suivi("Monnaie du pays et taux de change du jour…");
    const change = await preparerChange(voyage);
    // En parallèle : les aéroports de départ et d'arrivée, pour le lien Skyscanner
    const vols = voyage.depart ? import("./aeroports.js").then((m) => m.codesVols(voyage.depart, voyage.destination)).catch(() => null) : null;
    let wv = null;
    try {
      wv = await chercherWikivoyage(voyage, suivi, change);
    } catch (e) {
      if (!cle) throw e;
      suivi("Wikivoyage ne répond pas, on continue avec Gemini seul.");
    }
    if (!wv && !cle) {
      throw new Error(`« ${voyage.destination} » est introuvable sur Wikivoyage. Essaie le nom de la ville en français ou en anglais (ex. « Lisbonne » ou « Lisbon »), ou ajoute une clé Gemini gratuite.`);
    }
    if (wv) suivi(`${wv.candidates.length} activité(s) trouvée(s) dans le guide.`);

    // 2. Le complément Gemini, si une clé gratuite est enregistrée
    let resultat;
    if (cle) {
      try {
        const { completerAvecGemini } = await import("./gemini.js");
        resultat = await completerAvecGemini(voyage, wv, cle, suivi, controleur.signal, change);
      } catch (e) {
        if (controleur.signal.aborted || !wv) throw e;
        resultat = resultatSansIA(voyage, wv);
        resultat.avertissement = e.message + " Voici les activités du guide Wikivoyage, sans le complément de Gemini.";
      }
    } else {
      resultat = resultatSansIA(voyage, wv);
    }
    if (wv) resultat.source_page = { titre: wv.titre, url: wv.url };
    resultat.vols = await vols;
    resultat.change = infosChange(change);
    if (wv && wv.candidates.length === 0 && !cle) {
      throw new Error("Le guide Wikivoyage n'a pas de fiches d'activités pour cette destination. Ajoute une clé Gemini gratuite pour avoir des propositions.");
    }
    // Les activités déjà prévues restent dans le voyage, même si la nouvelle recherche ne les propose plus
    if (idCourant) garderActivitesPrevues(idCourant, resultat);

    // Enregistre le voyage (nouveau, ou mise à jour du voyage ouvert : ses coches sont gardées)
    let id = idCourant;
    try {
      id = enregistrerVoyage(idCourant, voyage, resultat);
    } catch (e) {
      $("erreur").textContent = e.message;
      $("erreur").hidden = false;
    }
    if (estDemo && id) { location.assign("./#voyage/" + id); return; } // on quitte la démo pour le vrai voyage
    if (id && id !== idCourant) history.replaceState(null, "", "#voyage/" + id);
    idCourant = id;
    const voyageEnregistre = id ? { ...voyage, id } : voyage;
    majEntete(voyageEnregistre);
    replierFormulaire(true);
    afficherResultats(voyageEnregistre, resultat);
  } catch (e) {
    $("erreur").textContent = e.message;
    $("erreur").hidden = false;
  } finally {
    $("progression").classList.remove("actif");
    $("lancer").disabled = false;
    controleur = null;
  }
}

$("annuler").addEventListener("click", () => controleur?.abort());

// Quand on modifie les critères d'un voyage (centres d'intérêt, dates, budget…), la nouvelle
// recherche peut ne plus proposer une activité que tu avais cochée « Prévu ». On la reprend
// alors du voyage précédent, en tête de liste : elle ne s'en va que si tu la décoches.
function garderActivitesPrevues(id, resultat) {
  const precedent = lireVoyage(id);
  if (!precedent) return;
  const suivi = lireSuivi({ id });
  const norme = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  resultat.activites = Array.isArray(resultat.activites) ? resultat.activites : [];
  const proposees = new Map(resultat.activites.map((a) => [norme(a.nom), a]));
  const gardees = [];
  for (const a of precedent.resultat?.activites || []) {
    if (!suivi[a.nom]?.prevu) continue;
    const memeActivite = proposees.get(norme(a.nom));
    if (!memeActivite) gardees.push({ ...a, gardee: true });
    else if (memeActivite.nom !== a.nom) memeActivite.nom = a.nom; // même lieu, nom écrit autrement : on garde l'ancien pour retrouver la coche
  }
  resultat.activites = [...gardees, ...resultat.activites];
}

// ===================== Affichage des résultats ======================

// ----- Monnaie locale et conversion -----
// Le taux de change utilisé pour le voyage affiché (date et valeur, pour l'indiquer à côté des prix)
let changeAffiche = null;

// Ce qu'on garde du taux avec le voyage : seulement si la monnaie du pays diffère de celle du voyage
function infosChange(change) {
  if (!change?.locale || change.locale === change.base) return null;
  return { base: change.base, locale: change.locale, taux: change.tauxPour(change.locale), date: change.date, source: change.source, verifie: new Date().toISOString().slice(0, 10) };
}

function dateCourte(iso) {
  return iso ? new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";
}

// Prix en haut à droite d'une activité : le vrai prix en monnaie locale, puis sa conversion
function blocPrix(a, voyage) {
  const detail = a.prix_detail && el("small", {}, a.prix_detail);
  const local = typeof a.prix_local_total === "number" && a.devise_locale && a.devise_locale !== voyage.devise;
  if (!local) return el("div", { class: "prix" }, montant(a.prix_total, voyage.devise), detail);
  const conversion = typeof a.prix_total === "number"
    ? `≈ ${somme(a.prix_total, voyage.devise)}` + (changeAffiche?.date ? ` (taux du ${dateCourte(changeAffiche.date)})` : "")
    : "Conversion indisponible";
  return el("div", { class: "prix" },
    a.prix_local_total === 0 ? "Gratuit" : formaterLocal(a.prix_local_total, a.devise_locale),
    a.prix_local_total !== 0 && el("small", { class: "converti" }, conversion),
    detail);
}

// En rouvrant un voyage, on met à jour la conversion avec le taux du jour (le prix local, lui, ne change pas)
async function actualiserTaux(entree) {
  const r = entree.resultat, c = r?.change;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (!c?.locale || c.verifie === aujourdhui || entree.voyage.devise !== c.base) return false;
  const change = await preparerChange(entree.voyage);
  const taux = change.tauxPour(c.locale);
  if (!taux) return false;
  for (const a of r.activites || []) {
    if (typeof a.prix_local_total === "number" && a.devise_locale) {
      const converti = change.convertir(a.prix_local_total, a.devise_locale);
      if (converti != null) a.prix_total = Math.round(converti);
    }
  }
  r.change = { ...infosChange(change), verifie: aujourdhui };
  enregistrerVoyage(entree.id, entree.voyage, r);
  return true;
}

const LIBELLE_RESA = {
  obligatoire: "À réserver à l'avance",
  conseillee: "Réservation conseillée",
  sur_place: "Sans réservation",
  inconnu: "Réservation à vérifier",
};

// ===================== Suivi : activités prévues ou réservées =======
// Les coches sont gardées dans ce navigateur, pour chaque voyage
// (destination + dates) : on les retrouve en rouvrant l'appli.

// Le mode démo a sa propre mémoire : ses coches ne se mélangent pas à un vrai voyage aux mêmes dates
// Chaque voyage enregistré a son identifiant : ses coches restent même si tu changes ses dates
function cleVoyage(voyage) {
  if (voyage.demo) return "demo:" + voyage.debut;
  return voyage.id || [voyage.destination.trim().toLowerCase(), voyage.debut, voyage.fin].join("|");
}
function cleSuivi(voyage) {
  return "suivi:" + cleVoyage(voyage);
}

// Le montant compté pour une activité cochée : celui que tu as saisi,
// sinon le prix affiché en haut de la carte (qui suit le nombre de voyageurs).
// On ne garde en mémoire que les montants saisis à la main, jamais une copie du prix estimé.
function prixEstime(a) {
  return typeof a.prix_total === "number" ? a.prix_total : null;
}
function montantCompte(a, etat) {
  return etat?.montantPerso ?? prixEstime(a);
}
function lireSuivi(voyage) {
  try { return JSON.parse(memoire.lire(cleSuivi(voyage)) || "{}") || {}; } catch { return {}; }
}
function ecrireSuivi(voyage, suivi) {
  memoire.ecrire(cleSuivi(voyage), Object.keys(suivi).length ? JSON.stringify(suivi) : null);
}

// Les jours du séjour : [["2026-12-10", "jeudi 10 décembre"], …]
function joursSejour(voyage) {
  const jours = [];
  const fin = new Date(voyage.fin + "T12:00:00");
  for (let d = new Date(voyage.debut + "T12:00:00"); d <= fin; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    jours.push([iso, d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })]);
  }
  return jours;
}

// Un montant, "0 €" compris (montant() affiche "Gratuit" pour 0)
function somme(n, devise) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise, maximumFractionDigits: 0 }).format(n || 0);
}

// La case « Prévu / réservé », avec le jour et le montant réellement dépensé
function blocSuivi(a, voyage, suivi, quandChange) {
  const etat = suivi[a.nom] || {};
  const caseCochee = el("input", { type: "checkbox" });
  caseCochee.checked = Boolean(etat.prevu);

  const jour = el("select", { "aria-label": "Jour prévu pour " + a.nom },
    el("option", { value: "" }, "Jour pas encore fixé"),
    joursSejour(voyage).map(([iso, texte]) => el("option", { value: iso }, texte)));
  jour.value = etat.jour || "";

  const montantPaye = el("input", { type: "number", min: "0", step: "1", inputmode: "decimal", placeholder: "Montant", "aria-label": "Montant dépensé pour " + a.nom });
  montantPaye.value = montantCompte(a, etat) ?? "";
  const rappelEstime = el("span", { class: "meta" });
  const majRappel = () => {
    const perso = suivi[a.nom]?.montantPerso;
    rappelEstime.textContent = perso != null && prixEstime(a) != null && perso !== prixEstime(a) ? `(prix estimé : ${somme(prixEstime(a), voyage.devise)})` : "";
  };

  const details = el("div", { class: "suivi-details" }, jour, el("span", { class: "montant" }, montantPaye, " " + voyage.devise), rappelEstime);
  details.hidden = !caseCochee.checked;

  const enregistrer = () => {
    if (caseCochee.checked) {
      // Un montant identique au prix estimé, ou vide, n'est pas un montant saisi : on suit le prix estimé
      const saisi = montantPaye.value === "" ? null : Math.max(0, Number(montantPaye.value));
      suivi[a.nom] = { prevu: true, jour: jour.value || null, montantPerso: saisi === prixEstime(a) ? null : saisi };
    } else {
      delete suivi[a.nom];
      montantPaye.value = prixEstime(a) ?? ""; // décocher remet le prix estimé
    }
    details.hidden = !caseCochee.checked;
    majRappel();
    quandChange(caseCochee.checked);
  };
  majRappel();
  caseCochee.addEventListener("change", enregistrer);
  jour.addEventListener("change", enregistrer);
  montantPaye.addEventListener("input", enregistrer);

  return el("div", { class: "suivi" },
    el("label", { class: "coche" }, caseCochee, "Prévu / réservé"),
    details);
}

// ===================== Budget activités =============================
// Si le budget couvre tout le voyage, la part des activités est d'abord estimée
// (par Gemini, ou 25 % du budget sans Gemini). Dès que tu indiques ce que t'ont
// vraiment coûté le transport et le logement, ce sont ces montants qui sont déduits.

function creerBudget(r, voyage) {
  const estime = typeof r.budget_activites === "number" ? r.budget_activites : 0;
  const cle = "reel:" + cleVoyage(voyage);
  let reel = {};
  try { reel = JSON.parse(memoire.lire(cle) || "{}") || {}; } catch { reel = {}; }
  const ecouteurs = [];
  const toutLeVoyage = voyage.typeBudget === "total";
  const aDesMontantsReels = () => toutLeVoyage && (reel.transport != null || reel.logement != null);

  return {
    toutLeVoyage,
    reel: () => ({ ...reel }),
    activites() {
      if (!aDesMontantsReels()) return estime;
      return Math.max(0, voyage.budget - (reel.transport || 0) - (reel.logement || 0));
    },
    // Phrase qui explique d'où vient le budget activités
    explication() {
      const d = voyage.devise;
      if (!toutLeVoyage) return null;
      if (!aDesMontantsReels()) {
        return (r.explication_budget || `Estimation : ${somme(estime, d)} sur ton budget total de ${somme(voyage.budget, d)}.`) +
          " Une fois réservés, indique les vrais montants dans l'onglet « Transport et logement » pour recalculer.";
      }
      const parties = [`Budget total ${somme(voyage.budget, d)}`];
      if (reel.transport != null) parties.push(`transport ${somme(reel.transport, d)}`);
      if (reel.logement != null) parties.push(`logement ${somme(reel.logement, d)}`);
      const manque = reel.transport == null ? "transport" : reel.logement == null ? "logement" : null;
      return `${parties.join(" − ")} = ${somme(this.activites(), d)} pour les activités.` +
        (manque ? ` Le ${manque} n'est pas encore indiqué : il n'est pas déduit.` : "") +
        (voyage.budget - (reel.transport || 0) - (reel.logement || 0) < 0 ? " Attention : transport et logement dépassent déjà le budget total." : "");
    },
    definir(champ, valeur) {
      if (valeur == null) delete reel[champ]; else reel[champ] = valeur;
      memoire.ecrire(cle, Object.keys(reel).length ? JSON.stringify(reel) : null);
      for (const f of ecouteurs) f();
    },
    surChangement(f) { ecouteurs.push(f); },
  };
}

// La barre de budget qui se remplit avec les activités cochées
function afficherSuiviBudget(zone, activites, suivi, budgetVoyage, voyage) {
  const devise = voyage.devise;
  const budget = budgetVoyage.activites();
  const prevues = activites.filter((a) => suivi[a.nom]?.prevu);
  const depense = prevues.reduce((s, a) => s + (montantCompte(a, suivi[a.nom]) || 0), 0);
  const sansMontant = prevues.filter((a) => montantCompte(a, suivi[a.nom]) == null).length;
  const pct = budget > 0 ? (depense / budget) * 100 : 0;
  const reste = budget - depense;
  const nomsJours = Object.fromEntries(joursSejour(voyage));
  const programme = [...prevues].sort((x, y) => (suivi[x.nom].jour || "9999").localeCompare(suivi[y.nom].jour || "9999"));
  const ouvert = zone.querySelector("details")?.open;

  const infos = [
    prevues.length ? `${prevues.length} activité${prevues.length > 1 ? "s" : ""} prévue${prevues.length > 1 ? "s" : ""}` : "Coche « Prévu / réservé » sur les activités que tu as planifiées ou réservées.",
    budget > 0 && prevues.length && reste >= 0 ? `il reste ${somme(reste, devise)}` : null,
    sansMontant ? `${sansMontant} sans montant (à indiquer sur la carte)` : null,
  ].filter(Boolean).join(" · ");

  // replaceChildren afficherait "false" en texte : on passe par el() qui ignore les éléments absents
  zone.replaceChildren(...el("div", {},
    el("div", { class: "suivi-ligne" },
      el("b", {}, "Mon budget activités"),
      el("span", {}, el("b", { class: "depense" }, somme(depense, devise)), budget > 0 ? ` sur ${somme(budget, devise)}` : " dépensés")),
    budget > 0 && el("div", {
      class: "jauge" + (pct > 100 ? " depasse" : pct >= 90 ? " limite" : ""),
      role: "img", "aria-label": `${Math.round(pct)} % du budget activités utilisé`,
    }, el("span", { style: `width:${Math.min(100, pct)}%` })),
    // Budget dépassé : le total de toutes les activités cochées et l'écart, bien visibles
    budget > 0 && reste < 0 && el("p", { class: "alerte-budget" },
      `⚠️ Budget dépassé : tes activités cochées coûtent ${somme(depense, devise)} au total, soit ${somme(-reste, devise)} de plus que les ${somme(budget, devise)} prévus.`),
    el("p", { class: "meta", role: "status", style: "margin:4px 0 0" }, infos),
    budgetVoyage.explication() && el("p", { class: "meta", style: "margin:2px 0 0" }, budgetVoyage.explication()),
    prevues.length > 0 && el("details", { class: "programme", open: ouvert ? "" : null },
      el("summary", {}, "Voir mon programme"),
      el("ul", { class: "simple" }, programme.map((a) => el("li", {},
        el("b", {}, (nomsJours[suivi[a.nom].jour] || "Jour à fixer") + " : "),
        a.nom,
        montantCompte(a, suivi[a.nom]) ? ` (${somme(montantCompte(a, suivi[a.nom]), devise)})` : "")))),
  ).childNodes);
}

function carteActivite(a, voyage, suivi, majSuivi) {
  const resa = LIBELLE_RESA[a.reservation] ? a.reservation : "conseillee";
  const lien = lienSur(a.lien);
  const carte = el("article", { class: "carte activite", "data-resa": resa, "data-gratuit": a.prix_total === 0 },
    el("div", { class: "haut" },
      el("div", {},
        el("h3", {}, a.nom || "Activité"),
        el("div", { class: "badges" },
          a.gardee && el("span", { class: "badge b-gardee" }, "📌 Gardée car prévue"),
          a.recommande && el("span", { class: "badge b-reco" }, "⭐ Recommandé"),
          el("span", { class: "badge b-" + resa }, LIBELLE_RESA[resa]),
          a.evenement_ponctuel && el("span", { class: "badge b-evenement" }, "Seulement pendant ton séjour"),
          a.categorie && el("span", { class: "badge b-cat" }, a.categorie),
        ),
      ),
      blocPrix(a, voyage),
    ),
    a.description && el("p", {}, a.description),
    a.pourquoi && el("p", { class: "meta" }, "👍 " + a.pourquoi),
    (a.quand || a.duree) && el("p", { class: "meta" }, [a.quand && "🗓 " + a.quand, a.duree && "⏱ " + a.duree].filter(Boolean).join("  ·  ")),
    a.conseil_reservation && el("p", { class: "conseil-resa" }, el("b", {}, "Réservation : "), a.conseil_reservation),
    lien ? lienExterne(lien, "Site officiel ↗", "lien") : el("p", { class: "meta" }, "Pas de site officiel trouvé"),
    a.source && el("p", { class: "source" }, "Source : " + a.source),
  );
  const marquer = (prevu) => { carte.classList.toggle("prevue", prevu); carte.dataset.prevue = prevu; };
  carte.append(blocSuivi(a, voyage, suivi, (prevu) => { marquer(prevu); majSuivi(); }));
  marquer(Boolean(suivi[a.nom]?.prevu));
  return carte;
}

// Onglet « Activités » : barre de budget, filtres, liste et carte
// Renvoie { elements, quandVisible } (quandVisible recalcule la taille de la carte)
function sectionActivites(r, voyage, budgetVoyage) {
  const devise = voyage.devise;
  const activites = Array.isArray(r.activites) ? r.activites : [];

  const suivi = lireSuivi(voyage);
  const barreBudget = el("div", { class: "carte suivi-budget" });
  let boutonPrevues = null;
  let majCarte = null; // rafraîchit les points de la carte quand elle est ouverte
  const nbPrevues = () => activites.filter((a) => suivi[a.nom]?.prevu).length;
  const majBarre = () => afficherSuiviBudget(barreBudget, activites, suivi, budgetVoyage, voyage);
  const majSuivi = () => {
    ecrireSuivi(voyage, suivi);
    majBarre();
    if (boutonPrevues) boutonPrevues.textContent = `Prévues (${nbPrevues()})`;
    majCarte?.();
  };
  budgetVoyage.surChangement(majBarre); // montants réels du transport et du logement modifiés

  const liste = el("div", {}, activites.map((a) => carteActivite(a, voyage, suivi, majSuivi)));
  const zoneCarte = el("div", { class: "carte zone-carte" });
  zoneCarte.hidden = true;

  // Filtre « Carte » : remplace la liste par la carte des activités
  const montrerCarte = async () => {
    liste.hidden = true;
    zoneCarte.hidden = false;
    barreBudget.classList.add("statique"); // la barre fixe cacherait le haut de la carte
    if (majCarte) { majCarte(); majCarte.carte?.invalidateSize(); return; }
    zoneCarte.replaceChildren(el("p", { class: "meta" }, "Chargement de la carte…"));
    try {
      const { creerCarte } = await import("./carte.js");
      const infos = (a) => {
        const etat = suivi[a.nom];
        const m = montantCompte(a, etat);
        return { prevu: Boolean(etat?.prevu), jour: etat?.jour || null, montantTexte: m == null ? "Prix ?" : montant(m, devise) };
      };
      majCarte = await creerCarte(zoneCarte, activites, joursSejour(voyage), infos, ouvrirFiche);
    } catch (e) {
      zoneCarte.replaceChildren(el("p", { class: "alerte" }, e.message));
    }
  };
  const montrerListe = () => { liste.hidden = false; zoneCarte.hidden = true; barreBudget.classList.remove("statique"); };

  const nb = (f) => activites.filter(f).length;
  const filtres = [
    ["Toutes", () => true, activites.length],
    ["Prévues", (c) => c.dataset.prevue === "true", nbPrevues()],
    ["À réserver à l'avance", (c) => c.dataset.resa === "obligatoire", nb((a) => a.reservation === "obligatoire")],
    ["Gratuites", (c) => c.dataset.gratuit === "true", nb((a) => a.prix_total === 0)],
    ["🗺️ Carte", null, nb((a) => typeof a.lat === "number")],
  ];
  const barreFiltres = el("div", { class: "filtres", role: "group", "aria-label": "Filtrer les activités" });
  const choisir = (b) => {
    for (const autre of barreFiltres.children) autre.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-pressed", "true");
  };
  for (const [nom, test, n] of filtres) {
    const b = el("button", { type: "button", class: "chip", "aria-pressed": nom === "Toutes" ? "true" : "false" }, `${nom} (${n})`);
    b.addEventListener("click", () => {
      choisir(b);
      if (!test) { montrerCarte(); return; }
      montrerListe();
      for (const c of liste.children) c.hidden = !test(c);
    });
    if (nom === "Prévues") boutonPrevues = b;
    barreFiltres.append(b);
  }

  // Depuis la carte : « Voir la fiche » revient à la liste complète et montre l'activité
  function ouvrirFiche(index) {
    choisir(barreFiltres.children[0]);
    montrerListe();
    for (const c of liste.children) c.hidden = false;
    const fiche = liste.children[index];
    fiche.scrollIntoView({ behavior: "smooth", block: "center" });
    fiche.classList.add("surlignee");
    setTimeout(() => fiche.classList.remove("surlignee"), 2000);
  }

  majBarre();
  return {
    elements: [barreBudget, barreFiltres, liste, zoneCarte],
    quandVisible: () => majCarte?.carte?.invalidateSize(),
  };
}

function boutonsSites(liens) {
  return el("div", { class: "boutons-sites" },
    liens.map((l) => lienExterne(l.url, [el("b", {}, l.site + " ↗"), el("small", {}, l.note || l.type)], "site")));
}

// Les cases « montant réel » du transport et du logement (budget « tout le voyage »)
function carteMontantsReels(voyage, budgetVoyage) {
  const d = voyage.devise;
  if (!budgetVoyage.toutLeVoyage) {
    return el("div", { class: "carte reel" },
      el("h3", {}, "💶 Mes réservations"),
      el("p", { class: "meta" }, "Ton budget ne couvre que les activités. Pour déduire le transport et le logement de ton budget, choisis « Tout le voyage » dans le formulaire."));
  }
  const reel = budgetVoyage.reel();
  const resultat = el("p", { class: "resultat-reel", role: "status" });
  const majResultat = () => { resultat.textContent = budgetVoyage.explication(); };
  const champ = (cle, libelle, aide) => {
    const id = "reel-" + cle;
    const input = el("input", { id, type: "number", min: "0", step: "1", inputmode: "decimal", placeholder: "Pas encore réservé" });
    input.value = reel[cle] ?? "";
    input.addEventListener("input", () => {
      const v = input.value === "" ? null : Math.max(0, Number(input.value));
      budgetVoyage.definir(cle, isFinite(v) ? v : null);
    });
    return el("div", {},
      el("label", { for: id }, libelle, " ", el("small", {}, aide)),
      el("div", { class: "ligne" }, input, el("span", { class: "devise" }, d)));
  };
  budgetVoyage.surChangement(majResultat);
  majResultat();
  return el("div", { class: "carte reel" },
    el("h3", {}, "💶 Mes réservations"),
    el("p", { class: "meta" }, "Une fois ton transport et ton logement réservés, indique ce qu'ils t'ont vraiment coûté : ces montants sont déduits de ton budget total, et ce qui reste devient ton budget activités."),
    el("div", { class: "champs-reel" },
      champ("transport", "Transport", "(aller-retour, tout le groupe)"),
      champ("logement", "Logement", "(tout le séjour)")),
    resultat);
}

// Onglet « Transport et logement »
function sectionTransportLogement(voyage, r, budgetVoyage) {
  const blocs = [carteMontantsReels(voyage, budgetVoyage)];

  if (voyage.depart) {
    const t = r.transport || {};
    const options = Array.isArray(t.options) ? t.options : [];
    blocs.push(el("div", { class: "carte" },
      el("h3", {}, `🚆 Transport depuis ${voyage.depart}`),
      options.length > 0 && el("div", { class: "grille", style: "margin-top:10px" }, options.map((o) =>
        el("div", { class: "option" },
          el("b", {}, o.mode || "Transport"),
          el("span", {}, [o.duree, o.prix].filter(Boolean).join(" · ")),
          o.commentaire && el("p", { class: "meta", style: "margin:2px 0 0" }, o.commentaire),
        ))),
      el("p", { class: "note" }, (options.length ? "Prix estimés par Gemini. " : "") + "Les prix réels, à tes dates, s'affichent sur ces sites :"),
      // Codes d'aéroport : ceux trouvés avec Wikidata d'abord, sinon ceux proposés par Gemini
      boutonsSites(liensTransport(voyage, r.vols || { skyscannerDepart: t.code_skyscanner_depart, skyscannerArrivee: t.code_skyscanner_arrivee })),
    ));
  } else {
    blocs.push(el("div", { class: "carte" },
      el("h3", {}, "🚆 Transport"),
      el("p", { class: "meta" }, "Indique ta ville de départ dans le formulaire pour avoir les liens vers les vols et les trains.")));
  }

  const lg = r.logement || {};
  blocs.push(el("div", { class: "carte" },
    el("h3", {}, "🏨 Logement"),
    Array.isArray(lg.quartiers) && lg.quartiers.length > 0 && el("div", {},
      el("p", { class: "meta", style: "margin:8px 0 2px" }, "Où loger :"),
      el("ul", { class: "simple" }, lg.quartiers.map((q) => el("li", {}, el("b", {}, q.nom), q.pourquoi ? " : " + q.pourquoi : "")))),
    Array.isArray(lg.prix_nuit) && lg.prix_nuit.length > 0 && el("div", {},
      el("p", { class: "meta", style: "margin:8px 0 2px" }, "Prix indicatifs :"),
      el("ul", { class: "simple" }, lg.prix_nuit.map((p) => el("li", {}, `${p.type} : ${p.prix}`)))),
    el("p", { class: "note" }, "Les logements disponibles à tes dates, pour ton groupe :"),
    boutonsSites(liensLogement(voyage)),
  ));
  return blocs;
}

// La carte de présentation en haut des résultats (commune aux deux onglets)
function carteResume(r, activites) {
  const nbRecommandees = activites.filter((a) => a.recommande).length;
  return el("div", { class: "carte resume" },
    el("h2", { style: "margin-top:0" }, r.destination || "Ton voyage"),
    r.resume && el("p", {}, r.resume),
    r.meteo && el("p", { class: "meta" }, "☀️ " + r.meteo),
    el("div", { class: "budget" },
      el("b", {}, `${activites.length} activité${activites.length > 1 ? "s" : ""} proposée${activites.length > 1 ? "s" : ""}`),
      nbRecommandees > 0 ? el("span", { class: "meta" }, ` dont ${nbRecommandees} recommandée(s) par Gemini ⭐`) : "",
      r.note_prix && el("p", { class: "meta" }, r.note_prix),
    ),
    r.change?.locale && el("p", { class: "info devise" },
      `💱 Prix en monnaie locale (${r.change.locale}) : ce sont les vrais prix sur place. ` +
      (r.change.taux ? `La conversion en ${r.change.base} utilise le taux du ${dateCourte(r.change.date)} (1 ${r.change.base} = ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 4 }).format(r.change.taux)} ${r.change.locale}, source : ${r.change.source}) : elle peut changer d'ici ton voyage.` : "Taux de change indisponible pour le moment : relance la recherche plus tard pour la conversion.")),
    Array.isArray(r.conseils) && r.conseils.length > 0 && el("div", {}, el("b", {}, "Conseils"), el("ul", { class: "simple" }, r.conseils.map((c) => el("li", {}, c)))),
  );
}

function afficherResultats(voyage, r, defiler = true) {
  changeAffiche = r.change || null;
  const zone = $("resultats");
  const activites = Array.isArray(r.activites) ? r.activites : [];
  const budgetVoyage = creerBudget(r, voyage);
  const sectionAct = sectionActivites(r, voyage, budgetVoyage);

  // Deux onglets : les activités d'un côté, le transport et le logement de l'autre
  const panneauActivites = el("div", { id: "panneau-activites", role: "tabpanel", "aria-labelledby": "onglet-activites" }, ...sectionAct.elements);
  const panneauTransport = el("div", { id: "panneau-transport", role: "tabpanel", "aria-labelledby": "onglet-transport", class: "panneau-transport" },
    ...sectionTransportLogement(voyage, r, budgetVoyage));
  const ongletActivites = el("button", { type: "button", role: "tab", id: "onglet-activites", "aria-controls": "panneau-activites", class: "onglet" }, `🎟️ Activités (${activites.length})`);
  const ongletTransport = el("button", { type: "button", role: "tab", id: "onglet-transport", "aria-controls": "panneau-transport", class: "onglet" }, voyage.depart ? "✈️ Transport et logement" : "🏨 Logement et transport");
  const montrer = (nom) => {
    const activitesVisibles = nom !== "transport";
    ongletActivites.setAttribute("aria-selected", String(activitesVisibles));
    ongletTransport.setAttribute("aria-selected", String(!activitesVisibles));
    panneauActivites.hidden = !activitesVisibles;
    panneauTransport.hidden = activitesVisibles;
    memoire.ecrire("onglet-resultats", nom);
    if (activitesVisibles) sectionAct.quandVisible();
  };
  ongletActivites.addEventListener("click", () => montrer("activites"));
  ongletTransport.addEventListener("click", () => montrer("transport"));
  const onglets = el("div", { class: "onglets", role: "tablist", "aria-label": "Parties du voyage" }, ongletActivites, ongletTransport);
  montrer(memoire.lire("onglet-resultats") === "transport" ? "transport" : "activites");

  // Les éléments absents (avertissement vide…) sont écartés : sinon "null" s'afficherait en texte
  zone.replaceChildren(...[
    r.avertissement ? el("p", { class: "info" }, r.avertissement) : null,
    carteResume(r, activites),
    onglets,
    panneauActivites,
    panneauTransport,
    r.source_page ? el("p", { class: "note" }, "Activités tirées du guide ", lienExterne(r.source_page.url, "Wikivoyage : " + r.source_page.titre, ""), " (contenu libre, licence CC BY-SA)" + (activites.some((a) => /Gemini/.test(a.source || "")) ? ", complétées par Gemini (Google)." : ".")) : null,
  ].filter(Boolean));
  zone.hidden = false;
  if (defiler) zone.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ===================== Navigation : accueil et voyages ===============
// L'adresse indique ce qui est affiché : "#" l'accueil, "#nouveau" un nouveau
// voyage, "#voyage/<id>" un voyage enregistré. Le bouton « retour » du
// navigateur fonctionne donc, et un rechargement garde la même page.

let idCourant = null;
const estDemo = new URLSearchParams(location.search).has("demo");

function montrerVue(nom) {
  $("accueil").hidden = nom !== "accueil";
  $("vue-voyage").hidden = nom !== "voyage";
  window.scrollTo(0, 0);
}

// Pour un voyage déjà trouvé, les critères sont repliés derrière « Modifier les critères »
function replierFormulaire(replie) {
  $("formulaire").hidden = replie;
  $("modifier-criteres").hidden = !idCourant && !estDemo;
  $("modifier-criteres").setAttribute("aria-expanded", String(!replie));
  $("modifier-criteres").textContent = replie ? "✏️ Modifier les critères" : "Fermer les critères";
  $("lancer").textContent = idCourant ? "Mettre à jour les activités (tes coches sont gardées)" : "Trouver mes activités";
}
$("modifier-criteres").addEventListener("click", () => replierFormulaire(!$("formulaire").hidden));

function nomVoyage(v) {
  const d = v.destination.trim();
  return "Voyage à " + d.charAt(0).toUpperCase() + d.slice(1);
}

// "du 13 au 27 juillet 2027"
function periode(v) {
  const f = (iso, opts) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", opts);
  const memeAnnee = v.debut.slice(0, 4) === v.fin.slice(0, 4);
  const memeMois = memeAnnee && v.debut.slice(5, 7) === v.fin.slice(5, 7);
  const debut = f(v.debut, memeMois ? { day: "numeric" } : memeAnnee ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
  return `du ${debut} au ${f(v.fin, { day: "numeric", month: "long", year: "numeric" })}`;
}

function majEntete(v, suffixe = "") {
  $("titre-voyage").textContent = v ? nomVoyage(v) + suffixe : "Nouveau voyage";
  $("dates-voyage").textContent = v ? periode(v) : "Indique ta destination, tes dates et ton budget.";
}

// « Dans 3 semaines », « En cours », « Passé »
function quand(v) {
  const aujourdhui = new Date(new Date().toISOString().slice(0, 10) + "T12:00:00");
  const jours = Math.round((new Date(v.debut + "T12:00:00") - aujourdhui) / 86400000);
  if (v.fin < new Date().toISOString().slice(0, 10)) return ["passe", "Passé"];
  if (jours <= 0) return ["encours", "En cours"];
  if (jours === 1) return ["bientot", "Demain"];
  if (jours < 14) return ["bientot", `Dans ${jours} jours`];
  if (jours < 60) return ["", `Dans ${Math.round(jours / 7)} semaines`];
  return ["", `Dans ${Math.round(jours / 30)} mois`];
}

function carteVoyage(entree) {
  const v = entree.voyage, r = entree.resultat || {};
  const activites = Array.isArray(r.activites) ? r.activites : [];
  const suivi = lireSuivi(v);
  const prevues = activites.filter((a) => suivi[a.nom]?.prevu);
  const depense = prevues.reduce((s, a) => s + (montantCompte(a, suivi[a.nom]) || 0), 0);
  const budget = creerBudget(r, v).activites();
  const [classeQuand, texteQuand] = quand(v);
  const voyageurs = `${v.adultes} adulte${v.adultes > 1 ? "s" : ""}` + (v.agesEnfants?.length ? `, ${v.agesEnfants.length} enfant${v.agesEnfants.length > 1 ? "s" : ""}` : "");

  const supprimer = el("button", { type: "button", class: "supprimer", "aria-label": "Supprimer " + nomVoyage(v) }, "🗑️ Supprimer");
  supprimer.addEventListener("click", () => {
    if (!confirm(`Supprimer « ${nomVoyage(v)} » (${periode(v)}) ?\n\nLes activités prévues et les montants de ce voyage seront effacés. Cette action est définitive.`)) return;
    supprimerVoyage(entree.id);
    afficherAccueil();
  });

  return el("article", { class: "carte voyage-carte" + (classeQuand === "passe" ? " passe" : "") },
    el("a", { class: "ouvrir", href: "#voyage/" + entree.id },
      el("div", { class: "voyage-haut" },
        el("h3", {}, nomVoyage(v)),
        el("span", { class: "badge quand " + classeQuand }, texteQuand)),
      el("p", { class: "meta" }, `${periode(v)} · ${voyageurs}`),
      el("p", { class: "meta" },
        prevues.length
          ? `✓ ${prevues.length} activité${prevues.length > 1 ? "s" : ""} prévue${prevues.length > 1 ? "s" : ""}` + (budget > 0 ? ` · ${somme(depense, v.devise)} sur ${somme(budget, v.devise)}` : "")
          : `${activites.length} activités proposées · rien de prévu pour l'instant`)),
    supprimer);
}

function afficherAccueil() {
  idCourant = null;
  const voyages = listeVoyages();
  $("liste-voyages").replaceChildren(...voyages.map(carteVoyage));
  $("titre-mes-voyages").hidden = !voyages.length;
  $("aucun-voyage").hidden = voyages.length > 0;
  montrerVue("accueil");
}

function nouveauVoyage() {
  idCourant = null;
  remplirFormulaire({});
  majEntete(null);
  $("resultats").hidden = true;
  replierFormulaire(false);
  montrerVue("voyage");
  $("destination").focus();
}

function ouvrirVoyage(entree) {
  idCourant = entree.id;
  remplirFormulaire(entree.voyage);
  majEntete(entree.voyage);
  replierFormulaire(true);
  montrerVue("voyage");
  afficherResultats(entree.voyage, entree.resultat, false);
  // Taux de change du jour : la conversion des prix locaux est mise à jour en arrière-plan
  actualiserTaux(entree).then((change) => { if (change && idCourant === entree.id) afficherResultats(entree.voyage, entree.resultat, false); }).catch(() => {});
}

function route() {
  controleur?.abort(); // on quitte la page pendant une recherche : on l'arrête
  $("erreur").hidden = true;
  $("erreur-formulaire").hidden = true;
  const m = /^#voyage\/([a-z0-9]+)$/.exec(location.hash);
  if (m) {
    const entree = lireVoyage(m[1]);
    if (entree) return ouvrirVoyage(entree);
    history.replaceState(null, "", location.pathname + location.search); // voyage supprimé entre-temps
  } else if (location.hash === "#nouveau") {
    return nouveauVoyage();
  }
  afficherAccueil();
}

$("nouveau-voyage").addEventListener("click", () => { location.hash = "#nouveau"; });

// ----- Sauvegarde dans un fichier / restauration -----
$("exporter").addEventListener("click", () => {
  const contenu = exporter();
  const fichier = new Blob([JSON.stringify(contenu, null, 1)], { type: "application/json" });
  const lien = el("a", { href: URL.createObjectURL(fichier), download: `mes-voyages-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
  $("message-sauvegarde").textContent = `${contenu.voyages.length} voyage(s) sauvegardé(s) dans le fichier « ${lien.download} » (dossier Téléchargements).`;
});
$("importer").addEventListener("change", async () => {
  const fichier = $("importer").files[0];
  $("importer").value = "";
  if (!fichier) return;
  try {
    const n = importer(JSON.parse(await fichier.text()));
    $("message-sauvegarde").textContent = `${n} voyage(s) restauré(s).`;
    afficherAccueil();
  } catch (e) {
    $("message-sauvegarde").textContent = e instanceof SyntaxError ? "Ce fichier n'est pas lisible." : e.message;
  }
});

// ===================== Démarrage ====================================

construireInterets();
memoire.ecrire("cle-api", null); // ancienne clé Claude de la première version : effacée
majBoutonCle();
$("profil").addEventListener("change", majProfil);
$("enfants").addEventListener("input", majAges);
$("formulaire").addEventListener("submit", lancerRecherche);
migrerAncienneVersion(); // l'ancienne version ne gardait que le dernier voyage : il devient le premier du carnet

if (estDemo) {
  const { VOYAGE_DEMO, RESULTAT_DEMO } = await import("./demo.js");
  $("bandeau-demo").hidden = false;
  document.querySelector(".retour").href = "./";
  remplirFormulaire(VOYAGE_DEMO);
  majEntete(VOYAGE_DEMO, " (exemple)");
  replierFormulaire(true);
  montrerVue("voyage");
  afficherResultats({ ...VOYAGE_DEMO, demo: true }, RESULTAT_DEMO, false);
} else {
  window.addEventListener("hashchange", route);
  route();
}
