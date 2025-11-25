# Système d'administration SAKAN - Vue d'ensemble

## Changements majeurs

### Avant
- ❌ Les syndics créaient et configuraient leurs propres résidences
- ❌ Un wizard d'onboarding permettait aux syndics de remplir les informations
- ❌ Les syndics pouvaient accéder au dashboard immédiatement après vérification du document

### Maintenant
- ✅ **Les administrateurs créent et gèrent toutes les résidences**
- ✅ **Les administrateurs assignent les résidences aux syndics lors de l'approbation du document**
- ✅ **Les syndics attendent l'assignation d'une résidence avant d'accéder au dashboard**

## Architecture du système

### 1. Tables de la base de données

#### Table `admins`
```sql
- id (text, PK, FK -> users.id)
- email (text, unique)
- full_name (text)
- created_at (timestamp)
- last_login_at (timestamp)
- is_active (boolean)
```

#### Table `syndic_document_submissions` (mise à jour)
Nouvelles colonnes :
- `reviewed_by` (text, FK -> admins.id)
- `reviewed_at` (timestamp)
- `assigned_residence_id` (bigint, FK -> residences.id)
- `rejection_reason` (text)

#### Table `residences` (inchangée)
- `syndic_user_id` est assigné par l'admin lors de l'approbation

### 2. Pages et routes

#### Routes admin (`/admin/*`)
- `/admin` - Dashboard administrateur
- `/admin/documents` - Vérification des documents
- `/admin/residences` - Gestion des résidences
- `/admin/residences/new` - Créer une résidence
- `/admin/syndics` - Liste des syndics
- `/admin/settings` - Paramètres (à venir)

#### Routes syndic (`/app/*`)
- `/app/verify-email-code` - Vérification email
- `/app/document-upload` - Upload document
- `/app/verification-pending` - Attente vérification document
- `/app/waiting-residence` - **NOUVEAU** - Attente assignation résidence
- `/app` - Dashboard syndic (après assignation résidence)

### 3. Flux de travail complet

#### A. Inscription d'un nouveau syndic

1. **Connexion Google OAuth**
   - Création automatique dans `users` et `profiles`
   - `role = 'syndic'` par défaut
   - `email_verified = false`, `verified = false`

2. **Vérification email**
   - Code à 6 chiffres alphanumériques envoyé
   - Redirection vers `/app/verify-email-code`
   - Après validation : `email_verified = true`

3. **Upload document**
   - Redirection vers `/app/document-upload`
   - Upload procès verbal ou carte d'identité
   - Stockage dans Supabase Storage bucket "SAKAN"
   - Création d'un enregistrement dans `syndic_document_submissions`
   - `status = 'pending'`

4. **Attente vérification**
   - Redirection vers `/app/verification-pending`
   - Page d'attente avec statut du document
   - Possibilité de re-uploader si rejeté

#### B. Workflow administrateur

1. **Admin se connecte**
   - Redirection automatique vers `/admin`
   - Voit les statistiques : documents en attente, résidences, syndics

2. **Vérification des documents**
   - Va sur `/admin/documents`
   - Voit les documents en attente
   - Clique sur "Vérifier" pour examiner

