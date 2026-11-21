// =====================================================================
// devises.js : monnaie du pays, taux de change et lecture des prix
// =====================================================================
// Les prix du guide sont souvent dans la monnaie du pays (« 500 TL » à
// Istanbul). L'appli :
// 1. trouve la monnaie du pays de la destination sur Wikidata (gratuit) ;
// 2. récupère les taux du jour : Banque centrale européenne via Frankfurter,
//    complétés par ExchangeRate-API pour les monnaies que la BCE ne publie pas ;
// 3. lit la devise écrite dans chaque prix, et convertit dans ta devise.
// Le prix en monnaie locale est le vrai prix ; la conversion dépend du taux
// du jour et peut avoir changé au moment de l'activité.
// =====================================================================

function memoire(cle, valeur) {
  try {
    if (valeur === undefined) return JSON.parse(localStorage.getItem(cle) || "null");
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch { return null; }
}

// ---------- 1. Monnaie du pays de la destination ----------------------

async function wikidata(params) {
  const u = new URL("https://www.wikidata.org/w/api.php");
  for (const [k, v] of Object.entries({ ...params, format: "json", origin: "*" })) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) throw new Error("Wikidata ne répond pas");
  return r.json();
}

export async function deviseDuPays(destination) {
  const cle = "devise:" + destination.trim().toLowerCase();
  const connue = memoire(cle);
  if (connue) return connue;
  const recherche = await wikidata({ action: "wbsearchentities", search: destination, language: "fr", uselang: "fr", type: "item", limit: 5 });
  const resultats = recherche.search || [];
  const estLieu = (r) => /^(capitale|ville|commune|village|station|métropole|pays|état souverain|île|city|town|municipalit|country)/i.test(r.description || "");
  const ordre = [...resultats.filter(estLieu), ...resultats.filter((r) => !estLieu(r))].slice(0, 3);
  for (const { id } of ordre) {
    const requete = `SELECT DISTINCT ?code WHERE { { wd:${id} wdt:P17/wdt:P38 ?m } UNION { wd:${id} wdt:P38 ?m } ?m wdt:P498 ?code } LIMIT 3`;
    const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(requete));
    if (!r.ok) continue;
    const code = (await r.json()).results?.bindings?.[0]?.code?.value;
    if (/^[A-Z]{3}$/.test(code || "")) {
      memoire(cle, code);
      return code;
    }
  }
  return null;
}

// ---------- 2. Taux de change du jour ---------------------------------

