// =====================================================================
// liens.js : les liens pré-remplis vers les sites de réservation
// =====================================================================
// L'appli ne "scanne" pas ces sites (c'est interdit par leurs conditions
// d'utilisation et bloqué par leurs protections anti-robots). À la place,
// elle fabrique des liens qui ouvrent directement leur page de résultats
// avec ta ville de départ, ta destination, tes dates et le nombre de voyageurs.
// Les vrais prix, à jour, s'affichent sur leur site en un clic.
// =====================================================================

// "2026-12-10" -> "261210" (format des dates dans les liens Skyscanner)
function dateCourte(iso) {
  return iso.slice(2, 4) + iso.slice(5, 7) + iso.slice(8, 10);
}

// Un code d'aéroport ou de ville Skyscanner : 3 ou 4 lettres ("bcn", "pari")
function codeValide(code) {
  return typeof code === "string" && /^[a-z]{3,4}$/i.test(code.trim());
}

// voyage = { depart, destination, debut, fin, adultes, agesEnfants: [8, 10] }
// codes  = { skyscannerDepart, skyscannerArrivee } (donnés par Claude, facultatifs)
export function liensTransport(voyage, codes = {}) {
  const liens = [];
  const nbEnfants = voyage.agesEnfants.length;

  if (codeValide(codes.skyscannerDepart) && codeValide(codes.skyscannerArrivee)) {
    const p = new URLSearchParams({ adultsv2: voyage.adultes, cabinclass: "economy", rtn: "1" });
    if (nbEnfants) p.set("childrenv2", voyage.agesEnfants.join("|"));
    liens.push({
      site: "Skyscanner",
      type: codes.libelle ? "Vols " + codes.libelle : "Vols",
      url: `https://www.skyscanner.fr/transport/vols/${codes.skyscannerDepart.trim().toLowerCase()}/${codes.skyscannerArrivee.trim().toLowerCase()}/${dateCourte(voyage.debut)}/${dateCourte(voyage.fin)}/?${p}`,
    });
  }

  // Google Flights comprend une phrase en clair : marche pour n'importe quelle ville
  const voyageurs = voyage.adultes + nbEnfants;
  const q = `Vols de ${voyage.depart} à ${voyage.destination} le ${voyage.debut} retour le ${voyage.fin} pour ${voyageurs} personne${voyageurs > 1 ? "s" : ""}`;
  liens.push({
    site: "Google Flights",
    type: "Vols",
    url: "https://www.google.com/travel/flights?" + new URLSearchParams({ q, hl: "fr", curr: "EUR" }),
  });

  // Trainline n'accepte pas de lien pré-rempli : on ouvre sa page de recherche
  liens.push({
    site: "Trainline",
    type: "Trains et bus",
    url: "https://www.thetrainline.com/fr",
    note: "Recherche à saisir sur le site",
  });

  // Rome2Rio compare tous les moyens de transport (avion, train, bus, voiture, ferry)
  liens.push({
    site: "Rome2Rio",
    type: "Tous les transports",
    url: `https://www.rome2rio.com/fr/map/${encodeURIComponent(voyage.depart)}/${encodeURIComponent(voyage.destination)}`,
  });

  return liens;
}

export function liensLogement(voyage) {
  const nbEnfants = voyage.agesEnfants.length;

  const booking = new URLSearchParams({
    ss: voyage.destination,
    checkin: voyage.debut,
    checkout: voyage.fin,
    group_adults: voyage.adultes,
    group_children: nbEnfants,
    no_rooms: 1,
    lang: "fr",
  });
  for (const age of voyage.agesEnfants) booking.append("age", age);

  const airbnb = new URLSearchParams({
    checkin: voyage.debut,
    checkout: voyage.fin,
    adults: voyage.adultes,
  });
  const enfants = voyage.agesEnfants.filter((a) => a >= 2).length;
  const bebes = nbEnfants - enfants;
  if (enfants) airbnb.set("children", enfants);
  if (bebes) airbnb.set("infants", bebes);

  return [
    {
      site: "Booking.com",
      type: "Hôtels et appartements",
      url: "https://www.booking.com/searchresults.fr.html?" + booking,
    },
    {
      site: "Airbnb",
      type: "Logements chez l'habitant",
      url: `https://www.airbnb.fr/s/${encodeURIComponent(voyage.destination)}/homes?` + airbnb,
    },
  ];
}
