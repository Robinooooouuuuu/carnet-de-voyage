// =====================================================================
// demo.js : un exemple de résultat, pour voir l'appli sans clé API
// =====================================================================
// Ouvre l'appli avec ?demo à la fin de l'adresse (ex. index.html?demo).
// Ces données sont un EXEMPLE écrit à la main : prix et horaires
// ne sont pas vérifiés.
// =====================================================================

export const VOYAGE_DEMO = {
  destination: "Barcelone",
  depart: "Paris",
  debut: "2026-12-10",
  fin: "2026-12-14",
  budget: 400,
  typeBudget: "activites",
  devise: "EUR",
  profil: "famille-petits",
  adultes: 2,
  agesEnfants: [6, 9],
  interets: ["Culture", "Nature"],
};

export const RESULTAT_DEMO = {
  destination: "Barcelone, Espagne",
  resume:
    "En décembre, Barcelone est douce et moins fréquentée qu'en été. Les marchés de Noël s'installent devant la cathédrale et les grands sites sont plus faciles d'accès avec des enfants.",
  meteo: "Autour de 14 °C en journée, souvent ensoleillé, frais le soir.",
  budget_activites: 400,
  explication_budget: null,
  activites: [
    {
      nom: "Sagrada Família",
      categorie: "Culture",
      description: "La basilique de Gaudí, avec ses vitraux qui colorent toute la nef.",
      pourquoi: "Visite d'environ 1 h 30 avec audioguide enfant : le bon format pour 6 et 9 ans.",
      quand: "Tous les jours, 9 h – 18 h",
      duree: "1 h 30",
      prix_total: 78,
      prix_detail: "26 € adulte, 13 € enfant (gratuit moins de 11 ans selon la formule)",
      reservation: "obligatoire",
      conseil_reservation: "Réserver 2 à 3 semaines avant : les créneaux du matin partent en premier.",
      lien: "https://sagradafamilia.org/fr/",
      evenement_ponctuel: false,
    },
    {
      nom: "Fira de Santa Llúcia",
      categorie: "Shopping et marchés",
      description: "Le marché de Noël historique devant la cathédrale : santons, sapins, artisanat.",
      pourquoi: "Les enfants adorent chercher le « caganer », le personnage caché des crèches catalanes.",
      quand: "Pendant tout le séjour, 10 h – 21 h",
      duree: "1 h",
      prix_total: 0,
      prix_detail: "Entrée libre",
      reservation: "sur_place",
      conseil_reservation: "Pas de réservation. Plus calme en semaine avant 17 h.",
      lien: "https://www.firadesantallucia.cat/",
      evenement_ponctuel: true,
    },
    {
      nom: "Park Güell",
      categorie: "Nature",
      description: "Le parc de Gaudí, ses mosaïques et sa vue sur toute la ville.",
      pourquoi: "Beaucoup d'espace pour courir et des formes étonnantes qui amusent les enfants.",
      quand: "Tous les jours, 9 h 30 – 17 h 30",
      duree: "2 h",
      prix_total: 36,
      prix_detail: "18 € adulte, gratuit moins de 7 ans, 13,50 € de 7 à 12 ans",
      reservation: "conseillee",
      conseil_reservation: "Réserver quelques jours avant pour choisir son horaire.",
      lien: "https://parkguell.barcelona/fr",
      evenement_ponctuel: false,
    },
    {
      nom: "Plage de la Barceloneta",
      categorie: "Détente",
      description: "Promenade en bord de mer et châteaux de sable, même en hiver.",
      pourquoi: "Une pause gratuite entre deux visites, appréciée des petits.",
      quand: "Quand vous voulez, idéalement l'après-midi au soleil",
      duree: "2 h",
      prix_total: 0,
      prix_detail: "Gratuit",
      reservation: "sur_place",
      conseil_reservation: "Aucune réservation.",
      lien: null,
      evenement_ponctuel: false,
    },
  ],
  conseils: [
    "La carte Hola Barcelona (transports illimités) est rentable dès 3 jours.",
    "Les restaurants servent tard : prévoyez un goûter pour les enfants vers 17 h.",
  ],
  transport: {
    code_skyscanner_depart: "pari",
    code_skyscanner_arrivee: "bcn",
    options: [
      { mode: "Avion", duree: "1 h 45 de vol, environ 4 h porte à porte", prix: "250 – 450 € pour 4", commentaire: "Vols directs depuis Orly et Roissy (Vueling, Air France, Transavia)." },
      { mode: "Train", duree: "6 h 30 en direct", prix: "300 – 550 € pour 4", commentaire: "TGV direct Paris Gare de Lyon – Barcelona Sants, plus reposant avec des enfants." },
    ],
  },
  logement: {
    quartiers: [
      { nom: "Eixample", pourquoi: "Central, calme le soir, près de la Sagrada Família." },
      { nom: "Gràcia", pourquoi: "Ambiance de village, places piétonnes où les enfants jouent." },
    ],
    prix_nuit: [
      { type: "Hôtel 3 étoiles, chambre familiale", prix: "110 – 170 € par nuit" },
      { type: "Appartement 2 chambres", prix: "120 – 200 € par nuit" },
    ],
  },
  cout: 0,
  nbRecherches: 0,
};
