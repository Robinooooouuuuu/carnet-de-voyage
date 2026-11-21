// =====================================================================
// app.js : le formulaire, l'affichage des résultats et les réglages
// =====================================================================
import { liensTransport, liensLogement } from "./liens.js";

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
  memoire.ecrire("dernier-voyage", JSON.stringify(voyage));

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
    let wv = null;
    try {
      wv = await chercherWikivoyage(voyage, suivi);
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
        resultat = await completerAvecGemini(voyage, wv, cle, suivi, controleur.signal);
      } catch (e) {
        if (controleur.signal.aborted || !wv) throw e;
        resultat = resultatSansIA(voyage, wv);
        resultat.avertissement = e.message + " Voici les activités du guide Wikivoyage, sans le complément de Gemini.";
      }
    } else {
      resultat = resultatSansIA(voyage, wv);
    }
    if (wv) resultat.source_page = { titre: wv.titre, url: wv.url };
    if (wv && wv.candidates.length === 0 && !cle) {
      throw new Error("Le guide Wikivoyage n'a pas de fiches d'activités pour cette destination. Ajoute une clé Gemini gratuite pour avoir des propositions.");
    }
    memoire.ecrire("dernier-resultat", JSON.stringify({ voyage, resultat }));
    afficherResultats(voyage, resultat);
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

// ===================== Affichage des résultats ======================

const LIBELLE_RESA = {
  obligatoire: "À réserver à l'avance",
  conseillee: "Réservation conseillée",
  sur_place: "Sans réservation",
  inconnu: "Réservation à vérifier",
};

function carteActivite(a, devise) {
  const resa = LIBELLE_RESA[a.reservation] ? a.reservation : "conseillee";
  const lien = lienSur(a.lien);
  return el("article", { class: "carte activite", "data-resa": resa, "data-gratuit": a.prix_total === 0 },
    el("div", { class: "haut" },
      el("div", {},
        el("h3", {}, a.nom || "Activité"),
        el("div", { class: "badges" },
          el("span", { class: "badge b-" + resa }, LIBELLE_RESA[resa]),
          a.evenement_ponctuel && el("span", { class: "badge b-evenement" }, "Seulement pendant ton séjour"),
          a.categorie && el("span", { class: "badge b-cat" }, a.categorie),
        ),
      ),
      el("div", { class: "prix" }, montant(a.prix_total, devise), a.prix_detail && el("small", {}, a.prix_detail)),
    ),
    a.description && el("p", {}, a.description),
    a.pourquoi && el("p", { class: "meta" }, "👍 " + a.pourquoi),
    (a.quand || a.duree) && el("p", { class: "meta" }, [a.quand && "🗓 " + a.quand, a.duree && "⏱ " + a.duree].filter(Boolean).join("  ·  ")),
    a.conseil_reservation && el("p", { class: "conseil-resa" }, el("b", {}, "Réservation : "), a.conseil_reservation),
    lien ? lienExterne(lien, "Site officiel ↗", "lien") : el("p", { class: "meta" }, "Pas de site officiel trouvé"),
    a.source && el("p", { class: "source" }, "Source : " + a.source),
  );
}