3. **Deux options :**

   **Option A : Approuver**
   - Sélectionne une résidence existante (ou en crée une d'abord)
   - Confirme l'approbation
   - Système fait automatiquement :
     - `profiles.verified = true`
     - `profiles.residence_id = selected_residence`
     - `residences.syndic_user_id = syndic_user_id`
     - `syndic_document_submissions.status = 'approved'`
     - `syndic_document_submissions.reviewed_by = admin_id`
     - `syndic_document_submissions.assigned_residence_id = residence_id`

   **Option B : Rejeter**
   - Indique la raison du rejet
   - Système fait automatiquement :
     - `profiles.verified = false`
     - `syndic_document_submissions.status = 'rejected'`
     - `syndic_document_submissions.rejection_reason = raison`
   - Syndic peut re-uploader un nouveau document

4. **Gestion des résidences**
   - Va sur `/admin/residences`
   - Clique sur "Nouvelle résidence"
   - Remplit : nom, adresse, ville, RIB (optionnel)
   - La résidence est créée et disponible pour assignation

#### C. Après approbation

1. **Syndic avec document approuvé mais sans résidence**
   - Middleware redirige vers `/app/waiting-residence`
   - Page d'attente élégante
   - Affiche le statut : email vérifié ✓, document approuvé ✓, attente résidence ⏳

2. **Syndic avec résidence assignée**
   - Middleware laisse passer
   - Accès complet au dashboard `/app`
   - Peut gérer résidents, finances, annonces, etc.

### 4. Middleware - Logique de redirection

```typescript
if (pathname.startsWith('/admin')) {
  // Vérifier si l'utilisateur est un admin actif
  // Sinon, rediriger vers /app
}

if (pathname.startsWith('/app')) {
  // Pour les syndics :
  if (!email_verified) redirect('/app/verify-email-code')
  if (!verified) {
    if (!document_submitted) redirect('/app/document-upload')
    if (document_pending) redirect('/app/verification-pending')
    if (document_rejected) redirect('/app/document-upload')
  }
  if (verified && !residence_id) redirect('/app/waiting-residence')
  // Sinon, accès au dashboard
}
```

### 5. Sécurité

#### RLS (Row Level Security)
- Table `admins` : Seuls les admins actifs peuvent lire
- Table `syndic_document_submissions` : Admins peuvent tout voir, syndics voient seulement leurs documents
- Table `residences` : Admins peuvent créer/modifier, syndics peuvent lire leur résidence

#### Permissions
- Admins ajoutés manuellement via SQL (plus sécurisé)
- Middleware vérifie `admins.is_active = true` sur toutes les routes admin
- Actions admin vérifient le statut admin avant exécution

### 6. Points clés

✅ **Un syndic = une résidence**
- Vérifié au niveau de la base de données
- `residences.syndic_user_id` est unique (peut être NULL si non assigné)
- Un syndic ne peut pas être assigné à plusieurs résidences

✅ **Workflow linéaire**
- Email → Document → Attente admin → Résidence → Dashboard
- Chaque étape bloquante jusqu'à complétion
- Middleware gère toutes les redirections

✅ **Pas de self-service**
- Syndics ne créent plus de résidences
- Admins contrôlent totalement les résidences
- Meilleure gestion et qualité des données

## Fichiers créés/modifiés

### Nouveaux fichiers
- `supabase/migrations/20251124220000_create_admins_system.sql`
- `app/admin/layout.tsx`
- `app/admin/page.tsx`
- `app/admin/documents/page.tsx`
- `app/admin/documents/actions.ts`
- `app/admin/residences/page.tsx`
- `app/admin/residences/new/page.tsx`
- `app/admin/residences/actions.ts`
- `app/admin/syndics/page.tsx`
- `app/app/waiting-residence/page.tsx`
- `components/admin/AdminHeader.tsx`
- `components/admin/AdminSidebar.tsx`
- `components/admin/DocumentReviewList.tsx`
- `components/admin/DocumentReviewModal.tsx`
- `components/admin/CreateResidenceForm.tsx`
- `docs/ADMIN_SETUP.md`
- `docs/ADMIN_SYSTEM_OVERVIEW.md` (ce fichier)

### Fichiers modifiés
- `middleware.ts` - Ajout des routes admin et check résidence
- `app/app/layout.tsx` - Suppression de la logique d'onboarding

### Fichiers supprimés
- `components/app/OnboardingGuard.tsx`
- `components/app/onboarding/OnboardingWizard.tsx`
- `app/app/onboarding/actions.ts`

## Prochaines étapes (recommandées)

1. **Notifications**
   - Email au syndic quand document approuvé
   - Email au syndic quand résidence assignée
   - Notifications in-app pour admins (nouveau document)

2. **Gestion avancée des résidences**
   - Éditer une résidence existante
   - Réassigner un syndic à une autre résidence
   - Voir l'historique des changements

3. **Analytics admin**
   - Temps moyen de traitement des documents
   - Taux d'approbation/rejet
   - Résidences actives vs inactives

4. **Logs d'audit**
   - Qui a approuvé quel document et quand
   - Qui a créé quelle résidence
   - Historique des actions admin

## Support et maintenance

### Ajouter un admin
Voir `docs/ADMIN_SETUP.md`

### Troubleshooting
- **Admin ne peut pas accéder** : Vérifier `admins.is_active = true`
- **Syndic bloqué sur waiting-residence** : Vérifier que `profile.residence_id` est bien assigné
- **Document non visible** : Vérifier les policies RLS sur `syndic_document_submissions`

### Migrations
Toutes les migrations sont dans `supabase/migrations/`
La migration admin est `20251124220000_create_admins_system.sql`

