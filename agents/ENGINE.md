# Le moteur d'animation (style A) — manuel de l'agent

Tout est dessiné par le code (Remotion, 1080 × 1920, 30 i/s). Seule la voix vient d'OpenRouter (ElevenLabs, voix `F9KUTOne5xOKqAbIU7yg`). Tu écris un storyboard JSON (`storyboards/<page>-<sujet>.json`) : une liste de `beats`, un par phrase de voix off. La durée de chaque beat vient de la voix ; toutes les animations sont donc exprimées en fractions du beat (`at` de 0 à 1).

## 1. Cadre et lisibilité (règles impératives)
- **Écran** : 1080 × 1920.
  - HUD (badge de page, horloge) : y < 260.
  - **Sous-titres** : bande y ≈ 1170–1280.
  - **Zone de jeu** : y 300–1140.
- Rien d'important (visage, pieds, chiffre, étiquette) ne doit passer sous le HUD ni sous les sous-titres.
- **Caméra des scènes `action`** : `camera: [{at, x, y, zoom}]`.
  - Le point (x, y) du monde s'affiche au centre de l'écran (540, 960).
  - Position à l'écran d'un point du monde : `960 + (y_monde − camera.y) × zoom`.
  - Pour garder des pieds au sol (y = G) au-dessus des sous-titres : `camera.y ≥ G − 175 / zoom`.
  - La caméra est automatiquement bornée au décor.
  - Zooms conseillés : 1,2 à 2,2. Le zoom reste net au pixel près.
- **Personnages** : échelle 6 à 9.
  - Un personnage debout mesure environ 42 × échelle × zoom pixels.
  - Les tenues claires (`mid3`, `paper`) se lisent sur les décors sombres. Évite d'empiler sombre sur sombre.
