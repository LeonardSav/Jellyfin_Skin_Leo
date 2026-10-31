# LeoFlix

Thème pour Jellyfin 12 : sombre, verre dépoli, accent argent, inspiré de Netflix.
Deux morceaux : une feuille de style (`leoflix.css`) et un petit script facultatif (`leoflix.js`).

## 1. Le thème (CSS)

Dans Jellyfin : **Tableau de bord > Slogan > Code CSS personnalisé**, mettre uniquement :

```css
@import url('https://cdn.jsdelivr.net/gh/LeonardSav/Jellyfin_Skin_Leo@v0.38/leoflix.css');
```

Pour mettre à jour, changer seulement le numéro de version (`@v0.38`), puis Ctrl+F5.
Une version publiée ne change jamais : on choisit quand passer à la suivante.

## 2. Le script (facultatif, recommandé)

Sans script, le thème marche. Le script ajoute :
- **Lecteur** : menus centrés sur leur bouton ; glisser fiable du volume et de la barre de progression (Firefox) ;
  noms clairs des pistes (« English · Stereo », « French · SDH ») ; « Désactivé » en tête des sous-titres ;
  interrupteur du fond des sous-titres ; clic sur un épisode du menu épisodes = lecture ; titre court dans la carte « Épisode suivant ».
- **Navigation** : toutes les bibliothèques dans la barre du haut ; une capsule en verre par groupe de boutons ;
  bibliothèques illustrées sur l'accueil ; liens « ← Bibliothèque » et retour à la série au-dessus du logo.
- **Séries** : carte « Reprendre / À suivre » en haut de la saison ; flèches sur la rangée des saisons ;
  bouton « Infos / Grille » pour les épisodes.
- **Menu LeoFlix** (menu de l'avatar) : thème activé / désactivé et couleur d'accent.
  Ces choix (et Infos / Grille, fond des sous-titres) sont mémorisés **par compte**, sur le serveur.
- **Nouvel appareil** : réglages de base (sous-titres, bouton « Passer » pour les résumés et aperçus)
  seulement si l'appareil n'a encore rien choisi ; un choix existant n'est jamais modifié.

Chaque fonction peut être coupée dans le bloc « Réglages » (`CONFIG`) en tête du script.

**Installer le plugin JavaScript Injector**
1. Tableau de bord > Extensions > Catalogue > ⚙️ > ➕, nom « n00bcodr », adresse :
   `https://raw.githubusercontent.com/n00bcodr/jellyfin-plugins/main/manifest.json`
2. Catalogue > JavaScript Injector > Installer, puis **redémarrer Jellyfin**.

**Ajouter le script**
1. Tableau de bord > JS Injector > Add Script, nom « LeoFlix ».
2. **Lire** puis copier-coller le contenu de `leoflix.js` dans le champ du code.
3. Laisser le script en mode « connecté seulement » (pas public). Ne pas utiliser le champ
   « Script URL » ni l'option d'URL externe : le code est collé à la main, jamais chargé depuis Internet.
4. Enabled coché, Save, puis rafraîchir la page.

Pour mettre à jour : remplacer le code par celui de la nouvelle version, Save, rafraîchir.

**Sécurité, en bref** : un script injecté agit avec les droits de la personne connectée
(administrateur compris). Ne collez que du code que vous avez lu. Ce dépôt ne contient
ni adresse, ni nom d'utilisateur, ni clé.

## 3. Porte de secours

Si l'interface ne s'affiche plus après l'ajout d'un script :
- **Si le tableau de bord s'ouvre encore** : JS Injector > décocher Enabled > Save.
- **Sinon (Docker)** : arrêter Jellyfin, déplacer le dossier du plugin hors du dossier `plugins`
  (rien n'est supprimé), redémarrer. Exemple, en adaptant le chemin de votre dossier `config` :

```sh
docker stop jellyfin
mkdir -p /chemin/vers/jellyfin/plugins-off
mv "/chemin/vers/jellyfin/config/plugins/"JavaScript* /chemin/vers/jellyfin/plugins-off/
docker start jellyfin
```

Pour revenir en arrière, remettre le dossier à sa place et redémarrer.

## Plugins utilisés (facultatifs)

- **File Transformation** : nécessaire dans Docker pour les plugins qui modifient la page web.
- **Editor's Choice** : bandeau du film en tête sur l'accueil.
- **InPlayerEpisodePreview** : menu des épisodes dans le lecteur (le thème le stylise s'il est là).
- **TheIntroDB** : repère intros, résumés, génériques et aperçus (bouton « Passer »).
- **JavaScript Injector** : pour `leoflix.js` (voir plus haut).

## Navigateurs

Testé sur Chrome / Edge / Brave et Firefox (Windows). Le CSS ne s'applique qu'à l'interface web
(navigateur, appli Android, appli PC), pas aux applis TV natives.
Dans l'appli Android, le lecteur vidéo par défaut est natif : il garde l'apparence de l'appli.

Les textes ajoutés par le thème (« Reprendre », noms de qualité…) suivent la langue de Jellyfin :
français si l'interface est en français, anglais sinon.

## Crédits et licence

Police : DM Sans (SIL Open Font License 1.1), via Fontsource.
Thème et script : licence MIT (voir `LICENSE`).
