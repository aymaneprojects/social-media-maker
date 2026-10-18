# Les 5 agents éditoriaux

Chaque page a son agent, un spécialiste de son thème, dans `agents/<page>/` :

| Fichier | Rôle | Qui le modifie |
|---|---|---|
| `SOUL.md` | L'âme de l'agent : identité, ton, sous-genres, critères d'un bon sujet, accroches, mise en scène, sources fiables, garde-fous | Toi ou moi, à la main |
| `MEMORY.md` | La mémoire de l'agent : ce qui marche ou non sur cette page, d'après les chiffres et tes rapports | `pipeline/learn.ts`, automatiquement |
| `backlog.json` | La file de sujets (`todo`, `done`, `skipped`), complétée par l'agent à chaque vidéo | L'agent, plus toi si tu veux imposer un sujet |
| `reports/` | Tes rapports d'activité d'autres pages (`.md`, `.txt` ou `.pdf`) | Toi |

`agents/_common.md` contient les règles communes à tous les agents : rétention, accroche, garde-fous.
`agents/PLAYBOOK.md` est le métier de l'agent, étape par étape (une vidéo par session cloud).
`agents/ENGINE.md` est le manuel du moteur d'animation : scènes, décors, personnages, visages, cadrage, contrôle qualité.
`agents/CONNECTORS.md` liste les connecteurs : GitHub, recherche web, OpenRouter (voix seulement), Upload-Post.

## En cloud
Chaque agent est une session Claude planifiée (une par page et par jour) qui clone ce dépôt et suit `PLAYBOOK.md`. C'est Claude qui cherche, écrit, met en scène et vérifie chaque image ; OpenRouter ne fait que la voix.

## Où l'agent intervient dans le pipeline
1. **Choix du sujet** (`pickTopic`) : l'agent lit sa mémoire, évite de répéter le même sous-genre, choisit le meilleur sujet du backlog et ajoute de nouvelles idées.
2. **Recherche** (`research`) : ses sources fiables et ses garde-fous guident la documentation.
3. **Écriture du storyboard** (`direct`) : sa ligne éditoriale, ses accroches, ses scènes préférées et sa mémoire passent avant les règles génériques.

## Boucle d'apprentissage
Chaque semaine, `pipeline/learn.ts` :
1. récupère les statistiques Upload-Post de chaque vidéo : vues, likes, commentaires, partages, temps de visionnage et taux de vidéo vue en entier sur TikTok ;
2. les relie à la fiche de chaque vidéo dans `data/history.json` : sujet, sous-genre, accroche, durée, scènes ;
3. lit les nouveaux rapports déposés dans `reports/` ;
4. met à jour `MEMORY.md` : règles confirmées, hypothèses, choses à éviter.

Pour imposer un sujet : `npm run make -- --brand <page> --topic "..."`.
