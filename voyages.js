// =====================================================================
// voyages.js : le carnet de voyages enregistrés dans le navigateur
// =====================================================================
// Chaque voyage (critères + activités proposées) est gardé dans la mémoire
// du navigateur de cet appareil, sans limite de durée, jusqu'à ce que tu le
// supprimes. Les coches « Prévu » et les montants réels sont gardés à côté,
// sous les clés "suivi:<id>" et "reel:<id>".
//
// Rien n'est envoyé sur internet : pour retrouver tes voyages sur un autre
// appareil, ou par sécurité, utilise « Sauvegarder dans un fichier ».
// =====================================================================

const CLE = "mes-voyages";
const FORMAT = "carnet-de-voyage";

function lireTout() {
  try {
    const liste = JSON.parse(localStorage.getItem(CLE) || "[]");
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

function ecrireTout(liste) {
  try {
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch (e) {
    throw new Error("Impossible d'enregistrer le voyage : la mémoire du navigateur est pleine ou bloquée (navigation privée ?). Supprime d'anciens voyages ou sauvegarde-les dans un fichier.");
  }
}

function nouvelId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Voyages à venir d'abord (du plus proche au plus lointain), puis les voyages passés
export function listeVoyages() {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const avenir = (v) => v.voyage.fin >= aujourdhui;
  return lireTout().sort((a, b) =>
    avenir(a) !== avenir(b) ? (avenir(a) ? -1 : 1)
      : avenir(a) ? a.voyage.debut.localeCompare(b.voyage.debut)
        : b.voyage.debut.localeCompare(a.voyage.debut));
}

export function lireVoyage(id) {
  return lireTout().find((v) => v.id === id) || null;
}

// Crée ou met à jour un voyage ; renvoie son identifiant
export function enregistrerVoyage(id, voyage, resultat) {
  const liste = lireTout();
  const maintenant = new Date().toISOString();
  const existant = id && liste.find((v) => v.id === id);
  if (existant) {
    existant.voyage = { ...voyage, id };
    existant.resultat = resultat;
    existant.modifie = maintenant;
  } else {
    id = nouvelId();
    liste.push({ id, voyage: { ...voyage, id }, resultat, cree: maintenant, modifie: maintenant });
  }
  ecrireTout(liste);
  demanderStockageDurable();
  return id;
}

export function supprimerVoyage(id) {
  ecrireTout(lireTout().filter((v) => v.id !== id));
  try {
    localStorage.removeItem("suivi:" + id);
    localStorage.removeItem("reel:" + id);
  } catch {}
}

// Demande au navigateur de ne jamais effacer ces données de lui-même (quand il le permet)
let dejaDemande = false;
export function demanderStockageDurable() {
  if (dejaDemande) return;
  dejaDemande = true;
  try { navigator.storage?.persist?.(); } catch {}
}

// ---------- Sauvegarde dans un fichier ---------------------------------

// Tout le carnet : voyages, coches et montants réels (jamais la clé Gemini)
export function exporter() {
  const voyages = lireTout();
  const donnees = {};
  for (const v of voyages) {
    for (const prefixe of ["suivi:", "reel:"]) {
      const valeur = localStorage.getItem(prefixe + v.id);
      if (valeur) donnees[prefixe + v.id] = valeur;
    }
  }
  return { format: FORMAT, version: 1, date: new Date().toISOString(), voyages, donnees };
}

// Vérifie qu'un voyage lu dans un fichier a la bonne forme
function voyageValide(v) {
  const dateOk = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  return v && typeof v.id === "string" && /^[a-z0-9]{4,30}$/.test(v.id) &&
    v.voyage && typeof v.voyage.destination === "string" && dateOk(v.voyage.debut) && dateOk(v.voyage.fin) &&
    v.resultat && typeof v.resultat === "object" && Array.isArray(v.resultat.activites ?? []);
}

// Ajoute les voyages d'un fichier (un voyage déjà présent est remplacé par celui du fichier)
// Renvoie le nombre de voyages importés
export function importer(contenu) {
  if (!contenu || contenu.format !== FORMAT || !Array.isArray(contenu.voyages)) {
    throw new Error("Ce fichier n'est pas une sauvegarde de Carnet de voyage.");
  }
  const valides = contenu.voyages.filter(voyageValide);
  if (!valides.length) throw new Error("Aucun voyage lisible dans ce fichier.");
  const ids = new Set(valides.map((v) => v.id));
  ecrireTout([...lireTout().filter((v) => !ids.has(v.id)), ...valides]);
  for (const [cle, valeur] of Object.entries(contenu.donnees || {})) {
    const m = /^(suivi|reel):([a-z0-9]{4,30})$/.exec(cle);
    if (m && ids.has(m[2]) && typeof valeur === "string") {
      try { JSON.parse(valeur); localStorage.setItem(cle, valeur); } catch {}
    }
  }
  return valides.length;
}

// ---------- Reprise de l'ancienne version (un seul voyage gardé) -------

export function migrerAncienneVersion() {
  try {
    if (localStorage.getItem(CLE) !== null) return;
    const ancien = JSON.parse(localStorage.getItem("dernier-resultat") || "null");
    if (ancien?.voyage && ancien?.resultat) {
      const v = ancien.voyage;
      const ancienneCle = [v.destination.trim().toLowerCase(), v.debut, v.fin].join("|");
      const id = enregistrerVoyage(null, v, ancien.resultat);
      // Les coches et les montants étaient rangés par destination + dates : on les rattache au voyage
      for (const prefixe of ["suivi:", "reel:"]) {
        const valeur = localStorage.getItem(prefixe + ancienneCle);
        if (valeur) { localStorage.setItem(prefixe + id, valeur); localStorage.removeItem(prefixe + ancienneCle); }
      }
    } else {
      ecrireTout([]);
    }
    localStorage.removeItem("dernier-resultat");
    localStorage.removeItem("dernier-voyage");
  } catch {}
}
