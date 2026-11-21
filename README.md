# Carnet de voyage

Une appli web **100 % gratuite** qui aide à organiser un voyage. Tu indiques ta destination, tes
dates, ton budget et ton profil voyageur. Elle te propose des activités adaptées, dans ton budget,
avec le lien vers le site officiel et une indication sur la réservation. Elle propose aussi le
transport et le logement, avec des liens pré-remplis vers Skyscanner, Google Flights, Trainline,
Rome2Rio, Booking.com et Airbnb.

## Comment ça marche

1. **Le guide Wikivoyage** (gratuit, sans compte ni clé). L'appli lit les fiches « Voir » et
   « Faire » de la destination, en français, complétées par le guide en anglais, souvent plus
   détaillé. Elle garde celles qui vont le mieux à ton profil et à tes centres d'intérêt, et qui
   entrent dans ton budget. Elle devine la réservation à partir du texte (billets, réservation
   obligatoire, accès libre…) ; sinon, elle affiche « Réservation à vérifier ».
2. **Gemini, l'IA de Google** (facultatif, gratuit). Avec une clé gratuite, Gemini choisit parmi
   les fiches du guide, ajoute les événements habituels à tes dates (marchés de Noël, festivals),
   conseille la réservation, met à jour les prix et estime le transport et le logement.

### Limites de la version gratuite

- Les fiches Wikivoyage sont écrites par des bénévoles : certaines sont anciennes (prix,
  horaires, liens), et les petites destinations ont peu de contenu. La date de mise à jour de
  chaque fiche est affichée.
- Sans Gemini, les événements propres à tes dates ne sont pas connus. Les festivals qui ont lieu
  à un autre moment de l'année sont écartés quand le guide indique leur mois.
- Dans sa version gratuite, Gemini **ne cherche pas sur internet en direct** (c'est payant chez
  Google). Il répond avec ses connaissances, donc un événement exceptionnel cette année peut
  lui échapper.
- Google peut utiliser les demandes gratuites à Gemini pour améliorer ses produits. L'appli ne
  lui envoie que le projet de voyage (destination, dates, budget, profil).

## Pourquoi des liens et pas un « scan » des sites de réservation ?

Skyscanner, Booking.com, Airbnb et Trainline interdisent la lecture automatique de leurs pages
(conditions d'utilisation, protections anti-robots). L'appli fabrique donc des liens qui ouvrent
directement leur page de résultats pour tes dates : les vrais prix, à jour, s'affichent en un clic.
Trainline n'accepte pas de lien pré-rempli : son lien ouvre sa page de recherche.

## Ajouter Gemini (facultatif)

1. Va sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey) et connecte-toi avec
   un compte Google.
2. Clique sur « Create API key ». C'est gratuit, sans carte bancaire.
3. Dans l'appli, clique sur « ✨ Ajouter Gemini » et colle la clé.

La clé reste uniquement dans ton navigateur (stockage local) et n'est envoyée qu'à Google. Elle
n'est jamais dans le code ni sur GitHub. La version gratuite a un quota par jour, remis à zéro
chaque jour vers 9 h (heure de Paris).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La page de l'appli (formulaire, styles, fenêtre de la clé Gemini) |
| `app.js` | Le formulaire, l'enchaînement Wikivoyage puis Gemini, l'affichage des résultats |
| `wikivoyage.js` | Lecture des fiches Wikivoyage, catégories, prix, réservation, choix des activités |
| `gemini.js` | Le complément facultatif par Gemini (consignes, appel, lecture de la réponse) |
| `liens.js` | Les liens pré-remplis vers les sites de transport et de logement |
| `demo.js` | Un exemple de résultat (`?demo`) |
| `icones/`, `manifest.json` | Icône de l'appli (écran d'accueil du téléphone, onglet du navigateur) |
| `serveur.ps1`, `lancer-serveur.bat` | Petit serveur local pour tester l'appli sur son PC |

## Lancer l'appli sur son PC

Double-clic sur `lancer-serveur.bat`, puis ouvrir http://localhost:8000/
(exemple : http://localhost:8000/?demo).

## Sources

- Activités : [Wikivoyage](https://fr.wikivoyage.org/) (français et anglais), contenu sous licence
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr). La page source est citée
  sous les résultats.
- IA facultative : [Gemini API](https://aistudio.google.com/) (Google), version gratuite.
