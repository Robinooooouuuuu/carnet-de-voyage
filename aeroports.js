// =====================================================================
// aeroports.js : trouver l'aéroport de départ et d'arrivée (gratuit)
// =====================================================================
// Pour fabriquer le lien Skyscanner, il faut un code d'aéroport.
// 1. On cherche la position de la ville sur Wikidata (gratuit, sans clé).
// 2. On prend l'aéroport le plus fréquenté à moins de 100 km
//    (ex. Genève pour Annecy, plutôt que le petit aérodrome local).
// 3. Pour les villes à plusieurs aéroports, on utilise le code « ville »
//    de Skyscanner (ex. « pari » = Roissy + Orly + Beauvais).
// =====================================================================

import { AEROPORTS } from "./aeroports-donnees.js";

const LISTE = AEROPORTS.split(";").map((l) => {
  const [code, lat, lon, milliers] = l.split(",");
  return { code, lat: +lat, lon: +lon, passagers: +milliers * 1000 };
});

// Codes Skyscanner des villes qui ont plusieurs grands aéroports
const CODE_VILLE = {
  CDG: "pari", ORY: "pari", BVA: "pari",
  LHR: "lond", LGW: "lond", STN: "lond", LTN: "lond", LCY: "lond", SEN: "lond",
  MXP: "mila", LIN: "mila", BGY: "mila",
  FCO: "rome", CIA: "rome",
  JFK: "nyca", EWR: "nyca", LGA: "nyca",
  HND: "tyoa", NRT: "tyoa",
  ARN: "stoc", BMA: "stoc", NYO: "stoc",
};

// Distance en km entre deux points du globe
function distance(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function memoire(cle, valeur) {
  try {
    if (valeur === undefined) return JSON.parse(localStorage.getItem(cle) || "null");
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch { return null; }
}

async function wikidata(params) {
  const u = new URL("https://www.wikidata.org/w/api.php");
  for (const [k, v] of Object.entries({ ...params, format: "json", origin: "*" })) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) throw new Error("Wikidata ne répond pas");
  return r.json();
}

// Position (latitude, longitude) d'une ville, gardée en mémoire pour la suite
async function positionVille(nom) {
  const cle = "position:" + nom.trim().toLowerCase();
  const connue = memoire(cle);
  if (connue) return connue;
  const recherche = await wikidata({ action: "wbsearchentities", search: nom, language: "fr", uselang: "fr", type: "item", limit: 5 });
  // Les villes d'abord : « New York » renvoie l'État avant la ville, dont la position est très différente
  const resultats = recherche.search || [];
  const estVille = (r) => /^(capitale|ville|commune|village|station|métropole|city|town|municipalit)/i.test(r.description || "");
  const ordre = [...resultats.filter(estVille), ...resultats.filter((r) => !estVille(r))];
  for (const { id } of ordre) {
    const d = await wikidata({ action: "wbgetclaims", entity: id, property: "P625" });
    const v = d.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    if (v) {
      const pos = { lat: v.latitude, lon: v.longitude };
      memoire(cle, pos);
      return pos;
    }
  }
  return null;
}

// L'aéroport le plus fréquenté près d'un point (100 km, sinon 200 km)
function aeroportPrincipal(pos) {
  for (const rayon of [100, 200]) {
    const proches = LISTE.filter((a) => distance(pos, a) <= rayon);
    if (proches.length) return proches.reduce((m, a) => (a.passagers > m.passagers ? a : m));
  }
  return null;
}

// Renvoie { skyscannerDepart, skyscannerArrivee, libelle } ou null si introuvable
export async function codesVols(depart, destination) {
  try {
    const [pDep, pArr] = await Promise.all([positionVille(depart), positionVille(destination)]);
    if (!pDep || !pArr) return null;
    const aDep = aeroportPrincipal(pDep), aArr = aeroportPrincipal(pArr);
    if (!aDep || !aArr || aDep.code === aArr.code) return null; // pas d'avion pour un trajet si court
    const dep = CODE_VILLE[aDep.code] || aDep.code.toLowerCase();
    const arr = CODE_VILLE[aArr.code] || aArr.code.toLowerCase();
    const nomCode = (a, ville) => (CODE_VILLE[a.code] ? `${ville} (tous)` : a.code);
    return { skyscannerDepart: dep, skyscannerArrivee: arr, libelle: `${nomCode(aDep, depart)} → ${nomCode(aArr, destination)}` };
  } catch {
    return null; // le lien Skyscanner est un plus : sans lui, Google Flights reste disponible
  }
}
