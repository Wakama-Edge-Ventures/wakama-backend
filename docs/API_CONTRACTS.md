# API Contracts

## GET /v1/scores/:farmerId

- Acces actuel : public, inchange pour compatibilite.
- Aucun champ existant n'est retire.
- Aucun changement Prisma.
- Les nouveaux champs sont calcules a la volee.

### Champs existants conserves

- `score`
- `scoreC1`
- `scoreC2`
- `scoreC3`
- `scoreC4`
- `revenuEstime`
- `montantMinSuggere`
- `montantMaxSuggere`
- `produitSuggere`
- `details`
- `recommendations`
- `eligibilite`

### Champs retrocompatibles ajoutes

- `scoreMax`
- `status`
- `riskLevel`
- `generatedAt`
- `montantMin`
- `montantMax`
- `modelVersion`
- `confidenceLevel`
- `readinessStatus`
- `committeeReadiness`
- `positiveFactors`
- `riskFactors`
- `missingData`
- `nextBestActions`
- `scoreBreakdown`
- `weightsUsed`

### Notes institutionnelles

- `?institutionId=...` continue d'appliquer des poids institutionnels si une configuration existe.
- Les anciens champs `weights`, `institutionId` et `products` restent retournes quand `institutionId` est fourni.
- Le score reste une aide non decisionnelle.

### Exemple abrege

```json
{
  "score": 640,
  "scoreMax": 1000,
  "status": "BON",
  "riskLevel": "LOW",
  "produitSuggere": "Baobab Agri Campagne",
  "montantMinSuggere": 240000,
  "montantMaxSuggere": 800000,
  "montantMin": 240000,
  "montantMax": 800000,
  "modelVersion": "wakama-score-4c-v1.1",
  "confidenceLevel": "MEDIUM",
  "readinessStatus": "READY_FOR_REVIEW",
  "committeeReadiness": {
    "status": "READY_FOR_REVIEW",
    "score": 72,
    "missingRequiredItems": ["Attestation fonciere"],
    "completedItems": ["Photo de profil", "CNI"]
  },
  "positiveFactors": ["KYC documentaire bien complete"],
  "riskFactors": ["NDVI moyen faible"],
  "missingData": ["Attestation fonciere"],
  "nextBestActions": ["Televerser une attestation fonciere"],
  "scoreBreakdown": {
    "C1": {
      "score": 60,
      "weight": 30,
      "label": "Capacite",
      "explanation": "Revenu estime 1 800 000 FCFA sur 2.5 ha."
    }
  },
  "weightsUsed": {
    "weightC1": 30,
    "weightC2": 25,
    "weightC3": 25,
    "weightC4": 20,
    "source": "DEFAULT"
  },
  "generatedAt": "2026-05-03T09:10:00.000Z"
}
```

## GET /v1/farmers/:id/dossier-comite

- Acces : endpoint securise — Bearer obligatoire.
- Sans token : `401 Unauthorized`.
- Token invalide : `401 Unauthorized`.
- Farmer inexistant (avec token valide) : `404 Not Found`.
- Mauvais tenant (farmer hors perimetre du caller) : `403 Forbidden`.
- `FARMER` : son propre dossier uniquement.
- `COOP_ADMIN` : farmers de sa coop uniquement.
- `INSTITUTION_ADMIN` et `MFI_AGENT` : uniquement les farmers rattaches aux coops de leur institution.
- `SUPERADMIN` : acces complet, tous tenants.
- `READONLY` institutionnel (`institutionRole = READONLY`) : **lecture autorisee**. Cet endpoint est en lecture seule ; la restriction READONLY ne s'applique qu'aux mutations. Un READONLY voit le dossier dans le perimetre de son institution, comme un `INSTITUTION_ADMIN`.

### Notice conformite obligatoire

`Décision finale réservée à l’institution.`

### Contrat de reponse

```json
{
  "dossierId": "string",
  "generatedAt": "ISO date",
  "modelVersion": "wakama-score-4c-v1.1",
  "complianceNotice": "Décision finale réservée à l’institution.",
  "farmer": {
    "id": "string",
    "firstName": "string",
    "lastName": "string",
    "phone": "string",
    "email": "string",
    "region": "string",
    "village": "string",
    "lat": 0,
    "lng": 0,
    "onboardedAt": "ISO date",
    "kycStatus": "PENDING",
    "cooperativeId": "string"
  },
  "cooperative": {
    "id": "string",
    "name": "string",
    "region": "string",
    "filiere": "string",
    "rccm": "string",
    "institutionId": "string"
  },
  "kyc": {
    "status": "PENDING",
    "hasPhoto": false,
    "hasCni": false,
    "hasAttestation": false,
    "documents": [
      {
        "type": "CNI",
        "present": false,
        "url": "/uploads/example.pdf",
        "publicUrlWarning": true
      }
    ],
    "missingItems": ["CNI"]
  },
  "parcels": [
    {
      "id": "string",
      "name": "string",
      "culture": "string",
      "superficie": 0,
      "lat": 0,
      "lng": 0,
      "hasPolygon": false,
      "ndvi": 0.42,
      "statut": "ACTIVE",
      "stade": "SEMIS",
      "datePlantation": "ISO date"
    }
  ],
  "agronomicMonitoring": {
    "ndviAverage": 0.42,
    "parcelCount": 1,
    "criticalAlertsCount": 0,
    "warningAlertsCount": 1,
    "latestAlerts": []
  },
  "credit": {
    "activeRequest": {
      "id": "string",
      "statut": "EN_ATTENTE",
      "montant": 500000,
      "montantAccorde": 0,
      "createdAt": "ISO date"
    },
    "historyCount": 1,
    "suggestedAmountMin": 150000,
    "suggestedAmountMax": 600000,
    "productSuggested": "Baobab Agri Production"
  },
  "score": {
    "score": 540,
    "scoreMax": 1000,
    "riskLevel": "MEDIUM",
    "readinessStatus": "READY_FOR_REVIEW",
    "confidenceLevel": "MEDIUM",
    "scoreBreakdown": {},
    "positiveFactors": [],
    "riskFactors": [],
    "missingData": [],
    "nextBestActions": [],
    "weightsUsed": {
      "weightC1": 30,
      "weightC2": 25,
      "weightC3": 25,
      "weightC4": 20,
      "source": "DEFAULT"
    }
  },
  "committeeReadiness": {
    "status": "READY_FOR_REVIEW",
    "score": 72,
    "completedItems": [],
    "missingRequiredItems": [],
    "warnings": []
  },
  "nonDecisioningRecommendation": "Décision finale réservée à l’institution.",
  "audit": {
    "generatedByUserId": "string",
    "generatedByRole": "INSTITUTION_ADMIN",
    "institutionId": "string",
    "source": "API",
    "version": "dossier-comite-v1"
  }
}
```

## Notes

- Aucun changement Prisma n'a ete necessaire.
- Les champs d'explicabilite et le dossier comite sont calcules a la volee.
- Le contrat reste compatible Farmer App et FMI Dashboard car aucun champ existant du score n'est retire.
- `GET /v1/farmers/:id/dossier-comite` est securise des le depart.
