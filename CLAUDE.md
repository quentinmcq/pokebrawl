# PokéBrawl

Arène de combats de masse entre Pokémon (par exemple Gen 1 contre Gen 3), à regarder plutôt qu'à jouer, pensée
pour produire des vidéos verticales (Reels, TikTok). Projet frère de PokéDate (`../pokedate`), volontairement
séparé : concept, technique (rendu temps réel) et rythme de déploiement différents.
Bun, TypeScript, Vite, PixiJS, Vitest, oxlint, oxfmt, Lefthook.

## Commandes

- `bun dev` : l'application sur http://localhost:5173/ (menu de lancement), ou un combat direct avec
  `?a=gen1&b=gen3&seed=42&terrain=grass&same=1`. Clavier : Espace pause, 1/2/4 vitesse, R nouveau combat,
  F plein écran ; au toucher, une barre de contrôle apparaît. `bun dev --host` pour tester sur le téléphone (Wi-Fi).
- `bun run build` puis `bun run preview` : version de production, la seule où le service worker (PWA) s'active.
- `bun run sprites` : télécharge les 1025 sprites et les rassemble dans `public/sprites.webp` + `.json`
  (non versionnés, à lancer une fois avant `bun dev` ; les téléchargements restent en cache dans `.cache/`)
- `bun run icons` : régénère les icônes de l'application (`public/icons/`, versionnées) depuis ce cache
- `bun run battle --a gen1 --b gen3 --seed 42` : un combat raconté en texte (`--log` pour chaque attaque,
  `--same` pour le même nombre de Pokémon par camp)
- `bun run stats --a gen1 --b gen3 --runs 200` : taux de victoire, durée moyenne, meilleurs Pokémon (`--same` aussi)
- `bun run data` : régénère `src/data/pokemon.json` depuis PokéAPI (quelques minutes)
- `bun run check` : lint, formatage, types, tests

Équipes : `gen1` à `gen9`, `type:fire`, `legendaries`, `ids:25,6,150`.

## Conventions (reprises de PokéDate)

- Noms explicites plutôt que des commentaires ; un commentaire seulement pour un choix non évident, en anglais.
- Commits atomiques en Conventional Commits, en anglais, sans aucune mention de Claude (pas de `Co-Authored-By`,
  pas de lien de session).
- Commits directement sur `main`, historique linéaire.
- Textes visibles en français (tutoiement, espaces insécables avant `? ! : ;`) ; l'anglais viendra avec l'interface.
- `bunfig.toml` : Bun ignore les versions publiées depuis moins d'un jour.
- Ne lancer les tests que sur demande ; Lefthook (format + lint au commit, types + tests au push) sert de filet.

## Architecture

- `src/simulation/` : logique pure et déterministe, sans affichage. Le rendu (à venir) lira l'état du combat à
  chaque pas sans jamais le modifier.
  - `battle.ts` : arène 36 × 64 unités (9:16), 20 pas par seconde, `createBattle` / `stepBattle` / `runBattle`.
    Chaque Pokémon vise l'ennemi le plus proche qu'il peut toucher, s'approche à portée (contact pour les
    attaques physiques, 5 unités pour les spéciales), attaque selon un délai qui dépend de sa Vitesse.
    Les Pokémon qui se chevauchent se repoussent (grille spatiale).
  - `damage.ts` : formule officielle au niveau 50 (IV parfaits, sans EV, nature neutre), STAB, types,
    critiques 1/24, aléa 85–100 %.
  - `random.ts` : générateur à graine (Mulberry32). Même graine = même combat, indispensable pour rejouer,
    partager un lien et réenregistrer une vidéo.
  - `teams.ts` : sélection des équipes, `trimToSameSize` (même nombre par camp, tirage selon la graine).
