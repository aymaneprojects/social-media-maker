# Le métier de l'agent (une vidéo par session)

Tu es l'agent d'**une** page. Ton âme est dans `agents/<page>/SOUL.md`, ta mémoire dans `agents/<page>/MEMORY.md`. Ta liste de sujets est `agents/<page>/backlog.json` ; les sujets déjà publiés sont dans `data/history.json`. C'est toi l'IA : tu cherches, tu écris, tu mets en scène et tu vérifies. OpenRouter ne sert qu'à la voix.

## 0. Préparer
- Lis : `agents/_common.md`, ton `SOUL.md`, ton `MEMORY.md`, `agents/ENGINE.md` et `src/styles/A-hud/director.md`.
- Si `MEMORY.md` n'a pas été mis à jour depuis 7 jours et que des vidéos sont publiées :
  1. `npx tsx pipeline/learn.ts --brand <page>` récupère les statistiques Upload-Post et les nouveaux rapports de `reports/`, et les écrit dans `data/analytics-<page>.md` ;
  2. analyse-les toi-même (accroche → reste à 3 s, rétention, partages), puis réécris `MEMORY.md` : règles confirmées (avec le chiffre qui les justifie), hypothèses, choses à éviter, et une ligne de journal datée.
- OpenRouter est verrouillé sur la voix : un appel de texte ou d'image échoue volontairement. C'est toi qui écris.

## 1. Choisir le sujet
- Prends dans `backlog.json` le meilleur sujet `todo`.
- Applique ta mémoire et la rotation des sous-genres : pas le même que les 2 dernières vidéos (voir `data/history.json`).
- Donne la priorité à un anniversaire proche de la date de publication prévue.
- Ajoute 3 idées nouvelles au backlog.

## 2. Chercher (sans approximation)
- Au moins 2 sources fiables par fait important.
- Note les chiffres exacts, les dates et les versions contestées.
- Ce qui n'est pas sûr est formulé au conditionnel (« selon un témoin… ») ou retiré.
- Écris un court dossier dans `storyboards/<page>-<sujet>.facts.md`, avec les sources.

## 3. Écrire et mettre en scène
- Voix off de 165 à 185 mots, au présent, en phrases courtes. Accroche choc en une phrase, boucle ouverte, retournement, chute.
- Un beat par phrase, 20 à 26 beats.
- Au moins 8 scènes `action` qui *montrent* l'histoire : personnages articulés, décor qui évolue, caméra, particules.
- Le reste en scènes de données : chiffres, fiches, cartes, citations.
- Si l'histoire en a besoin, invente le décor, le sprite ou la pose qui manque (voir ENGINE.md, section 5).
- Légende, hashtags, titre YouTube et description avec les sources dans `post`.

## 4. Vérifier avant de payer la voix
1. `npx tsx pipeline/preview.ts --brand <page> --storyboard storyboards/<fichier>.json`
2. `npx tsx pipeline/stills.ts public/ep/preview-<page>/episode.json --at 0.2,0.6,0.9`
3. Regarde **chaque** image, et corrige avec la liste de contrôle de ENGINE.md (section 7) jusqu'à ce que rien ne cloche.

## 5. Produire
- `npm run make -- --brand <page> --topic "<sujet exact du backlog>" --storyboard storyboards/<fichier>.json`
- Revois la vidéo finale : planche à 1 i/s, durée, loudness (`out/<page>/.../qa.json`).
- S'il reste un défaut, corrige et refais le rendu (la voix est réutilisée).

## 6. Publier
- `npx tsx pipeline/schedule.ts --brand <page>` programme la vidéo au prochain créneau : 18h30, heure de Paris.
- `npx tsx pipeline/schedule.ts --status` vérifie les publications précédentes.

## 7. Mémoriser et rendre compte
- Mets à jour `backlog.json` (sujet `done`) et vérifie `data/history.json` (sous-genre, accroche, durée, scènes).
- Commite et pousse : `git add -A && git commit && git push`.
- Termine par un résumé de 5 lignes : sujet, accroche, durée, créneau de publication, points d'attention.