- **Étiquettes** (`pins`, `label` d'acteur) : elles basculent seules à gauche près du bord droit. Garde-les sous le HUD (y écran > 330).
- **Pas de vide** : chaque plan a un sujet net et centré, et un fond vivant (décor, ou fond texturé automatique). Un grand chiffre seul se complète (blocs, sous-titre, décor dessous via `under`).

## 2. Scènes disponibles
Les scènes de données sont listées dans `src/styles/A-hud/director.md` :
- `bigDate`, `counter` (`blocks`), `iconGrid`, `checklist`, `clock`, `gauge`, `stamp`, `bigWord` (`streaks`) ;
- `typedNote` (citation, `face` en option), `dossier` (`face`, `stamp`), `portrait` (`face`, `alarm`, `bpm`) ;
- `map` (globe ou plat, `highlight`, `pin`, `route`), `radar`, `inventory`, `thought` ;
- `scoreboard`, `lineChart` (`min`, `max`, `decimals`), `versus`, `timeline`, `podium`, `newspaper`, `backdrop`.

Toute scène accepte `under` (une autre scène dessous) et `bpm`.

### `action` — la scène qui raconte
```json
{"type":"action","terrain":"track","worldW":300,
 "args":{"water":[1,0],"hole":[0,1,0.6,0.7],"open":true},
 "actors":[{"figure":{…tenue…},"cycle":2.8,"shadow":1284,"trail":1,
            "keys":[{"at":0,"x":300,"y":1284,"scale":8,"pose":"sprint"},
                    {"at":0.45,"x":1000,"ease":"linear"},
                    {"at":0.8,"x":1600,"pose":"land","arc":200}],
            "label":{"text":"Bob Beamon","sub":"USA","from":0.1,"to":0.5,"dy":300},
            "clipBelow":440},
           {"sprite":"sub","keys":[{"at":0,"x":560,"y":900,"scale":7}],"glow":true}],
 "camera":[{"at":0,"x":420,"y":1215,"zoom":1.5},{"at":1,"x":900,"y":1215,"zoom":1.6}],
 "bursts":[{"at":0.8,"x":1600,"y":1290,"kind":"sand","n":30}],
 "speedLines":{"from":0.1,"to":0.45,"dir":"left"},
 "shake":[{"at":0.8,"amp":20}], "flashAt":[0.35],
 "measures":[{"at":0.84,"x1":1020,"y1":1340,"x2":1640,"y2":1340,"label":"8,90 m"}],
 "texts":[{"at":0.3,"dur":0.2,"x":540,"y":660,"text":"À VENDRE","size":64,"color":"accent","box":true,"rot":-4}],
 "pins":[{"x":1548,"y":1250,"label":"Fin du rail","at":0.6,"stick":60}]}
```
- **`args`** : un nombre est une valeur fixe, `[a, b]` s'anime sur tout le beat, `[a, b, t0, t1]` s'anime entre deux instants.
- **Clés d'acteur** (`keys`) :
  - `x`, `y` : pieds de l'acteur, en coordonnées du monde ;
  - `scale`, `rot`, `opacity`, `flip`, `pose` ;
  - `ease` : `linear`, `in`, `out`, `inOut`, `back`, `bounce` ou `step` ;
  - `arc` : saut parabolique entre la clé précédente et celle-ci.
  - Un changement de pose se fond sur `blend` (fraction du beat, 0,05 par défaut).
- **`bursts`** : `dust`, `sand`, `splash`, `water`, `debris`, `spark`, `smoke`, `bubbles`, `confetti`, `impact`, `sonar`. Chacun déclenche son propre son.

## 3. Personnages articulés (`figure`)
- **Poses** :
  - cycliques (vitesse réglée par `cycle`) : `walk`, `run`, `sprint`, `dig`, `crawl`, `swim`, `climb`, `talk`, `wave`, `celebrate`, `idle` ;
  - fixes : `stand`, `takeoff`, `hang`, `flight`, `land`, `crouch`, `kneel`, `kneelDown`, `kneelCover`, `standCover`, `measure`, `fall`, `lie`, `sit`, `point`, `push`, `shrug`, `salute`, `hold`.
- **Tenue** :
  - couleurs (`top`, `bottom`, `skin`, `hair`, `shoes`, `hatColor`) : `accent`, `accentDark`, `white`, `paper`, `mid1`, `mid2`, `mid3`, `plum`, `plum2`, `black` ;
  - `hairStyle`, `hat` (`cap`, `tophat`, `helmet`, `beret`, `police`, `bowler`) ;
  - `sleeves`, `shorts`, `coat`, `tie`, `number`, `mustache` ;
  - `prop` : `briefcase`, `shovel`, `torch`, `paper`, `cane`, `flag`, `drill`.

## 4. Visages (`face`, dans `portrait`, `dossier` et `typedNote`)
- `tone` : `light`, `medium` ou `dark`.
- `hair` : `short`, `slick`, `curly`, `afro`, `bald`, `military`, `long` ou `receding` ; `hairColor`.
- `hat` : `navy`, `fedora`, `tophat`, `bowler` ou `cap`.
- `mustache`, `beard`, `glasses`.
- Expression :
  - `brows` : `neutral`, `worried`, `angry` ou `raised` ;
  - `eyes` : `open`, `wide`, `narrow` ou `closed` ;
  - `mouth` : `neutral`, `smile`, `open`, `tense`, `shout` ou `smirk`.
- `outfit` : `suit`, `navy`, `jersey`, `tshirt`, `coat`, `sweater` ou `overalls`.
- `sweat`, `age`, `jaw`, `seed`.

Le visage cligne des yeux, regarde, respire et transpire tout seul.

## 5. Décors (`terrain`) et leurs arguments
Repères : 1 pixel de décor = 6 pixels d'écran (y_écran = y_décor × 6).

| Décor | Usage | Repères, arguments |
|---|---|---|
| `track` (worldW 300) | athlétisme, saut | sol y = 1284, planche x ≈ 990–1020, sable 1074–1704, rail du viseur jusqu'à 1554 |
| `brickwall` | mur, message, trou | `hole` 0→1, `holeX`, `holeY` (en pixels de décor) |
| `vault` | salle des coffres | `open` (part des coffres forcés), `hole`, `holeY` ; sol y = 1116 |
| `vaultdoor` | porte blindée ronde | `turn` (volant) ; sol y = 1140 |
| `tunnel` | intérieur de galerie | `face` (front de taille) ; sol y = 1140 |
| `sewer` | coupe ville / égout / banque | `dig` 0→1 (avancée du tunnel) |
| `courthouse` | façade, fenêtre, rue | `open` (fenêtre) ; trottoir y = 1032 |
| `lake` | coupe d'un lac et d'une mine | `water`, `hole`, `flood`, `vortex`, `fall`, `geyser`, `deep`, `drill` ; surface y = 432 |
| `mine` | galerie de mine de sel | `flood` ; sol y = 1116 |
| `paris` | Paris, tour Eiffel | `towerX` ; sol y = 1116 |
| `hotel` | salon de grand hôtel | `windowX`, `chandelierX` ; sol y = 1116 |
| `ocean` | navires et sous-marin en coupe | `lights` (projecteurs) ; surface y = 402 |
| `subInterior` | intérieur de sous-marin | `alarm`, `heat` ; sol y = 1116 |

Les anciens décors restent disponibles : `storm`, `sky`, `jungle`, `river`, `sea`, `underwater`, `city`, `desert`, `room`, `stadium`, `space`, `lab`, `office`, `courtroom`, `street`, `prison`.

**Si ton histoire a besoin d'un décor qui n'existe pas, dessine-le** dans `src/styles/A-hud/scenes/terrains.ts`, sur le même principe : canvas basse résolution, tramage, palette de la page. Il en va de même pour un sprite (`src/styles/A-hud/sprites.ts`) ou une pose (`src/styles/A-hud/figure.tsx`). C'est ce qui rend chaque vidéo unique.

## 6. Son et texte
- **Bruitages** : `"sfx": ["boom@0.62:0.6"]` joue `boom` à 62 % du beat, au volume 0,6.
- **Ambiances** (au niveau de l'épisode) : `amb-drone`, `amb-tension`, `amb-rain`, `amb-storm`, `amb-underwater`, `amb-wind`, `amb-jungle`, `amb-room`.
- **Nombres dans la voix off** : écris « 4000 » ou « 50 000 » (les milliers restent groupés dans les sous-titres). Le guillemet ouvrant « s'attache au mot suivant.

## 7. Contrôle qualité avant publication
1. `npx tsx pipeline/preview.ts --brand <page> --storyboard <fichier>` produit une prévisualisation muette, sans coût.
2. `npx tsx pipeline/stills.ts public/ep/preview-<page>/episode.json --at 0.2,0.6,0.9` donne 3 images par plan. `--strip 8` donne une pellicule pour vérifier un mouvement image par image.
3. Regarde chaque image :
   - rien n'est coupé ni caché par le HUD ou les sous-titres ;
   - aucun texte ne déborde ;
   - aucune silhouette ne se perd dans le fond ;
   - les échelles restent cohérentes d'un plan à l'autre ;
   - aucun plan n'est vide.
4. Corrige, recommence. Ensuite seulement : `npm run make -- --brand <page> --topic "<sujet>" --storyboard <fichier>`. La voix est générée une seule fois, et un nouveau rendu la réutilise gratuitement.
5. Sur la vidéo finale : planche à 1 i/s (ffmpeg), durée 55–75 s, −14 LUFS (`qa.json`).
