# Connecteurs des agents

| Connecteur | Rôle | Comment | Coût |
|---|---|---|---|
| **GitHub** (`aymaneprojects/social-media-maker`) | Mémoire partagée de tous les agents : SOUL, MEMORY, backlog, historique, storyboards | La session cloud clone le dépôt au démarrage ; l'agent commite et pousse à la fin | — |
| **Recherche web** (outil intégré de Claude) | Vérifier chaque fait sur au moins 2 sources fiables (voir la section « Sources fiables » de SOUL.md) | `WebSearch` / `WebFetch` | inclus |
| **OpenRouter → ElevenLabs** | **Uniquement la voix off** (voix `F9KUTOne5xOKqAbIU7yg`, `eleven-multilingual-v2`) | `core/voice.ts` (variable `OPENROUTER_API_KEY`) | ≈ 0,04 $ par vidéo |
| **Upload-Post** | Publication programmée (TikTok, Instagram, Facebook, YouTube) et statistiques par vidéo | `pipeline/schedule.ts`, `pipeline/learn.ts` (variable `UPLOAD_POST_API_KEY`) | abonnement Upload-Post |
| **Outils locaux** | Rendu (Remotion + Chrome), alignement des mots (faster-whisper), audio (ffmpeg) | installés par `scripts/session-setup.sh` | — |

## Profils Upload-Post par page
| Page | Profil Upload-Post |
|---|---|
| Léon Raconte | `pixel-vecu` |
| Margot Enquête | `affaires-classees` |
| Jules Chrono | `legendes-8bit` |
| Céleste Découvre | `labo-pixel` |
| Oscar Compte | à créer : il faut une 5ᵉ place de profil (plan supérieur, ou libérer `default`) |

Le profil `default` (relié à nourlio.app) n'est jamais utilisé.

Les clés restent dans les variables d'environnement du cloud. Elles ne sont jamais écrites dans le dépôt ni dans un message.