function sectionActivites(r, devise) {
  const activites = Array.isArray(r.activites) ? r.activites : [];
  const total = activites.reduce((s, a) => s + (typeof a.prix_total === "number" ? a.prix_total : 0), 0);
  const budget = typeof r.budget_activites === "number" ? r.budget_activites : 0;
  const part = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;

  const liste = el("div", {}, activites.map((a) => carteActivite(a, devise)));
  const nb = (f) => activites.filter(f).length;
  const filtres = [
    ["Toutes", () => true, activites.length],
    ["À réserver à l'avance", (c) => c.dataset.resa === "obligatoire", nb((a) => a.reservation === "obligatoire")],
    ["Gratuites", (c) => c.dataset.gratuit === "true", nb((a) => a.prix_total === 0)],
  ];
  const barreFiltres = el("div", { class: "filtres", role: "group", "aria-label": "Filtrer les activités" });
  for (const [nom, test, n] of filtres) {
    const b = el("button", { type: "button", class: "chip", "aria-pressed": nom === "Toutes" ? "true" : "false" }, `${nom} (${n})`);
    b.addEventListener("click", () => {
      for (const autre of barreFiltres.children) autre.setAttribute("aria-pressed", "false");
      b.setAttribute("aria-pressed", "true");
      for (const c of liste.children) c.hidden = !test(c);
    });
    barreFiltres.append(b);
  }

  return [
    r.avertissement && el("p", { class: "info" }, r.avertissement),
    el("div", { class: "carte resume" },
      el("h2", { style: "margin-top:0" }, r.destination || "Ton voyage"),
      r.resume && el("p", {}, r.resume),
      r.meteo && el("p", { class: "meta" }, "☀️ " + r.meteo),
      el("div", { class: "budget" },
        el("b", {}, `Total des activités proposées : ${montant(total, devise)}`), " ",
        budget > 0 && el("span", { class: "meta" }, `sur ${montant(budget, devise)} prévus pour les activités`),
        budget > 0 && el("div", { class: "jauge" + (total > budget ? " depasse" : ""), role: "img", "aria-label": `${Math.round((total / budget) * 100)} % du budget activités` }, el("span", { style: `width:${part}%` })),
        r.explication_budget && el("p", { class: "meta" }, r.explication_budget),
        r.note_prix && el("p", { class: "meta" }, r.note_prix),
      ),
      Array.isArray(r.conseils) && r.conseils.length > 0 && el("div", {}, el("b", {}, "Conseils"), el("ul", { class: "simple" }, r.conseils.map((c) => el("li", {}, c)))),
    ),
    el("h2", {}, "Activités"),
    barreFiltres,
    liste,
  ];
}

function boutonsSites(liens) {
  return el("div", { class: "boutons-sites" },
    liens.map((l) => lienExterne(l.url, [el("b", {}, l.site + " ↗"), el("small", {}, l.note || l.type)], "site")));
}

function sectionTransportLogement(voyage, r) {
  const blocs = [el("h2", {}, voyage.depart ? "Y aller et se loger" : "Se loger")];

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
      boutonsSites(liensTransport(voyage, { skyscannerDepart: t.code_skyscanner_depart, skyscannerArrivee: t.code_skyscanner_arrivee })),
    ));
  }

  const lg = r.logement || {};
  blocs.push(el("div", { class: "carte", style: "margin-top:12px" },
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

function afficherResultats(voyage, r, defiler = true) {
  const zone = $("resultats");
  zone.replaceChildren(
    ...sectionActivites(r, voyage.devise),
    ...sectionTransportLogement(voyage, r),
    r.source_page ? el("p", { class: "note" }, "Activités tirées du guide ", lienExterne(r.source_page.url, "Wikivoyage : " + r.source_page.titre, ""), " (contenu libre, licence CC BY-SA)" + (r.activites?.some((a) => /Gemini/.test(a.source || "")) ? ", complétées par Gemini (Google)." : ".")) : "",
  );
  zone.hidden = false;
  if (defiler) zone.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ===================== Démarrage ====================================

construireInterets();
memoire.ecrire("cle-api", null); // ancienne clé Claude de la première version : effacée
majBoutonCle();
$("profil").addEventListener("change", majProfil);
$("enfants").addEventListener("input", majAges);
$("formulaire").addEventListener("submit", lancerRecherche);

if (new URLSearchParams(location.search).has("demo")) {
  const { VOYAGE_DEMO, RESULTAT_DEMO } = await import("./demo.js");
  $("bandeau-demo").hidden = false;
  remplirFormulaire(VOYAGE_DEMO);
  afficherResultats(VOYAGE_DEMO, RESULTAT_DEMO);
} else {
  // On retrouve le dernier voyage et ses résultats en rouvrant l'appli
  try {
    const sauve = JSON.parse(memoire.lire("dernier-resultat") || "null");
    const voyage = sauve?.voyage || JSON.parse(memoire.lire("dernier-voyage") || "null");
    if (voyage) remplirFormulaire(voyage);
    if (sauve?.resultat) afficherResultats(sauve.voyage, sauve.resultat, false);
  } catch {}
}