- `src/render/` : affichage PixiJS dans un canvas 1080 × 1920 (résolution d'une vidéo verticale, mis à l'échelle
  par CSS). Tout ce qui doit apparaître dans la vidéo est dessiné dans le canvas, jamais en HTML.
  - `scene.ts` : tout ce qui est dessiné pour un combat ; on en recrée une à chaque combat sans recharger la page
    (recharger ferait sortir du plein écran).
  - `playback.ts` : avance la simulation à 20 pas par seconde et interpole les positions entre deux pas pour un
    affichage fluide ; garde la trace des attaques et des coups reçus pour les animations, et transmet les
    événements aux effets. Une attaque spéciale met distance / 30 s à arriver : le flash et la chute de la cible
    attendent l'impact.
  - `effects.ts` : un style par type (18), pas par attaque. Les spéciales lancent un projectile (orbe, rayon,
    éclair, éclats, feuilles, onde, lame d'air), toutes font un impact (gerbe, anneau, étoile, éclaboussure, nuage,
    entaille). « Super efficace » : impact ×1,5 et anneau doré ; critique : grande étoile ; K.O. : nuage blanc. Le
    nom de l'attaque s'élève au-dessus du lanceur pour les coups notables (super efficace, critique, K.O.), 6 à la
    fois au plus. Au-delà de 160 attaques affichées, les coups ordinaires passent sans effet. Aléa propre à la
    graine : une vidéo réenregistrée montre les mêmes effets.
  - `terrain.ts` : sols en pixel art générés à partir de la graine (prairie, désert, toundra, grotte), dans un
    canvas 2D à demi-résolution agrandi sans lissage, pour rester à l'échelle des sprites.
  - `arenaView.ts` : terrain, anneau de la couleur du camp, sprite tourné vers sa cible, élan à l'attaque, flash rouge
    quand il est touché, barre de PV dès la première blessure, chute au K.O.
  - `hud.ts` : bandeau du haut (survivants de chaque camp, chrono, part des PV restants) ; `endBanner.ts` : vainqueur.
  - `params.ts` : équipes, graine, terrain et option « même nombre » lus dans l'URL et réécrits dedans.
- `src/ui/` : HTML par-dessus le canvas, donc jamais dans une vidéo enregistrée : menu de lancement (`menu.ts`,
  aperçu des équipes derrière), barre de contrôle qui s'efface pendant le combat (`controls.ts`), installation
  de la PWA (`install.ts`). Les tailles suivent la largeur de la scène (unités `cqw`).
- `src/main.ts` : assemble le tout ; plein écran, écran maintenu allumé pendant un combat (Wake Lock).
- `public/` : `manifest.webmanifest` (plein écran, portrait), `sw.js` (cache de l'application et des sprites,
  rafraîchi en arrière-plan : elle s'ouvre hors ligne une fois installée), icônes.
- `src/data/pokemon.json` : 1025 Pokémon (noms fr/en, types, stats, génération, rareté) et leurs 4 attaques.
  Attaques apprises par niveau (les plus emblématiques ; les CT donneraient Hydrocanon à Magicarpe), une par
  type, triées par puissance attendue. Les attaques sans sens hors tour par tour (charge, recharge, autodestruction)
  sont exclues dans `scripts/fetch-pokemon.ts`. Sans attaque offensive (Métamorph, Qulbutoké…) : Lutte.

## Réglages actuels

- PV ×2 (`HEALTH_MULTIPLIER`) et attaque toutes les 2,5 s environ : un combat de génération dure 35 à 50 s.
- Rayon des Pokémon 0,8 unité pour des sprites de 1,8 : en dessous, la mêlée s'écrase en un tas illisible.
- Gen 1 contre Gen 3 : la Gen 1 gagne presque toujours, surtout grâce au nombre (151 contre 135). Aucun biais de
  côté : Gen 1 contre Gen 1 donne environ 50/50. Avec `--same` (135 contre 135), la Gen 3 gagne 72 % des combats.

## Feuille de route

1. Simulation sans affichage (fait).
2. Équilibrage optionnel : même nombre de Pokémon par camp (fait) ; même total de stats par camp.
3. Rendu : Vite + PixiJS, sprites, terrains, PV, K.O., vitesse ×1/×2/×4, vainqueur, menu, plein écran, PWA (fait).
   Effets d'attaque par type, noms d'attaque, « super efficace » (fait). Reste : écran de fin complet (survivants,
   meilleur Pokémon).
4. Export vidéo vertical (MediaRecorder sur le canvas). La graine est déjà dans l'URL.
5. Ensuite : pronostic avant le combat, mode statistiques dans l'interface, combat du jour, Méga-Évolutions,
   statuts et talents, cris.

Les sprites et le Pokédex de PokéDate (`../pokedate/scripts/fetch-sprites.ts`) peuvent servir de modèle.
