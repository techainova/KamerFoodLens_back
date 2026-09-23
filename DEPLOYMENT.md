# Déploiement — Contabo VPS

## Schéma

```
kfl_back (push sur main)
        │
        ▼  GitHub Actions (.github/workflows/deploy.yml)
   build image ──push──▶ DockerHub
        │
        ▼  SSH (appleboy/ssh-action)
   Contabo VPS : docker compose pull api && docker compose up -d --no-deps api
```

Sur le VPS, un seul `docker compose` (docker-compose.prod.yml) fait tourner :
nginx (proxy public, 80/443) → api (Nest) → postgres / mongodb / redis / minio /
ai-service, ces cinq derniers sans port publié (réseau Docker interne uniquement).

## Ce qu'il reste à fournir

### 1. Compte DockerHub
- Créer un compte sur hub.docker.com si pas déjà fait.
- Créer un Access Token (Account Settings → Security → New Access Token), pas le mot de passe du compte.
- → secrets GitHub : `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`.

### 2. Le VPS Contabo lui-même
- IP publique du serveur.
- Un utilisateur SSH avec `sudo` (root fonctionne aussi, mais un utilisateur dédié est préférable).
- Une **paire de clés SSH dédiée au déploiement** (ne pas réutiliser ta clé perso) :
  ```
  ssh-keygen -t ed25519 -f kfl_deploy_key -C "github-actions-deploy" -N ""
  ```
  → mets `kfl_deploy_key.pub` dans `~/.ssh/authorized_keys` sur le VPS, et le contenu de `kfl_deploy_key` (la clé privée) devient le secret GitHub `VPS_SSH_KEY`.
- → secrets GitHub : `VPS_HOST` (IP), `VPS_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT` (22 par défaut), `VPS_DEPLOY_PATH` (ex. `/opt/kfl`).

### 3. Le service IA
Le code de ce service n'est pas dans ce repo — il a son propre Dockerfile/repo à construire et pousser sur DockerHub de la même façon que le backend. Une fois son image disponible, renseigne `AI_SERVICE_IMAGE=ton-compte/kfl-ai:latest` dans le `.env` du VPS. En attendant, laisse `ai-service` commenté dans `docker-compose.prod.yml` — le module scan répond juste par une erreur propre (502) sans lui, il n'empêche pas le reste de fonctionner.

### 4. Toutes les valeurs de production dans `.env` (sur le VPS, jamais dans Git)
Mots de passe DB/Redis/MinIO réels (pas les valeurs de `.env.example`), clés JWT RS256 de prod (`openssl genrsa`/`openssl rsa -pubout`), `ENCRYPTION_KEY` de prod, clés Stripe/CinetPay/SMTP/Google réelles, et `ALLOWED_ORIGINS` pointant vers le vrai domaine de l'app. `scripts/vps-setup.sh` génère un gabarit à remplir directement sur place.

### 5. (Optionnel mais recommandé) Un nom de domaine
Sans domaine, l'app reste joignable en HTTP par l'IP du VPS. Avec un domaine pointé sur l'IP (simple enregistrement A), on peut activer HTTPS via Let's Encrypt/certbot — voir la section plus bas.

## Étapes, dans l'ordre

1. **Toi** : crée le compte DockerHub + le VPS Contabo (si pas déjà fait), récupère son IP.
2. **Toi ou moi (si tu me donnes l'accès SSH)** : génère la paire de clés de déploiement, ajoute la clé publique au VPS.
3. **Toi** : dans GitHub → repo kfl_back → Settings → Secrets and variables → Actions, ajoute les 7 secrets listés ci-dessus.
4. **Moi, si tu me donnes l'accès SSH** (ou toi, en suivant `scripts/vps-setup.sh`) : installe Docker sur le VPS, copie `docker-compose.prod.yml` + `nginx/nginx.conf`, remplis `.env`, premier `docker compose up -d`, lance les migrations Prisma.
5. Un push sur `main` déclenche désormais le pipeline automatiquement pour chaque déploiement suivant.

**Si tu veux que je fasse l'étape 4 moi-même** (au lieu de la suivre à la main), il me faut dans ce chat : l'IP du VPS, un utilisateur SSH, et soit un mot de passe soit une clé privée déjà autorisée sur le serveur — je m'en sers uniquement pour cette provision initiale, à partir de cet environnement.

## Estimation du temps

| Étape | Temps |
|---|---|
| Compte DockerHub + token | 5 min |
| Provisioning VPS (créé chez Contabo si pas déjà fait) | 10–30 min (dépend de Contabo) |
| Génération + installation de la clé SSH de déploiement | 5–10 min |
| Configuration des 7 secrets GitHub | 10 min |
| Premier provisioning du VPS (Docker, fichiers, .env, `docker compose up`, migrations) | 30–60 min |
| Premier déploiement via le pipeline (test push → main) | 5–10 min (durée du run CI) |
| DNS + HTTPS (si domaine) | +15–30 min, en plus, une fois le DNS propagé (jusqu'à quelques heures d'attente DNS, pas de travail actif) |
| **Total travail actif** | **≈ 1h15 – 2h30** |

Le service IA (build + push + intégration) n'est pas compté ici puisque son code n'existe pas encore dans cet environnement.

## Ajouter HTTPS plus tard

```
sudo apt install certbot
sudo certbot certonly --standalone -d ton-domaine.example.com
cp /etc/letsencrypt/live/ton-domaine.example.com/*.pem /opt/kfl/nginx/certs/
# décommente le bloc "server { listen 443 ssl; ... }" dans nginx/nginx.conf
docker compose -f docker-compose.prod.yml restart nginx
```
Renouvellement : `certbot renew` via un cron, puis recopier les certs + `restart nginx`.
