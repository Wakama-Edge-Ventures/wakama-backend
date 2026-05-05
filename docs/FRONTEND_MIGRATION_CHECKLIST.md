# Frontend Migration Checklist

## Objectif

Ce document liste l'impact des securisations P0 backend sur les frontends existants.

- Aucun contrat API existant n'a ete change.
- Plusieurs mutations exigent maintenant un `Authorization: Bearer ...`.
- Certains endpoints GET restent publics pour compatibilite, mais deviennent tenant-aware si un Bearer valide est envoye.

## Endpoints Proteges P0

| Methode | Route | Roles autorises | Ownership / contrainte | Risque frontend |
| --- | --- | --- | --- | --- |
| `PATCH` | `/v1/farmers/:id` | `FARMER`, `COOP_ADMIN`, `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | Farmer proprietaire, coop du farmer, institution de la coop, ou superadmin | `HIGH` |
| `POST` | `/v1/parcelles` | `FARMER`, `COOP_ADMIN`, `SUPERADMIN` | Acces au `farmerId` cible obligatoire | `HIGH` |
| `PATCH` | `/v1/parcelles/:id` | `FARMER`, `COOP_ADMIN`, `SUPERADMIN` | Acces a la parcelle via son farmer | `HIGH` |
| `DELETE` | `/v1/parcelles/:id` | `FARMER`, `COOP_ADMIN`, `SUPERADMIN` | Acces a la parcelle via son farmer | `HIGH` |
| `POST` | `/v1/cooperatives` | tout utilisateur authentifie | Bearer requis ; cree une coop avec `adminUserId` du caller si present | `MEDIUM` |
| `PATCH` | `/v1/cooperatives/:id` | `COOP_ADMIN`, `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | Coop du caller, institution de la coop, ou superadmin | `HIGH` |
| `POST` | `/v1/credit-requests` | `FARMER`, `COOP_ADMIN`, `SUPERADMIN` | Acces au `farmerId` cible obligatoire | `HIGH` |
| `PATCH` | `/v1/credit-requests/:id/approve` | `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | Demande liee a l'institution ; `READONLY` refuse | `HIGH` |
| `PATCH` | `/v1/credit-requests/:id/reject` | `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | Demande liee a l'institution ; `READONLY` refuse | `HIGH` |
| `POST` | `/v1/institutions` | `SUPERADMIN` | Aucun autre role autorise | `LOW` |
| `POST` | `/v1/institutions/:id/decisions` | `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | `institutionId` du token doit matcher `:id` sauf superadmin ; farmer visible par l'institution ; `READONLY` refuse | `HIGH` |
| `PATCH` | `/v1/institutions/decisions/:id` | `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | Decision accessible a l'institution ; `READONLY` refuse | `HIGH` |
| `PATCH` | `/v1/institutions/:id/scoring-config` | `INSTITUTION_ADMIN`, `SUPERADMIN` | `institutionId` du token doit matcher `:id` sauf superadmin ; `READONLY` refuse | `HIGH` |
| `POST` | `/v1/activities` | `FARMER`, `COOP_ADMIN`, `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | Acces au `farmerId` cible ; `READONLY` refuse ; `parcelleId` doit appartenir au farmer | `MEDIUM` |
| `POST` | `/v1/messages` | `FARMER`, `COOP_ADMIN`, `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | Acces au `farmerId` et au `cooperativeId` ; le farmer doit appartenir a la coop ; `READONLY` refuse | `MEDIUM` |
| `PATCH` | `/v1/alerts/:id/read` | `FARMER`, `COOP_ADMIN`, `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | Acces a l'alerte ; `READONLY` refuse | `MEDIUM` |
| `PATCH` | `/v1/alerts/read-all` | `FARMER`, `COOP_ADMIN`, `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | `farmerId` ou `coopId` obligatoire et accessible ; `READONLY` refuse | `MEDIUM` |
| `POST` | `/v1/iot-kit-requests` | `COOP_ADMIN`, `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | `coopId` obligatoire hors superadmin ; acces a la coop ; `READONLY` refuse | `MEDIUM` |
| `POST` | `/v1/upload/farmer/:farmerId/photo` | `FARMER`, `COOP_ADMIN`, `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | Acces au farmer cible ; fichier valide requis | `HIGH` |
| `POST` | `/v1/upload/farmer/:farmerId/document` | `FARMER`, `COOP_ADMIN`, `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | Acces au farmer cible ; `?type=cni|attestation` ; fichier valide requis | `HIGH` |
| `POST` | `/v1/upload/cooperative/:coopId/logo` | `COOP_ADMIN`, `INSTITUTION_ADMIN`, `MFI_AGENT`, `SUPERADMIN` | Acces a la coop cible ; fichier valide requis | `MEDIUM` |

## GET Compatibles Mais a Migrer

Ces endpoints restent lisibles sans token pour compatibilite temporaire, mais il faut maintenant envoyer le Bearer si possible pour profiter du filtrage tenant-aware :

- `GET /v1/farmers`
- `GET /v1/cooperatives`
- `GET /v1/credit-requests`

Effet si Bearer present :

- `FARMER` voit uniquement ses donnees.
- `COOP_ADMIN` voit uniquement sa coop / ses farmers.
- `INSTITUTION_ADMIN` et `MFI_AGENT` voient uniquement les coops et farmers lies a leur `institutionId`.
- Sans Bearer, le comportement public legacy reste actif.

## Farmer App

### Endpoints critiques a corriger

| Endpoint | Action requise | Priorite | Risque si non corrige |
| --- | --- | --- | --- |
| `PATCH /v1/farmers/:id` | Ajouter `Authorization: Bearer ${wakama_token}` ; utiliser le `farmerId` du user connecte ; ne pas envoyer payload vide ni champs interdits (`id`, `userId`, `role`, `passwordHash`) | `P0` | `401` sans token, `403` si mauvais farmer, `400` si payload invalide |
| `POST /v1/parcelles` | Ajouter Bearer ; envoyer `farmerId`, `name`, `culture`, `superficie`, `lat`, `lng` valides ; verifier que le `farmerId` est bien celui du user ou de sa coop | `P0` | `401`, `403`, `400` |
| `PATCH /v1/parcelles/:id` | Ajouter Bearer ; ne pas envoyer payload vide ; valider `superficie > 0`, `lat/lng` numeriques, `polygone` JSON valide | `P0` | `401`, `403`, `400` |
| `DELETE /v1/parcelles/:id` | Ajouter Bearer ; supprimer seulement une parcelle appartenant au farmer courant | `P0` | `401`, `403` |
| `POST /v1/credit-requests` | Ajouter Bearer ; envoyer `farmerId`, `montant > 0`, `duree > 0`, `objet` non vide ; un farmer ne peut creer que pour lui-meme | `P0` | `401`, `403`, `400` |
| `POST /v1/upload/farmer/:farmerId/photo` | Ajouter Bearer ; utiliser le bon `farmerId` ; envoyer image `jpg/jpeg/png/webp` non vide sous la taille max | `P0` | `401`, `403`, `400` |
| `POST /v1/upload/farmer/:farmerId/document?type=cni|attestation` | Ajouter Bearer ; verifier `type`; envoyer fichier `jpg/jpeg/png/webp/pdf` non vide | `P0` | `401`, `403`, `400` |
| `POST /v1/activities` | Ajouter Bearer ; `farmerId` obligatoire ; si `parcelleId` est envoye, il doit appartenir a ce farmer | `P0` | `401`, `403`, `400` |
| `POST /v1/messages` | Ajouter Bearer ; verifier couple `farmerId` / `cooperativeId` ; objet et message non vides | `P0` | `401`, `403`, `400` |
| `PATCH /v1/alerts/:id/read` | Ajouter Bearer | `P0` | `401`, `403` |
| `PATCH /v1/alerts/read-all` | Ajouter Bearer ; envoyer `farmerId` ou `coopId` accessible | `P0` | `401`, `403`, `400` |
| `POST /v1/cooperatives` | Ajouter Bearer si le parcours de creation de coop existe encore dans l'app | `P1` | `401` |
| `POST /v1/upload/cooperative/:coopId/logo` | Ajouter Bearer si la creation/edition de coop est supportee ; verifier que le token est celui d'un `COOP_ADMIN` ou d'un user autorise | `P1` | `401`, `403`, `400` |
| `GET /v1/farmers` | Envoyer Bearer pour beneficier du filtrage tenant-aware et eviter de dependre du mode public legacy | `P1` | fuite fonctionnelle temporaire ou data non restreinte |
| `GET /v1/cooperatives` | Envoyer Bearer | `P1` | listing non filtre |
| `GET /v1/credit-requests` | Envoyer Bearer | `P1` | listing non filtre |

### Points d'attention Farmer App

- Le token client connu dans la doc est `wakama_token` ; il doit etre propage a toutes les mutations protegees.
- Les uploads documentaires retournent toujours une `url`, mais le backend ne met pas automatiquement a jour `cniUrl` / `attestationUrl`. Si le frontend depend d'un `PATCH /v1/farmers/:id` apres upload, ce `PATCH` doit aussi envoyer le Bearer.
- `POST /v1/upload/cooperative/:coopId/document` n'existe toujours pas dans le backend. Le frontend ne doit pas supposer son existence.
- `POST /v1/iot-kit-requests` n'est plus accessible a un `FARMER`. Si un parcours farmer l'utilise encore, il cassera en `403`.

## FMI Dashboard

### Endpoints critiques a corriger

| Endpoint | Action requise | Priorite | Risque si non corrige |
| --- | --- | --- | --- |
| `POST /v1/auth/institution-login` | Preferer cet endpoint pour les comptes institutionnels afin de recuperer `institutionId` et `institutionUserRole` de facon explicite | `P0` | mauvais contexte institutionnel, Bearer insuffisant ou mauvaise UI de droits |
| `PATCH /v1/credit-requests/:id/approve` | Ajouter Bearer institution ; ne pas utiliser un compte `READONLY` ; si `SUPERADMIN`, envoyer `institutionId` quand necessaire | `P0` | `401`, `403`, `400` |
| `PATCH /v1/credit-requests/:id/reject` | Ajouter Bearer institution ; ne pas utiliser `READONLY` | `P0` | `401`, `403`, `400` |
| `POST /v1/institutions/:id/decisions` | Ajouter Bearer ; le `:id` doit matcher l'`institutionId` du token sauf `SUPERADMIN` ; `farmerId` doit etre lie a l'institution | `P0` | `401`, `403`, `400` |
| `PATCH /v1/institutions/decisions/:id` | Ajouter Bearer ; ne pas utiliser `READONLY` | `P0` | `401`, `403`, `404` |
| `PATCH /v1/institutions/:id/scoring-config` | Ajouter Bearer ; utiliser un compte `INSTITUTION_ADMIN` ou `SUPERADMIN` ; si les 4 poids sont envoyes, leur somme doit etre proche de `100` | `P0` | `401`, `403`, `400` |
| `PATCH /v1/alerts/:id/read` | Ajouter Bearer | `P0` | `401`, `403` |
| `PATCH /v1/alerts/read-all` | Ajouter Bearer ; envoyer `farmerId` ou `coopId` relevant de l'institution | `P0` | `401`, `403`, `400` |
| `GET /v1/farmers` | Envoyer Bearer institution pour activer le filtrage par `institutionId` | `P0` | dashboard continue de dependre de la visibilite publique legacy |
| `GET /v1/cooperatives` | Envoyer Bearer institution | `P0` | listing non filtre |
| `GET /v1/credit-requests` | Envoyer Bearer institution | `P0` | listing non filtre |
| `POST /v1/iot-kit-requests` | Ajouter Bearer ; utiliser `coopId` accessible ; ne pas utiliser `READONLY` | `P1` | `401`, `403`, `400` |
| `POST /v1/messages` | Ajouter Bearer si le dashboard envoie des messages vers coop/farmer | `P1` | `401`, `403`, `400` |
| `POST /v1/activities` | Ajouter Bearer si le dashboard saisit des activites pour un farmer | `P1` | `401`, `403`, `400` |
| `POST /v1/upload/cooperative/:coopId/logo` | Ajouter Bearer si le dashboard gere les logos de coop | `P1` | `401`, `403`, `400` |
| `GET /v1/farmers/:id/dossier-comite` | Si le dashboard consomme ce nouveau dossier, Bearer obligatoire des le premier appel | `P1` | `401`, `403` |

### Points d'attention FMI Dashboard

- La doc d'audit signale une incoherence historique : le dashboard utilisait `POST /v1/auth/login` plutot que `POST /v1/auth/institution-login`. Si ce comportement existe encore, il faut au minimum verifier que le token stocke correspond bien a un utilisateur institutionnel et que l'UI recupere `institutionId` / `institutionUserRole`.
- Les roles `INSTITUTION_ADMIN` et `MFI_AGENT` peuvent muter certaines ressources, mais un `institutionUserRole = READONLY` sera bloque en `403`.
- Le frontend doit utiliser le bon `institutionId` dans les routes `/v1/institutions/:id/...` et dans `GET /v1/scores/:farmerId?institutionId=...`.
- Le backend n'expose toujours pas de `PATCH /v1/credit-requests/:id` generique. Le frontend doit appeler explicitement `/approve` ou `/reject`.

## Recommandations Techniques Frontend

- Toujours envoyer `Authorization: Bearer ...` sur toutes les mutations protegees.
- Envoyer aussi le Bearer sur `GET /v1/farmers`, `GET /v1/cooperatives` et `GET /v1/credit-requests`.
- Centraliser un client API unique avec injection automatique du token.
- Gerer `401` par nettoyage de session et redirection login.
- Gerer `403` avec un message propre de droits insuffisants.
- Ne jamais stocker le token de facon insecurisee en dehors du mecanisme deja retenu par chaque app.
- Unifier clairement la cle de stockage et l'usage des tokens :
  - Farmer App : verifier `wakama_token`
  - FMI Dashboard : eviter la multiplication de cles type `wakama_fmi_token` si une seule session suffit
- Verifier que le `farmerId`, `coopId` et `institutionId` envoyes viennent du contexte utilisateur ou des ressources visibles, pas d'un etat stale.
- Verifier les payloads avant envoi pour eviter les nouveaux `400` :
  - `credit-requests` : `farmerId`, `montant`, `duree`, `objet`
  - `parcelles` : `name`, `culture`, `superficie`, `lat`, `lng`
  - `scoring-config` : poids numeriques et somme coherente
  - `alerts/read-all` : `farmerId` ou `coopId`
- Pour les uploads :
  - verifier l'extension et le MIME en client si possible
  - refuser les fichiers vides
  - respecter la taille max backend

## Points de Rupture Principaux

- Appel d'une mutation sans Bearer : retour `401 Unauthorized`.
- Appel avec le mauvais token ou le mauvais role : retour `403 Forbidden`.
- Appel institutionnel avec utilisateur `READONLY` : retour `403 Forbidden`.
- Payload ancien ou incomplet sur `credit-requests`, `parcelles`, `scoring-config`, `uploads` : retour `400 Bad Request`.
- Utilisation continue des GET publics sans Bearer : pas de rupture immediate, mais dependance au mode compatibilite legacy.

## Backend Changes in This Audit

- Aucun changement de logique metier.
- Aucun changement de contrat API.
- Aucun log supplementaire n'a ete ajoute dans ce chantier pour garder le backend strictement non destructif.