// Renvoie { taux: { TRY: 55.58, … } (pour 1 unité de la devise de base), date, source }
async function tauxDuJour(base, besoin) {
  const cle = "taux:" + base;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const enCache = memoire(cle);
  if (enCache?.recupere === aujourdhui && (!besoin || enCache.taux[besoin])) return enCache;

  let resultat = null;
  try {
    const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}`);
    if (r.ok) {
      const d = await r.json();
      resultat = { taux: d.rates || {}, date: d.date, source: "Banque centrale européenne (Frankfurter)" };
    }
  } catch {}
  // Monnaie absente des taux de la BCE (dirham marocain, dong…) : second fournisseur
  if (!resultat || (besoin && !resultat.taux[besoin])) {
    try {
      const r = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      if (r.ok) {
        const d = await r.json();
        if (d.result === "success") {
          resultat = {
            taux: { ...(d.rates || {}), ...(resultat?.taux || {}) },
            date: resultat?.date || new Date(d.time_last_update_unix * 1000).toISOString().slice(0, 10),
            source: resultat ? resultat.source + " et ExchangeRate-API" : "ExchangeRate-API",
          };
        }
      }
    } catch {}
  }
  if (!resultat) return enCache || null; // hors ligne : on garde les derniers taux connus
  resultat.recupere = aujourdhui;
  memoire(cle, resultat);
  return resultat;
}

// ---------- 3. Lire un prix et sa devise ------------------------------

const FAMILLE_DOLLAR = ["USD", "CAD", "AUD", "NZD", "SGD", "HKD", "TWD", "MXN", "ARS", "CLP", "COP"];
const FAMILLE_PESO = ["MXN", "ARS", "CLP", "COP", "PHP", "UYU", "DOP", "CUP"];
const FAMILLE_COURONNE = ["SEK", "NOK", "DKK", "ISK", "CZK"];

// [motif, devise] : la devise peut dépendre de la monnaie du pays (« $ » au Canada = CAD)
function marqueurs(locale) {
  const si = (famille, defaut) => (famille.includes(locale) ? locale : defaut);
  return [
    [/₺|\btl\b|\btry\b|\bytl\b|liras?\b|livres? turques?|turkish lira/i, "TRY"],
    [/€|\beur\b|euros?\b/i, "EUR"],
    [/£|\bgbp\b|livres? sterling|pounds?\b/i, si(["GBP", "EGP", "LBP", "SYP"], "GBP")],
    [/\bchf\b|francs? suisses?|\bsfr\b/i, "CHF"],
    [/us\$|\busd\b|dollars? américains?|us dollars?/i, "USD"],
    [/c\$|\bcad\b/i, "CAD"], [/a\$|\baud\b/i, "AUD"], [/nz\$|\bnzd\b/i, "NZD"], [/s\$|\bsgd\b/i, "SGD"], [/hk\$|\bhkd\b/i, "HKD"],
    [/r\$|\bbrl\b|\breais\b|\bréals?\b/i, "BRL"],
    [/\$|dollars?\b/i, si(FAMILLE_DOLLAR, "USD")],
    [/\bjpy\b|\byens?\b|円/i, "JPY"],
    [/\bcny\b|\brmb\b|\byuans?\b|元/i, "CNY"],
    [/¥/i, si(["JPY", "CNY"], "JPY")],
    [/₹|\binr\b|roupies?\b|rupees?\b|\brs\.?\s?\d/i, si(["INR", "LKR", "NPR", "PKR", "MUR"], "INR")],
    [/฿|\bthb\b|\bbahts?\b/i, "THB"],
    [/₩|\bkrw\b|\bwons?\b/i, "KRW"],
    [/₫|\bvnd\b|\bdongs?\b/i, "VND"],
    [/zł|\bpln\b|zlotys?/i, "PLN"],
    [/kč|\bczk\b|couronnes? tchèques?/i, "CZK"],
    [/\bft\b|\bhuf\b|forints?/i, "HUF"],
    [/\blei\b|\bron\b/i, "RON"],
    [/лв|\bbgn\b|\blevs?\b/i, "BGN"],
    [/\bmad\b|\bdhs?\b|dirhams?/i, si(["MAD", "AED"], "MAD")],
    [/\baed\b/i, "AED"],
    [/\begp\b|livres? égyptiennes?/i, "EGP"],
    [/\brp\.?\s?\d|\bidr\b|roupies? indonésiennes?/i, "IDR"],
    [/\brm\s?\d|\bmyr\b|ringgits?/i, "MYR"],
    [/\bils\b|₪|shekels?|shekalim/i, "ILS"],
    [/\bpesos?\b/i, si(FAMILLE_PESO, null)],
    [/\bkr\.?\b|couronnes?|kronor|kroner|krónur/i, si(FAMILLE_COURONNE, "SEK")],
    [/\bsek\b/i, "SEK"], [/\bnok\b/i, "NOK"], [/\bdkk\b/i, "DKK"], [/\bisk\b/i, "ISK"],
    [/\bzar\b|\brands?\b/i, "ZAR"],
  ];
}

// Un nombre écrit à la française ou à l'anglaise : "1 500", "1.500", "1,500", "12,50", "2.23"
const NOMBRE = /\d{1,3}(?:[   .,]\d{3})+(?:[.,]\d{1,2})?(?!\d)|\d+(?:[.,]\d{1,2})?/g;
function versNombre(t) {
  const groupes = /^\d{1,3}(?:[   .,]\d{3})+/.exec(t);
  if (groupes) {
    const sep = t[groupes[0].search(/\D/)];
    const reste = t.slice(groupes[0].length);
    return parseFloat(groupes[0].split(sep).join("").replace(/[   ]/g, "") + (reste ? "." + reste.slice(1) : ""));
  }
  return parseFloat(t.replace(",", "."));
}

// Renvoie { montant, devise } par personne ; montant null si aucun prix lisible ; devise null si inconnue
export function lirePrix(texte, locale) {
  const t = String(texte || "");
  const nombres = [...t.matchAll(NOMBRE)].map((m) => ({ valeur: versNombre(m[0]), debut: m.index, fin: m.index + m[0].length }));
  if (!nombres.length) return { montant: /gratuit|libre|free|gratis|ücretsiz|kostenlos/i.test(t) ? 0 : null, devise: locale };

  // Toutes les devises citées, avec leur position dans le texte
  const trouves = [];
  for (const [motif, devise] of marqueurs(locale)) {
    const re = new RegExp(motif.source, "gi");
    for (const m of t.matchAll(re)) trouves.push({ devise, debut: m.index, fin: m.index + m[0].length });
  }
  // Le prix retenu : le premier nombre collé à une devise (« 500 TL », « €15 »)…
  for (const n of nombres) {
    const colle = trouves.find((d) => d.devise && ((d.debut >= n.fin && d.debut - n.fin <= 2) || (n.debut >= d.fin && n.debut - d.fin <= 2)));
    if (colle) return { montant: n.valeur, devise: colle.devise };
  }
  // … sinon le premier nombre, avec la devise citée dans le texte, ou à défaut celle du pays
  const citee = trouves.filter((d) => d.devise).sort((a, b) => a.debut - b.debut)[0];
  return { montant: nombres[0].valeur, devise: citee?.devise || locale };
}

// ---------- 4. Point d'entrée -----------------------------------------

// Prépare la conversion pour un voyage. Ne lève jamais d'erreur : sans réseau,
// les prix sont simplement affichés sans conversion.
export async function preparerChange(voyage) {
  const base = voyage.devise;
  let locale = null, change = null;
  try { locale = await deviseDuPays(voyage.destination); } catch {}
  try { change = await tauxDuJour(base, locale && locale !== base ? locale : null); } catch {}
  const taux = change?.taux || {};
  return {
    base, locale,
    date: change?.date || null,
    source: change?.source || null,
    // Montant dans la devise du voyage, ou null si le taux est inconnu
    convertir(montant, devise) {
      if (montant == null) return null;
      if (!devise || devise === base) return montant;
      return taux[devise] ? montant / taux[devise] : null;
    },
    tauxPour(devise) { return devise === base ? 1 : taux[devise] || null; },
  };
}

// "500 TL", "1 200 ¥" : montant dans une devise étrangère, tel qu'on le lit sur place
export function formaterLocal(montant, devise) {
  const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: montant < 10 && montant % 1 ? 2 : 0 }).format(montant);
  if (devise === "TRY") return nombre + " TL";
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise, currencyDisplay: "narrowSymbol", maximumFractionDigits: montant < 10 && montant % 1 ? 2 : 0 }).format(montant);
  } catch {
    return nombre + " " + devise;
  }
}
