// =====================================================================
// claude.js : la demande envoyée à Claude pour trouver les activités
// =====================================================================
// Claude reçoit ton voyage (destination, dates, budget, profil), fait des
// recherches sur le web (événements pendant tes dates, sites officiels,
// prix, réservation) et renvoie une liste d'activités au format JSON.
//
// La clé API est la tienne : elle reste dans ton navigateur et n'est envoyée
// qu'à api.anthropic.com. Chaque recherche est facturée sur ton compte
// Anthropic (quelques centimes, le coût s'affiche après chaque recherche).
// =====================================================================

// Bibliothèque officielle d'Anthropic, chargée depuis un CDN (version figée)
import Anthropic from "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.5.0/+esm";

const MODELE = "claude-opus-5-5";

// Prix en dollars US (novembre 2026) pour estimer le coût d'une recherche
const PRIX = { entree: 4 / 1e6, sortie: 20 / 1e6, rechercheWeb: 10 / 1000 };

const CONSIGNES = `Tu es un organisateur de voyages expert. On te donne un projet de voyage ; tu proposes des activités adaptées aux dates, au budget et au profil des voyageurs.

Méthode :
- Utilise la recherche web pour vérifier : les événements, festivals, marchés, expositions et spectacles qui ont lieu PENDANT les dates du séjour ; les horaires et fermetures saisonnières ; les prix actuels ; s'il faut réserver à l'avance et combien de temps avant ; l'adresse du site officiel.
- Le lien de chaque activité doit être son site OFFICIEL (site du musée, du parc, de l'office de tourisme, de l'organisateur). Jamais un revendeur (GetYourGuide, Viator, Tripadvisor…) sauf s'il n'existe aucun site officiel. Si tu n'as pas de lien fiable, mets null plutôt que d'en inventer un.
- Adapte les activités au profil : pas de visites de 3 heures pour de jeunes enfants, des activités à sensations pour des ados, des lieux romantiques pour un couple, etc.
- Le total des activités proposées doit rester dans le budget prévu pour les activités. Si le budget donné couvre tout le voyage, estime ce qu'il reste pour les activités une fois le transport et le logement payés, et explique-le.
- Propose entre 8 et 14 activités, avec au moins 2 activités gratuites quand c'est possible.
- Les prix sont le TOTAL pour tout le groupe, dans la devise demandée.
- Écris en français, avec un ton simple et chaleureux.

Ta réponse finale doit contenir UNIQUEMENT un objet JSON valide (sans texte avant ni après, sans bloc de code), avec exactement cette structure :
{
  "destination": "nom complet, pays",
  "resume": "2 ou 3 phrases sur ce que la destination offre à ces dates pour ce profil",
  "meteo": "météo habituelle à ces dates, en une phrase",
  "budget_activites": nombre (montant disponible pour les activités, pour tout le groupe),
  "explication_budget": "comment tu as calculé le budget activités" ou null,
  "activites": [
    {
      "nom": "nom de l'activité",
      "categorie": "Culture" | "Nature" | "Gastronomie" | "Sport et aventure" | "Détente" | "Spectacle" | "Fête et vie nocturne" | "Shopping et marchés" | "Parc et loisirs",
      "description": "1 ou 2 phrases",
      "pourquoi": "pourquoi c'est adapté à ce profil, en une phrase",
      "quand": "jour(s) et horaires pendant le séjour, ou dates de l'événement",
      "duree": "durée conseillée, par exemple 2 h",
      "prix_total": nombre (0 si gratuit),
      "prix_detail": "détail du prix, par exemple 25 € adulte, 12 € enfant",
      "reservation": "obligatoire" | "conseillee" | "sur_place",
      "conseil_reservation": "quand et comment réserver, par exemple Réserver 3 semaines avant, les créneaux du week-end partent vite",
      "lien": "https://site-officiel" ou null,
      "evenement_ponctuel": true si l'activité n'existe que pendant ces dates (festival, marché de Noël…), sinon false
    }
  ],
  "conseils": ["2 à 4 conseils pratiques pour ce séjour"],
  "transport": null ou {
    "code_skyscanner_depart": "code Skyscanner de la ville de départ en minuscules (code ville comme pari, lond, mila, ou code IATA de l'aéroport le plus proche comme bod)" ou null,
    "code_skyscanner_arrivee": "idem pour la destination" ou null,
    "options": [
      {
        "mode": "Avion" | "Train" | "Bus" | "Voiture" | "Ferry",
        "duree": "durée du trajet porte à porte, approximative",
        "prix": "fourchette de prix aller-retour pour tout le groupe à ces dates",
        "commentaire": "une phrase : compagnies, gares, correspondances, conseil"
      }
    ]
  },
  "logement": null ou {
    "quartiers": [ { "nom": "nom du quartier", "pourquoi": "une phrase adaptée au profil" } ],
    "prix_nuit": [ { "type": "Hôtel 3 étoiles, appartement…", "prix": "fourchette par nuit pour le groupe à ces dates" } ]
  }
}
Si aucune ville de départ n'est donnée, mets "transport": null.`;

const LIBELLES_PROFIL = {
  solo: "voyageur solo",
  couple: "couple",
  amis: "groupe d'amis",
  "famille-petits": "famille avec de jeunes enfants",
  "famille-ados": "famille avec des adolescents",
  seniors: "seniors",
};

