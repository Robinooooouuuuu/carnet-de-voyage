# Carnet de voyage

Une appli web qui aide à organiser un voyage : tu indiques ta destination, tes dates, ton budget
et ton profil voyageur, et elle te propose des activités adaptées, dans ton budget, avec le lien
vers le site officiel et une indication claire sur la réservation (à réserver à l'avance,
conseillée, ou sans réservation). Elle propose aussi le transport et le logement, avec des liens
pré-remplis vers Skyscanner, Google Flights, Trainline, Rome2Rio, Booking.com et Airbnb.

## Fonctionnalités

- **Activités** trouvées par Claude (Anthropic) après une recherche sur le web : événements
  pendant tes dates (festivals, marchés de Noël…), prix pour tout le groupe, horaires, durée.
- **Réservation** : un badge rouge « À réserver à l'avance », orange « Réservation conseillée »
  ou vert « Sans réservation », avec le conseil (combien de temps avant, comment).
- **Budget** : une jauge compare le total des activités au budget. Si le budget couvre tout le
  voyage, Claude estime la part qui reste pour les activités.
- **Profils** : solo, couple, amis, famille avec jeunes enfants, famille avec ados, seniors.
- **Transport et logement** : estimations de prix et de durée, quartiers conseillés, et liens
  directs vers les pages de résultats des sites de réservation (dates et voyageurs déjà remplis).
- Le dernier voyage et ses résultats sont gardés dans le navigateur.

## Pourquoi des liens et pas un « scan » des sites ?

Skyscanner, Booking.com, Airbnb et Trainline interdisent la lecture automatique de leurs pages
(conditions d'utilisation, protections anti-robots). L'appli fabrique donc des liens qui ouvrent
directement leur page de résultats pour tes dates : les vrais prix, à jour, s'affichent en un clic.
Trainline n'accepte pas de lien pré-rempli : son lien ouvre sa page de recherche.

## La clé API

Les recherches d'activités utilisent l'API Claude avec **ta propre clé** :

1. Crée un compte sur [platform.claude.com](https://platform.claude.com/), ajoute un peu de
   crédit (Billing), puis crée une clé (API keys).
2. Dans l'appli, clique sur « 🔑 Clé API » et colle ta clé.

La clé reste uniquement dans ton navigateur (stockage local) et n'est envoyée qu'à
api.anthropic.com. Elle n'est jamais dans le code ni sur GitHub. Une recherche coûte environ
10 à 40 centimes (modèle Claude Opus 5.5 + recherche web) ; le coût s'affiche après chaque recherche.
Conseil : fixe une limite de dépenses mensuelle dans ton compte Anthropic.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La page de l'appli (formulaire, styles, fenêtre de la clé API) |
| `app.js` | Le formulaire, l'affichage des résultats, les filtres |
| `claude.js` | La demande envoyée à Claude (consignes, recherche web, lecture de la réponse) |
| `liens.js` | Les liens pré-remplis vers les sites de transport et de logement |
| `demo.js` | Un exemple de résultat pour voir l'appli sans clé (`?demo`) |
| `icones/`, `manifest.json` | Icône de l'appli (écran d'accueil du téléphone, onglet du navigateur) |
| `serveur.ps1`, `lancer-serveur.bat` | Petit serveur local pour tester l'appli sur son PC |

## Lancer l'appli sur son PC

Double-clic sur `lancer-serveur.bat`, puis ouvrir http://localhost:8000/
(exemple sans clé : http://localhost:8000/?demo).
