# 📝 TP Bonus : Monitoring de la Posture en Temps Réel

## Objectif du Projet

Ce projet mesure la posture d'un utilisateur en continu via **5 capteurs MPU-6050** positionnés sur différentes zones dorsales :

- cervical  
- haut du dos  
- lombaire  
- épaule gauche  
- épaule droite  

Nous récupérons également la temperature du premier capture et la notion "up" pour dire que nous envoyons bien de la donnée.

Les données sont envoyées vers un serveur **Node.js** (`bridge.js`), qui les stocke dans une **base de données Time-Series (PostgreSQL / TimescaleDB)** pour traitement, agrégation et rétention automatique.  

**Objectifs pédagogiques :**

- Utiliser un microcontrôleur ESP32 pour récupérer et transmettre les données de capteurs
- Stocker les données de manière temporelle et optimisée
- Implémenter l'agrégation et la suppression automatique des données
- Préparer une architecture Dockerisée pour la simplicité et la portabilité

---

## Architecture du Système

```
   ┌───────────────┐
   │   ESP32 / Wokwi│
   │ 5 × MPU-6050  │
   │Temperature + Status
   └───────┬───────┘
           │ HTTP POST
           ▼
   ┌───────────────┐
   │ bridge.js     │
   │ Node.js       │
   │ Normalisation │
   │ + Insertion   │
   └───────┬───────┘
           │
           ▼
   ┌───────────────┐
   │ PostgreSQL    │
   │ TimescaleDB   │
   │ Hypertables   │
   │ Aggregation   │
   │ Retention     │
   └───────────────┘
```


### Flux des Données

1. **L'ESP32** interroge les 5 capteurs toutes les 500 ms et envoie les données via une requête **POST HTTP** à `bridge.js`. Pour économiser l'énergie, le microcontrôleur passe en deep sleep et se réveille automatiquement toutes les 10 secondes.

2. **bridge.js** (serveur Node.js) normalise les données reçues et les insère dans la base de données selon 3 tables :
   - `posture_raw` → données des 5 capteurs
   - `temperature_raw` → lectures de température
   - `status_log` → état et activité du microcontrôleur

3. **TimescaleDB** gère le stockage temporel et l'optimisation :
   - Utilise des **hypertables** pour organiser les données chronologiques
   - **Agrège** les données toutes les 5 minutes dans la table `posture_5min`
   - Exécute automatiquement une **politique de rétention** (10 minutes) pour limiter l'espace disque

---

## Stack Technologique

| Composant              | Technologie / Bibliothèque |
|------------------------|----------------------------|
| Microcontrôleur        | ESP32 (simulé sur Wokwi)   |
| Capteurs               | MPU-6050                   |
| Bridge / Normalisation | Node.js (`bridge.js`)      |
| Base de Données        | PostgreSQL + TimescaleDB   |
| Containerisation       | Docker & Docker Compose    |
| Tunnel Cloud           | Cloudflare Tunnel          |
| Dépendances Node.js    | `pg`, `ws`                 |

---

## Démarrage du Système

```bash
# 1. Créer un tunnel Cloudflare pour exposer localhost:8081
npx cloudflared tunnel --url http://localhost:8081
# (Copier l'URL générée dans le script Wokwi)

# 2. Lancer les services (PostgreSQL + TimescaleDB)
docker compose up -d

# 3. Démarrer le serveur Node.js
npm install
npm start
```

---

## Notes Importantes

- **Simulation :** Le code s'exécute uniquement dans un navigateur web via le projet Wokwi.
- **Lien du projet Wokwi :** https://wokwi.com/projects/457548422898853889

---

**Résumé :** Un système IoT qui mesure et enregistre la posture en temps réel, avec transmission sans fil, stockage efficace et gestion automatique des données anciennes.