function demandeTexte(v) {
  const nuits = Math.round((new Date(v.fin) - new Date(v.debut)) / 86400000);
  const lignes = [
    `Destination : ${v.destination}`,
    `Dates : du ${v.debut} au ${v.fin} (${nuits} nuit${nuits > 1 ? "s" : ""})`,
    `Profil : ${LIBELLES_PROFIL[v.profil] || v.profil}`,
    `Voyageurs : ${v.adultes} adulte${v.adultes > 1 ? "s" : ""}` +
      (v.agesEnfants.length ? `, ${v.agesEnfants.length} enfant(s) de ${v.agesEnfants.join(", ")} ans` : ""),
    v.typeBudget === "total"
      ? `Budget : ${v.budget} ${v.devise} pour TOUT le voyage (transport, logement et activités)`
      : `Budget : ${v.budget} ${v.devise} pour les activités uniquement`,
    `Devise : ${v.devise}`,
  ];
  if (v.interets.length) lignes.push(`Centres d'intérêt : ${v.interets.join(", ")}`);
  if (v.depart) lignes.push(`Ville de départ : ${v.depart} (remplis aussi "transport" et "logement")`);
  else lignes.push(`Pas de ville de départ indiquée (remplis quand même "logement").`);
  lignes.push(`Date d'aujourd'hui : ${new Date().toISOString().slice(0, 10)}`);
  return lignes.join("\n");
}

// Récupère l'objet JSON dans le texte de la réponse
function extraireJSON(texte) {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");
  if (debut < 0 || fin < debut) throw new Error("La réponse de Claude ne contient pas de résultat lisible. Relance la recherche.");
  return JSON.parse(texte.slice(debut, fin + 1));
}

// Traduit les erreurs de l'API en messages compréhensibles
function messageErreur(e) {
  if (e instanceof Anthropic.AuthenticationError) return "Ta clé API est refusée. Vérifie-la dans les réglages (bouton « Clé API »).";
  if (e instanceof Anthropic.PermissionDeniedError) return "Ta clé API n'a pas accès à ce modèle ou à la recherche web.";
  if (e instanceof Anthropic.RateLimitError) return "Trop de demandes d'un coup. Attends une minute et relance.";
  if (e instanceof Anthropic.BadRequestError) {
    if (/credit|balance/i.test(e.message)) return "Ton compte Anthropic n'a plus de crédit. Recharge-le sur platform.claude.com (Billing).";
    return "Demande refusée par l'API : " + e.message;
  }
  if (e instanceof Anthropic.InternalServerError) return "Les serveurs de Claude sont surchargés. Réessaie dans quelques minutes.";
  if (e instanceof Anthropic.APIConnectionError) return "Impossible de joindre Claude. Vérifie ta connexion internet.";
  return e.message || String(e);
}

// voyage : les infos du formulaire ; suivi(texte) : affiche la progression
export async function chercherActivites(voyage, cleAPI, suivi, signal) {
  const client = new Anthropic({ apiKey: cleAPI, dangerouslyAllowBrowser: true });
  const messages = [{ role: "user", content: demandeTexte(voyage) }];
  const cumul = { entree: 0, sortie: 0, recherches: 0 };
  let nbRecherches = 0;

  try {
    // La recherche web peut faire "pause" (pause_turn) : on relance alors la suite
    for (let tour = 0; tour < 5; tour++) {
      const flux = client.beta.messages.stream(
        {
          model: MODELE,
          max_tokens: 32000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default", // si Claude refuse par erreur, un autre modèle prend le relais
          output_config: { effort: "medium" },
          system: CONSIGNES,
          tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 12 }],
          messages,
        },
        { signal }
      );

      flux.on("contentBlock", (bloc) => {
        if (bloc.type === "server_tool_use" && bloc.name === "web_search") {
          nbRecherches++;
          suivi(`Recherche ${nbRecherches} : « ${bloc.input?.query ?? "…"} »`);
        }
      });
      flux.on("text", () => suivi("Rédaction des propositions…"));

      const reponse = await flux.finalMessage();
      const u = reponse.usage || {};
      cumul.entree += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      cumul.sortie += u.output_tokens || 0;
      cumul.recherches += u.server_tool_use?.web_search_requests || 0;

      if (reponse.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: reponse.content });
        continue;
      }
      if (reponse.stop_reason === "refusal") {
        throw new Error("Claude n'a pas pu traiter cette demande. Essaie de la reformuler (destination, centres d'intérêt).");
      }
      if (reponse.stop_reason === "max_tokens") {
        throw new Error("La réponse a été coupée car trop longue. Relance avec moins de centres d'intérêt ou un séjour plus court.");
      }

      const texte = reponse.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const resultat = extraireJSON(texte);
      resultat.cout = cumul.entree * PRIX.entree + cumul.sortie * PRIX.sortie + cumul.recherches * PRIX.rechercheWeb;
      resultat.nbRecherches = cumul.recherches;
      return resultat;
    }
    throw new Error("La recherche a pris trop de temps. Relance-la.");
  } catch (e) {
    if (signal?.aborted || e instanceof Anthropic.APIUserAbortError) throw new Error("Recherche annulée.");
    if (e instanceof SyntaxError) throw new Error("La réponse de Claude était mal formée. Relance la recherche.");
    throw new Error(messageErreur(e));
  }
}
