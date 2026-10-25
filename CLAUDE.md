# PokéBrawl

Jeu de combats de masse entre Pokémon, en ligne sur https://pokebrawl.fr. Le but est de faire
venir des joueurs sur le site et de les faire jouer (pas de produire des vidéos pour les réseaux sociaux) : on
compose une équipe avec un budget de 1 000 points pour battre une horde, et on peut aussi regarder des combats de
générations ou de types. Projet frère de PokéDate (`../pokedate`), volontairement séparé.
Bun, TypeScript, Vite, PixiJS, Vitest, oxlint, oxfmt, Lefthook.

## Commandes

- `bun dev` : l'application sur http://localhost:5173/ (composition d'équipe), ou un combat direct avec
  `?a=gen1&b=gen3&seed=42&terrain=grass` (`&same=0` pour garder tous les Pokémon des deux équipes). Clavier : Espace pause, 1/2/4 vitesse, R nouveau combat (hors défi du jour et défi d'ami),
  F plein écran, S résultat immédiat ; au toucher, une barre de contrôle apparaît. Défis en ×2 par défaut, combats
  regardés en ×1, chaque mode retient sa vitesse ; ⏭ joue la fin du combat d'un coup (même résultat). `bun dev --host` pour tester sur le téléphone (Wi-Fi).
- `bun run dev:api` (dans un second terminal) : le Worker et une base D1 locale sur le port 8787, pour le classement
  en développement (`bun dev` lui transmet `/api` par un proxy, voir `vite.config.ts`).
- `bun run build` puis `bun run preview` : version de production (application et pages de combat), la seule où le
  service worker (PWA) s'active.
- `bun run matchups` : simule les 198 affiches des pages « qui gagne ? » (200 combats chacune, à nombre égal,
  réparties sur tous les cœurs, environ 4 minutes) dans `src/data/matchups.json` ; à relancer après tout changement
  de la simulation, des coûts ou des données.
- `bun run deploy` : vérifications, sprites, build, mise en ligne sur Cloudflare (Worker `pokebrawl`, même compte
  que PokéDate, plan gratuit), puis migrations de la base D1 `pokebrawl`. Cache long sur `/assets/*`, jamais sur
  `sw.js`, et en-têtes de sécurité sur tout le site (`public/_headers`) : CSP sans script en ligne ni `eval` (PixiJS
  est chargé dans sa version sans `eval`, `pixi.js/unsafe-eval` dans `main.ts`), `nosniff`, pas d'affichage en cadre.
  Toute adresse inconnue répond 404 avec `dist/404.html` (`not_found_handling`), pas avec l'application.
- `bun run verify-daily [--day 2026-10-25|today|yesterday] [--apply] [--local]` : rejoue tous les scores d'un jour du
  classement contre la horde enregistrée avec chacun et liste ceux qui ne gagnent pas vraiment ; `--apply` les
  supprime. Les scores envoyés avant l'enregistrement des hordes (colonne `horde` vide) ne sont pas jugés : les hordes
  suivent les prix, qui ont pu changer depuis. Lancé par `.github/workflows/verify-daily.yml` (secret
  `CLOUDFLARE_API_TOKEN` avec droit d'écriture sur D1) toutes les deux heures de 6 h à 22 h UTC pour le jour même, et
  à 00 h 30 UTC pour la veille entière ; pas plus souvent, le dépôt est privé (2 000 minutes gratuites par mois).
- `bun run audience [--days 7]` : compteurs du site en ligne, jour par jour (visites et provenance, combats par
  mode, victoires, partages, défis envoyés, scores publiés, installations, vidéos, pages « qui gagne ? » lues).
- `bun run sprites` : télécharge les 1025 sprites et les rassemble dans `public/sprites.webp` + `.json`, puis les
  cris dans `public/cries/` (non versionnés, à lancer une fois avant `bun dev` ; les téléchargements restent en
  cache dans `.cache/`)
- `bun run icons` : régénère les icônes de l'application (`public/icons/`) et l'image d'aperçu des liens
  (`public/og.png`), versionnées, depuis ce cache
- `bun run battle --a gen1 --b gen3 --seed 42` : un combat raconté en texte (`--log` pour chaque attaque,
  `--full` pour garder tous les Pokémon au lieu du même nombre par camp)
- `bun run stats --a gen1 --b gen3 --runs 200` : taux de victoire, durée moyenne, meilleurs Pokémon (`--full` aussi)
- `bun run costs` : recalcule `src/data/costs.json` par la simulation (6 tours de 10 000 combats, une quinzaine de
  minutes) ; à relancer après tout changement de la simulation ou des données.
- `bun run balance` : armées de 1 000 points faibles, moyennes, fortes ou d'élite les unes contre les autres, pour
  vérifier que les coûts n'avantagent aucune stratégie (35 à 65 % de victoires attendues)
- `bun run data` : régénère `src/data/pokemon.json` depuis PokéAPI (quelques minutes)
- `bun run check` : lint, formatage, types, tests

Équipes : `gen1` à `gen9`, `type:fire`, `legendaries`, `ids:25,6*3,150` (`*3` : trois exemplaires),
`horde:gen1:1000` (horde fixe de 1 000 points tirée de la Gen 1).

## Conventions (reprises de PokéDate)

- Noms explicites plutôt que des commentaires ; un commentaire seulement pour un choix non évident, en anglais.
- Commits atomiques en Conventional Commits, en anglais, sans aucune mention de Claude (pas de `Co-Authored-By`,
  pas de lien de session).
- Commits directement sur `main`, historique linéaire.
- Textes visibles en français (tutoiement, espaces insécables avant `? ! : ;`) et en anglais (britannique, tutoiement
  sans équivalent : « you »), tous dans `src/messages.ts`.
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
  - `teams.ts` : sélection des équipes, `trimToSameSize` (même nombre par camp, tirage selon la graine), `hordeOf`
    (horde d'une valeur donnée, toujours la même pour un sélecteur, pour qu'on puisse l'étudier).
  - `cost.ts` : coût de chaque Pokémon pour un budget de 1 000 (plancher à 10, donc 100 Pokémon au plus), lu dans
    `src/data/costs.json`, mesuré au combat par `scripts/costs.ts` : chaque Pokémon prend 40 % du budget d'une équipe
    aux coéquipiers tirés au hasard (les mêmes pour tous), face à des équipes mixtes ; plus il laisse de valeur
    debout par rapport au score médian, plus il devient cher. Mesuré seul, une espèce manque de couverture de types
    et les forts peu nombreux se comparent mal aux faibles nombreux : les nuées battaient alors tout le monde. Les
    stats seules ratent l'essentiel, comme la portée des attaques spéciales (5 unités contre le contact) : avec la
    formule de départ (racine de la force, loi de Lanchester), 351 Pokémon étaient nettement trop rentables, 13
    après calibration. Au-dessus du prix médian (25), les prix sont ensuite adoucis (exposant 0,94) : calibrés un par
    un, les gros Pokémon laissaient l'élite à 25-38 %. Équilibre des stratégies (`bun run balance`) : chacune gagne 48
    à 59 % contre une autre. Réglage très sensible (la foule compte au carré) : 0,85 fait gagner l'élite à 97 %.
- `src/render/` : affichage PixiJS dans un canvas à la résolution d'une vidéo, mis à l'échelle par CSS : 1080 × 1920
  si la fenêtre est plus haute que large (téléphone, vidéo verticale), 1920 × 1080 sinon (PC). Tout ce qui doit
  apparaître dans la vidéo est dessiné dans le canvas, jamais en HTML.
  - `layout.ts` : place l'arène selon l'orientation. En paysage, l'arène est simplement tournée d'un quart (premier
    camp à gauche) : la simulation reste 36 × 64, une graine donne le même combat dans les deux formats.
  - `scene.ts` : tout ce qui est dessiné pour un combat ; on en recrée une à chaque combat sans recharger la page
    (recharger ferait sortir du plein écran). Quand la fenêtre change d'orientation, la scène se redessine dans la
    nouvelle disposition sans interrompre le combat.
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
  - `hud.ts` : bandeau du haut (survivants de chaque camp, chrono, part des PV restants).
  - `endScreen.ts` : vainqueur, durée, meilleur Pokémon en grand (sprite agrandi sans lissage), les trois suivants,
    survivants ; mis en page à taille fixe puis réduit pour tenir dans l'arène, dans les deux formats. Après un défi,
    il se range en haut de l'arène (portrait) ou dans sa moitié gauche (paysage) pour laisser la place à la suite en
    HTML, et reprend toute l'arène dans une vidéo.
  - `params.ts` : équipes, graine, terrain et option « même nombre » lus dans l'URL et réécrits dedans.
- `src/locale.ts`, `src/messages.ts`, `src/ui/i18n.ts` : deux langues, choisies par l'adresse (`/` en français,
  `/en/` en anglais ; ni cookie ni redirection, un lien « English » / « Français » en haut de l'accueil, comme sur
  PokéDate). `messages.ts` réunit tous les textes, typés pour que l'anglais ait les mêmes clés ; `index.html` est écrit
  en français et ses éléments portent `data-i18n` (contenu) ou `data-i18n-<attribut>`, traduits au démarrage et, pour
  les moteurs et les messageries, par le Worker sur `/en/`. Noms des Pokémon et des attaques, types et équipes
  (`teamTitle(sélecteur, langue)`) dans la langue de la page. Manifeste anglais à part (`manifest-en.webmanifest`).
- `src/matchups.ts`, `scripts/pages.ts` : pages statiques pour le référencement, écrites dans `dist/` après le
  build de Vite, en français et en anglais (`/en/battles/gen-1-vs-gen-3/`, liées par `hreflang`) : une par affiche
  (`/combats/gen-1-contre-gen-3/` : les 36 duels de générations, les 153 de types,
  les légendaires contre chaque génération), avec victoires, durée, survivants, Pokémon décisifs, bouton « Regarder
  un combat » (une graine où gagne le favori) et liens entre pages ; plus les index `/combats/` et `/en/battles/`,
  `sitemap.xml` (chaque adresse avec sa traduction), `robots.txt` et `404.html`. Les sprites des pages sont de petites
  images découpées dans la planche au build (`/combats/sprites/`), le compteur de lectures un fichier à part
  (`/combats/count.js`, la CSP refusant les scripts en ligne). Adresse publique dans `src/site.ts` (`pokebrawl.fr`, domaine OVH délégué à Cloudflare) ; `www` et l'ancienne
  adresse `workers.dev` redirigent vers lui (`canonicalRedirect`), sauf l'API et `sw.js` pour les applis déjà installées.
- `src/leaderboard.ts`, `src/nickname.ts` : types du classement, validation des équipes envoyées (points recalculés,
  budget, taille) et des pseudos (règles de PokéDate : 2 à 20 caractères, insultes refusées même déguisées).
- `src/friend.ts` : défi entre amis. Lien `?defi=ids:66*12&de=Sacha&seed=42` : l'équipe à battre, qui l'envoie et la
  graine, la même pour les deux joueurs. Vérifié comme un score envoyé (équipe dans les règles, pseudo accepté,
  sinon « Un ami »). Le combat porte `nb=Sacha` dans son URL, d'où « Équipe de Sacha » à l'écran.
- `worker/index.ts` : le Worker. Sert le site, réécrit les pages d'accueil `/` et `/en/` (langue, textes, `canonical`
  et `hreflang`, image `og.png` en adresse absolue ; pour un lien de défi, « Sacha te défie sur PokéBrawl » et l'équipe
  à battre), et
  répond à `GET`/`POST /api/daily/:jour` (base D1 `daily_scores`,
  `migrations/`). Un score par joueur et par jour, le meilleur ; l'identifiant du joueur, aléatoire et gardé dans le
  navigateur, n'est stocké que haché. Équipes révélées une fois le jour fini. Erreurs renvoyées avec un code que l'application traduit (et le texte français pour les anciennes versions).
  Plan gratuit (10 ms de calcul) : pas
  de rejeu du combat au serveur, d'où `bun run verify-daily` ; envois limités à 10 par minute et par IP.
- `src/tracking.ts`, `src/ui/track.ts` : mesure d'audience. Compteurs anonymes par jour (table D1 `event_counts`,
  `POST /api/events`, liste fermée d'événements, 60 par minute et par IP), comptés seulement sur le vrai site et
  hors robots ; une visite et sa provenance une fois par session. Les pages « qui gagne ? » comptent leurs lectures
  avec un petit script.
- `src/daily.ts` : défi du jour. À minuit heure de Paris, une horde de 1 000 points (`horde:gen8:1000:2026-10-24`,
  différente de la horde d'entraînement) et une graine sont tirées de la date, les mêmes pour tous : le résultat ne
  dépend que de l'équipe, c'est une énigme. Score : le moins de points pour gagner ; série de jours réussis.
- `src/ui/` : HTML par-dessus le canvas, donc jamais dans une vidéo enregistrée. `composer.ts` : deux écrans,
  l'accueil (`lobby` : défi du jour en grand avec « Jouer » et le classement, défi d'un ami reçu, Entraînement, Défier
  un ami, Succès) puis le constructeur d'équipe (`builder` : adversaire, équipe, catalogue, « ← » pour revenir) ; défi du
  jour (par défaut, avec record et série) ou entraînement contre une horde au choix (Facile 800, Normal 1 000,
  Difficile 1 250 points) et de l'équipe (doublons permis), catalogue filtrable (`catalogue.ts`)
  avec sprites découpés en CSS dans la planche (`sprites.ts`), dernière équipe et hordes battues retenues dans le
  navigateur (`storage.ts`) ; un défi fini rend son `mode` (`daily`, `training`, `friend`, ou `replay` pour un combat
  rejoué qui ne compte pas). Après un défi (`endActions.ts`) : bilan, résultat, succès, publication au classement,
  « Modifier mon équipe », « Revanche » (entraînement) ou « Partager »
  (défi du jour réussi : score, série et lien, par le partage du téléphone ou le presse-papier). Classement du jour
  et de la veille (`ranking.ts`) : pseudo demandé à la première victoire puis publication automatique, rang affiché
  en fin de combat, « Voir » rejoue l'équipe d'un joueur de la veille. « Défier un ami » (panneau de l'équipe) partage
  un lien de défi (`share.ts` : feuille de partage du téléphone ou presse-papier) ; un lien reçu ouvre l'onglet
  « Défi de Sacha », et une victoire propose de « Renvoyer le défi » avec l'équipe gagnante.
  Un lien `?equipe=ids:25` (depuis PokéDate) ajoute ce Pokémon à l'équipe et le dit au joueur. Aide à la
  composition (`src/advice.ts`) : types dominants de la horde et types à viser (super efficaces sur le plus de ses
  membres), chacun filtre le catalogue ; « Compléter » remplit le budget au hasard. Pokémon attrapés sur PokéDate
  (`src/collection.ts`, lien `#pokedex=` au format de transfert de PokéDate) : étoile ★ et filtre du catalogue,
  sans avantage en combat.
- `src/achievements.ts`, `src/ui/achievementsView.ts` : 15 succès, chacun avec un Pokémon pour emblème. Objectifs
  longs (hordes de génération et de type battues, légendaires, Difficile, séries de 7 et 30 jours, podium, ami
  battu) tirés de ce que le navigateur garde déjà, plus deux compteurs ; exploits jugés sur la victoire (moins de
  500 points, une seule espèce, 60 Pokémon ou plus, 10 ou moins, 10 Magicarpe, uniquement des Pokémon PokéDate).
  Seules comptent les victoires de l'équipe du joueur (défi du jour, entraînement, ami), jamais un combat regardé ni
  une équipe rejouée. Panneau repliable dans la composition, ligne « Succès débloqué » en fin de combat.
- `src/report.ts` : bilan d'un défi en trois phrases au plus (attaques peu efficaces, types punis, meilleur et pire
  rapport dégâts/points), en rejouant le combat en mémoire puisqu'il est déterministe.
- `src/ui/sound.ts` : sons synthétisés (Web Audio, aucun fichier) : impact sourd ou « piou » selon la catégorie,
  hauteur selon le type, plus fort si super efficace, note descendante au K.O., air de victoire ou de défaite ;
  6 sons par 0,1 s au plus hors coups notables ; bouton pour couper, mémorisé. Cris des Pokémon (ceux de PokeAPI,
  comme PokéDate, téléchargés par `bun run sprites` dans `public/cries/`, hors dépôt) : préchargés au lancement d'un
  combat pour les espèces présentes, joués au K.O. (un à la fois, 0,6 s d'écart, sinon le « bip ») et pour le
  meilleur Pokémon sur l'écran de fin. Presque tous en OGG Vorbis (Safari depuis iOS 18.4), trois en MP3 sous la
  même extension : le décodage Web Audio lit le contenu, pas le nom. Menu spectateur (`menu.ts`,
  aperçu des équipes derrière), barre de contrôle qui s'efface pendant le combat (`controls.ts` : pause, vitesse, « Résultat », et un menu « ⋯ » aux actions nommées ; pas de nouvelle graine pour le défi du jour ni le défi d'un ami), installation
  de la PWA (`install.ts`, proposée seulement après une première victoire, fermable pour de bon), enregistrement vidéo (`recorder.ts`, `videoPanel.ts`) : le bouton ● rejoue le combat
  depuis le début en 1080 × 1920 quel que soit l'écran, s'arrête 4,5 s après la fin, puis propose de télécharger la
  vidéo (MP4 si le navigateur sait l'encoder, sinon WebM) ou, sur téléphone, de la partager vers une autre app. Les tailles suivent le petit côté de la scène (unités `cqmin`), dans les deux formats.
- `src/main.ts` : assemble le tout ; plein écran, écran maintenu allumé pendant un combat (Wake Lock). Un lien de
  combat dont une équipe n'existe pas ouvre l'accueil.
- `scripts/d1.ts`, `scripts/download.ts` : requête D1 par Wrangler et téléchargement avec reprises, partagés par les
  scripts.
- `public/` : `manifest.webmanifest` (plein écran, toutes orientations), `sw.js` (cache de l'application et des sprites,
  rafraîchi en arrière-plan : elle s'ouvre hors ligne une fois installée, en français comme en anglais ; une adresse
  avec paramètres n'est jamais gardée, le Worker y écrit le défi d'un ami), icônes.
- `src/data/pokemon.json` : 1025 Pokémon (noms fr/en, types, stats, génération, rareté) et leurs 4 attaques.
  Attaques apprises par niveau (les plus emblématiques ; les CT donneraient Hydrocanon à Magicarpe), une par
  type, triées par puissance attendue. Les attaques sans sens hors tour par tour (charge, recharge, autodestruction)
  sont exclues dans `scripts/fetch-pokemon.ts`. Sans attaque offensive (Métamorph, Qulbutoké…) : Lutte.

## Réglages actuels

- PV ×2 (`HEALTH_MULTIPLIER`) et attaque toutes les 2,5 s environ : un combat de génération dure 35 à 50 s.
- Rayon des Pokémon 0,8 unité pour des sprites de 1,8 : en dessous, la mêlée s'écrase en un tas illisible.
- Même nombre de Pokémon par camp par défaut (menu, URL, ligne de commande) : avec toutes les espèces, l'équipe la
  plus nombreuse gagne presque toujours (Gen 1, 151, contre Gen 3, 135 : 100 % pour la Gen 1). À 135 contre 135, la
  Gen 3 gagne 72 % des combats. Aucun biais de côté : Gen 1 contre Gen 1 donne environ 50/50.

## Feuille de route

1. Simulation sans affichage (fait).
2. Équilibrage : même nombre de Pokémon par camp (fait, par défaut) ; même total de stats par camp.
3. Rendu : Vite + PixiJS, sprites, terrains, PV, K.O., vitesse ×1/×2/×4, vainqueur, menu, plein écran, PWA (fait).
   Effets d'attaque par type, noms d'attaque, « super efficace », écran de fin complet (fait).
4. Export vidéo vertical (fait, secondaire). Mise en ligne sur Cloudflare (fait).
5. Composer son équipe contre une horde (fait). Défi du jour avec record, série et partage (fait).
   Classement du défi du jour (fait). Coûts mesurés au combat, gros Pokémon un peu moins chers (fait).
   Défi entre amis par lien, avec aperçu dans les messageries (fait).
   Liens depuis pokedate.fr (bannière sur les résultats et les fiches, pied de page, Pokédex), aide à la
   composition, bilan, résultat immédiat, son (fait).
   Pages « Gen 1 contre Gen 3 : qui gagne ? » pour le référencement (fait).
   Cris des Pokémon (fait). Mesure d'audience, contrôle de nuit du classement, succès (fait).
   Version anglaise sur `/en/`, application et pages « who wins? » (fait).
6. Domaine pokebrawl.fr (fait). Ensuite : plus tard pronostic, Méga-Évolutions, statuts et talents.

Les sprites et le Pokédex de PokéDate (`../pokedate/scripts/fetch-sprites.ts`) peuvent servir de modèle.
