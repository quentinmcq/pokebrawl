# PokéBrawl

Arène de combats de masse entre Pokémon (par exemple Gen 1 contre Gen 3), à regarder plutôt qu'à jouer, pensée
pour produire des vidéos verticales (Reels, TikTok). Projet frère de PokéDate (`../pokedate`), volontairement
séparé : concept, technique (rendu temps réel) et rythme de déploiement différents.
Bun, TypeScript, Vitest, oxlint, oxfmt, Lefthook.

## Commandes

- `bun run battle --a gen1 --b gen3 --seed 42` : un combat raconté en texte (`--log` pour chaque attaque)
- `bun run stats --a gen1 --b gen3 --runs 200` : taux de victoire, durée moyenne, meilleurs Pokémon
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
  - `teams.ts` : sélection des équipes.
- `src/data/pokemon.json` : 1025 Pokémon (noms fr/en, types, stats, génération, rareté) et leurs 4 attaques.
  Attaques apprises par niveau (les plus emblématiques ; les CT donneraient Hydrocanon à Magicarpe), une par
  type, triées par puissance attendue. Les attaques sans sens hors tour par tour (charge, recharge, autodestruction)
  sont exclues dans `scripts/fetch-pokemon.ts`. Sans attaque offensive (Métamorph, Qulbutoké…) : Lutte.

## Réglages actuels

- PV ×2 (`HEALTH_MULTIPLIER`) et attaque toutes les 2,5 s environ : un combat de génération dure 35 à 45 s.
- Gen 1 contre Gen 3 : la Gen 1 gagne presque toujours, surtout grâce au nombre (151 contre 135). Aucun biais de
  côté : Gen 1 contre Gen 1 donne environ 50/50.

## Feuille de route

1. Simulation sans affichage (fait).
2. Équilibrage optionnel : même nombre de Pokémon ou même total de stats par camp.
3. Rendu : Vite + PixiJS, sprites, nom de l'attaque au-dessus du lanceur, effets « super efficace » et K.O.,
   pause et vitesse ×1/×2/×4, écran de fin (vainqueur, survivants, meilleur Pokémon).
4. Graine dans l'URL et export vidéo vertical (MediaRecorder sur le canvas).
5. Ensuite : pronostic avant le combat, mode statistiques dans l'interface, combat du jour, Méga-Évolutions,
   statuts et talents, cris.

Les sprites et le Pokédex de PokéDate (`../pokedate/scripts/fetch-sprites.ts`) peuvent servir de modèle.
