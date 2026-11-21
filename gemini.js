// =====================================================================
// gemini.js : le complément facultatif par l'IA Gemini (Google), gratuit
// =====================================================================
// Avec une clé Gemini gratuite (aistudio.google.com), l'appli demande à
// Gemini de choisir parmi les activités trouvées sur Wikivoyage, d'ajouter
// les événements habituels à ces dates (marchés de Noël, festivals annuels…),
// de conseiller la réservation et d'estimer transport et logement.
//
// À savoir : dans la version gratuite, Gemini ne fait PAS de recherche web
// en direct (option payante chez Google). Il répond avec ses connaissances :
// les événements exceptionnels de cette année peuvent lui échapper.
// Google peut utiliser les demandes gratuites pour améliorer ses produits.
// =====================================================================

// Modèles gratuits, du meilleur au plus léger : si l'un n'existe plus, on essaie le suivant
const MODELES = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];

const LIBELLES_PROFIL = {
  solo: "voyageur solo",
  couple: "couple",
  amis: "groupe d'amis",
  "famille-petits": "famille avec de jeunes enfants",
  "famille-ados": "famille avec des adolescents",
  seniors: "seniors",
};

const CONSIGNES = `Tu es un organisateur de voyages expert. On te donne un projet de voyage et une liste d'activités tirées du guide Wikivoyage (avec un numéro "id"). Tu proposes un programme d'activités adapté aux dates, au budget et au profil des voyageurs.

Règles :
- Choisis en priorité dans la liste Wikivoyage (indique son "id"). Tu peux ajouter jusqu'à 4 activités qui n'y sont pas, surtout des événements qui ont lieu chaque année à ces dates (marchés de Noël, festivals, fêtes locales) ; pour celles-ci mets "id": null.
- Tu n'as pas accès à internet : appuie-toi sur tes connaissances. Pour un événement, ne l'ajoute que si tu es confiant qu'il a lieu chaque année à ces dates, et dis dans "quand" de vérifier les dates exactes.
- Le lien doit être le site OFFICIEL. Pour une activité Wikivoyage, laisse "lien": null (l'appli reprendra celui du guide). Pour une activité ajoutée, mets l'adresse du site officiel seulement si tu en es sûr, sinon null.
- Adapte au profil : pas de longues visites pour de jeunes enfants, des sensations pour des ados, des lieux romantiques pour un couple, etc.
- Le total des activités doit rester dans le budget prévu pour les activités. Si le budget couvre tout le voyage, estime ce qu'il reste pour les activités une fois transport et logement payés, et explique-le.
- Propose entre 8 et 14 activités, dont au moins 2 gratuites si possible.
- Les prix sont le TOTAL pour tout le groupe, dans la devise demandée. Corrige les prix anciens du guide si tu connais le prix actuel.
- Écris en français, avec un ton simple et chaleureux.

Réponds UNIQUEMENT avec un objet JSON valide de cette forme :
{
  "destination": "nom complet, pays",
  "resume": "2 ou 3 phrases sur ce que la destination offre à ces dates pour ce profil",
  "meteo": "météo habituelle à ces dates, en une phrase",
  "budget_activites": nombre,
  "explication_budget": "comment tu as calculé le budget activités" ou null,
  "activites": [
    {
      "id": numéro de l'activité Wikivoyage ou null,
      "nom": "nom de l'activité",
      "categorie": "Culture" | "Nature" | "Gastronomie" | "Sport et aventure" | "Détente" | "Spectacle" | "Fête et vie nocturne" | "Shopping et marchés" | "Parc et loisirs",
      "description": "1 ou 2 phrases",
      "pourquoi": "pourquoi c'est adapté à ce profil, en une phrase",
      "quand": "jours et horaires habituels, ou dates de l'événement",
      "duree": "durée conseillée, par exemple 2 h",
      "prix_total": nombre (0 si gratuit),
      "prix_detail": "détail du prix, par exemple 25 € adulte, 12 € enfant",
      "reservation": "obligatoire" | "conseillee" | "sur_place",
      "conseil_reservation": "quand et comment réserver",
      "lien": null ou "https://site-officiel",
      "evenement_ponctuel": true si l'activité n'existe qu'à ces dates, sinon false
    }
  ],
  "conseils": ["2 à 4 conseils pratiques pour ce séjour"],
  "transport": null ou {
    "code_skyscanner_depart": "code Skyscanner de la ville de départ en minuscules (code ville comme pari, lond, mila, ou code IATA de l'aéroport le plus proche comme bod)" ou null,
    "code_skyscanner_arrivee": "idem pour la destination" ou null,
    "options": [ { "mode": "Avion" | "Train" | "Bus" | "Voiture" | "Ferry", "duree": "durée approximative porte à porte", "prix": "fourchette de prix aller-retour pour tout le groupe", "commentaire": "une phrase" } ]
  },
  "logement": {
    "quartiers": [ { "nom": "nom du quartier", "pourquoi": "une phrase adaptée au profil" } ],
    "prix_nuit": [ { "type": "Hôtel 3 étoiles, appartement…", "prix": "fourchette par nuit pour le groupe" } ]
  }
}
Si aucune ville de départ n'est donnée, mets "transport": null.`;

