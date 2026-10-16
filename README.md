# illustrator-nettoyage-document

**NettoyageDocument.jsx** — nettoyage en profondeur d'un document Adobe Illustrator, avec analyse préalable (ExtendScript, FR/EN).
*Deep cleanup of an Adobe Illustrator document, with a dry-run analysis first.*

> **Statut : non testé dans Illustrator.** La syntaxe ES3 a été vérifiée automatiquement (acorn) et la logique relue, mais le script n'a pas encore été exécuté dans Illustrator. Travaillez sur une **copie** de votre fichier.
> *Status: not tested in Illustrator. ES3 syntax checked (acorn) and logic reviewed only. Work on a copy of your file.*

## Pourquoi / Why

Les fichiers repris d'un client, exportés d'un autre logiciel ou retouchés pendant des mois se remplissent de déchets invisibles : calques vides, groupes imbriqués qui ne contiennent plus rien, masques d'écrêtage orphelins, points isolés, blocs de texte vides. La commande native *Objet > Tracé > Nettoyer* ne traite qu'une partie de ces cas (points isolés, objets non peints, blocs de texte vides) et ignore les calques, les groupes et les masques vides.

Ce script fait tout en une passe, **récursivement** (un groupe ou un calque qui devient vide après nettoyage est supprimé à son tour), et le bouton **Analyser** compte d'abord ce qui serait supprimé **sans rien modifier**.

| Catégorie | Par défaut | Détail |
|---|---|---|
| Calques et sous-calques vides | ✔ | Le dernier calque de premier niveau est toujours conservé. Un calque qui ne contient que des repères n'est pas vide. |
| Groupes vides | ✔ | Y compris les tracés transparents composés vides. |
| Masques d'écrêtage sans contenu | ✔ | Groupes de masque qui ne contiennent plus que le tracé de masque. |
| Points isolés | ✔ | Tracés d'un seul point (hors repères et tracés de masque). |
| Blocs de texte vides | ✔ | Vides ou seulement des espaces / retours. Les blocs chaînés sont ignorés. |
| Tracés sans fond ni contour | ✘ * | Hors repères et tracés de masque. |
| Groupes à un seul objet | ✘ * | Dégroupés seulement s'ils n'ont pas de nom, une opacité de 100 %, le mode Normal, sans isolement ni masquage. |
| Objets masqués | ✘ * | Objets cachés (Objet > Masquer). |

\* *À vérifier avant usage : un tracé peut tirer son aspect d'un style graphique ou d'effets (fonds ou contours ajoutés dans le panneau Aspect) que l'API ne signale pas, et un groupe peut porter des effets.*

Options : portée **Document entier** ou **Sélection uniquement** ; inclure ou non les calques et objets **verrouillés ou masqués** (ignorés par défaut, et remis dans leur état après traitement s'ils sont inclus). Symboles, images, objets de dégradé de forme et autres objets de plug-in ne sont jamais touchés.

## Installation

- **Ponctuelle** : dans Illustrator, *Fichier > Scripts > Autre script…* (Ctrl+F12 / Cmd+F12), puis choisir `NettoyageDocument.jsx`.
- **Permanente** : copier `NettoyageDocument.jsx` dans le dossier `Presets/<langue>/Scripts` d'Illustrator, puis redémarrer Illustrator :
  - Windows : `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\fr_FR\Scripts`
  - macOS : `/Applications/Adobe Illustrator <version>/Presets.localized/fr_FR/Scripts`

  Le script apparaît alors dans *Fichier > Scripts*.

## Utilisation / Usage

1. Ouvrez le document à nettoyer (un message s'affiche si aucun document n'est ouvert). Faites une copie du fichier.
2. Lancez le script. Choisissez la portée (*Sélection uniquement* est grisé si rien n'est sélectionné) et cochez les catégories voulues.
3. Cliquez sur **Analyser** : le nombre d'éléments par catégorie s'affiche dans la fenêtre, rien n'est modifié.
4. Cliquez sur **Nettoyer** pour appliquer. Un bilan s'affiche à la fin.
5. Pour revenir en arrière : Ctrl+Z / Cmd+Z. Selon la version d'Illustrator, l'annulation peut demander plusieurs étapes (ExtendScript ne permet pas de forcer une seule étape d'annulation dans Illustrator), d'où le conseil de travailler sur une copie.

L'interface est en français si Illustrator est en français, sinon en anglais.

## Version ciblée / Target

Illustrator CC 2018 et versions plus récentes (ExtendScript ES3, ScriptUI). Pas d'UXP nécessaire.

## Limites connues / Known limits

- Non testé dans Illustrator : signalez tout problème dans les *Issues*.
- Les nuances, styles graphiques, symboles et formes inutilisés ne sont pas supprimés (Illustrator le fait via les menus des panneaux ; ce sera peut-être une prochaine version).
- Les tracés à l'intérieur des tracés transparents composés ne sont pas analysés individuellement.
- Les plans de travail vides ne sont pas supprimés.

## Projets similaires / Similar projects

Code 100 % original. D'autres outils existent, avec d'autres choix : *Document Cleaner* (Samolevsky), le script de nettoyage de DTP Transit, `DeleteEmptyLayers.jsx` (nvkelso/illustrator-scripts). Celui-ci est gratuit, bilingue FR/EN, propose une analyse sans modification et reste prudent par défaut (textes chaînés, groupes avec effets, objets verrouillés).

## Confidentialité / Privacy

Aucun appel réseau, aucune collecte de données, aucun fichier écrit.

## Licence

MIT — © 2026 Amirouche Amwanes. Voir `LICENSE`.