function demandeTexte(v, candidates) {
  const nuits = Math.round((new Date(v.fin) - new Date(v.debut)) / 86400000);
  const lignes = [
    `Destination : ${v.destination}`,
    `Dates : du ${v.debut} au ${v.fin} (${nuits} nuit${nuits > 1 ? "s" : ""})`,
    `Profil : ${LIBELLES_PROFIL[v.profil] || v.profil}`,
    `Voyageurs : ${v.adultes} adulte(s)` + (v.agesEnfants.length ? `, ${v.agesEnfants.length} enfant(s) de ${v.agesEnfants.join(", ")} ans` : ""),
    v.typeBudget === "total"
      ? `Budget : ${v.budget} ${v.devise} pour TOUT le voyage (transport, logement et activités)`
      : `Budget : ${v.budget} ${v.devise} pour les activités uniquement`,
    `Devise : ${v.devise}`,
    v.interets.length ? `Centres d'intérêt : ${v.interets.join(", ")}` : "Centres d'intérêt : non précisés",
    v.depart ? `Ville de départ : ${v.depart}` : "Pas de ville de départ indiquée.",
    `Date d'aujourd'hui : ${new Date().toISOString().slice(0, 10)}`,
    "",
    candidates.length ? "Activités du guide Wikivoyage :" : "Aucune activité trouvée sur Wikivoyage : propose toi-même les activités (id: null).",
  ];
  for (const f of candidates) {
    const desc = f.description.length > 160 ? f.description.slice(0, 157) + "…" : f.description;
    lignes.push(`- id ${f.id} | ${f.nom} | ${f.categorie} | prix guide : ${f.prix || "?"} | ${desc}`);
  }
  return lignes.join("\n");
}

// Traduit les erreurs de Google en messages compréhensibles
function messageErreur(statut, corps) {
  const raison = corps?.error?.details?.find((d) => d.reason)?.reason || corps?.error?.status || "";
  const texte = corps?.error?.message || "";
  if (raison === "API_KEY_INVALID" || /api key not valid/i.test(texte)) return "Ta clé Gemini est refusée. Vérifie-la avec le bouton « ✨ Gemini » en haut de la page.";
  if (statut === 429) return "Le quota gratuit de Gemini est atteint pour le moment (il se remet à zéro chaque jour vers 9 h, heure de Paris).";
  if (statut === 403) return "Ta clé Gemini n'a pas accès à ce service. " + texte;
  if (statut >= 500) return "Les serveurs de Gemini sont surchargés. Réessaie dans quelques minutes.";
  return "Gemini a refusé la demande : " + (texte || "erreur " + statut);
}

async function appeler(modele, cle, corps, signal) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modele}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": cle },
    body: JSON.stringify(corps),
    signal,
  });
  const json = await r.json().catch(() => null);
  return { statut: r.status, json };
}

// Renvoie le résultat au format affiché par l'appli
export async function completerAvecGemini(voyage, wv, cle, suivi, signal) {
  const candidates = (wv?.candidates || []).slice(0, 35);
  const corps = {
    systemInstruction: { parts: [{ text: CONSIGNES }] },
    contents: [{ role: "user", parts: [{ text: demandeTexte(voyage, candidates) }] }],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 16000 },
  };

  let reponse;
  try {
    for (const modele of MODELES) {
      suivi(`Gemini (${modele}) compose ton programme…`);
      reponse = await appeler(modele, cle, corps, signal);
      if (reponse.statut !== 404) break; // 404 : modèle retiré, on essaie le suivant
    }
  } catch (e) {
    if (signal?.aborted) throw new Error("Recherche annulée.");
    throw new Error("Impossible de joindre Gemini. Vérifie ta connexion internet.");
  }
  if (reponse.statut !== 200) throw new Error(messageErreur(reponse.statut, reponse.json));

  const candidat = reponse.json?.candidates?.[0];
  if (!candidat || candidat.finishReason === "SAFETY") throw new Error("Gemini n'a pas pu traiter cette demande.");
  if (candidat.finishReason === "MAX_TOKENS") throw new Error("La réponse de Gemini a été coupée (trop longue).");
  const texte = (candidat.content?.parts || []).map((p) => p.text || "").join("");

  let resultat;
  try {
    resultat = JSON.parse(texte.slice(texte.indexOf("{"), texte.lastIndexOf("}") + 1));
  } catch {
    throw new Error("La réponse de Gemini était mal formée.");
  }

  // Reprend le lien du guide et la source pour les activités Wikivoyage
  const parId = new Map(candidates.map((f) => [f.id, f]));
  for (const a of resultat.activites || []) {
    const f = parId.get(a.id);
    if (f) {
      if (!a.lien && f.url) a.lien = f.url;
      a.source = `Wikivoyage${f.langue === "en" ? " (anglais)" : ""} + Gemini`;
    } else {
      a.source = "Proposé par Gemini : à vérifier";
    }
  }
  resultat.note_prix = "Prix et horaires estimés par Gemini (sans recherche web en direct) à partir du guide Wikivoyage : vérifie-les sur le site officiel.";
  return resultat;
}
