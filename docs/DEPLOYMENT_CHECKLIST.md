# Liste de déploiement - Système Admin SAKAN

## Avant le déploiement

### 1. Vérifier les fichiers créés

Nouveaux fichiers :
- [x] `supabase/migrations/20251124220000_create_admins_system.sql`
- [x] Admin Layout et Navigation
- [x] Admin Document Review avec assignation de résidence
- [x] Admin Residences Management
- [x] Admin Syndics List
- [x] Page d'attente pour syndics sans résidence
- [x] Documentation admin

### 2. Vérifier les modifications

Fichiers modifiés :
- [x] `middleware.ts` - Routes admin et check résidence
- [x] `app/app/layout.tsx` - Suppression logique onboarding

Fichiers supprimés :
- [x] `components/app/OnboardingGuard.tsx`
- [x] `components/app/onboarding/OnboardingWizard.tsx`
- [x] `app/app/onboarding/actions.ts`

## Étapes de déploiement

### 1. Appliquer la migration

```bash
# Si vous utilisez Supabase CLI local
npx supabase db push

# OU connectez-vous à Supabase Studio -> SQL Editor
# et exécutez le contenu de:
# supabase/migrations/20251124220000_create_admins_system.sql
```

### 2. Vérifier que la migration a réussi

Exécutez dans Supabase SQL Editor :

```sql
-- Vérifier que la table admins existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'dbasakan' 
  AND table_name = 'admins'
);
-- Doit retourner: true

-- Vérifier les nouvelles colonnes dans syndic_document_submissions
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'dbasakan' 
AND table_name = 'syndic_document_submissions'
AND column_name IN ('reviewed_by', 'reviewed_at', 'assigned_residence_id', 'rejection_reason');
-- Doit retourner 4 lignes
```

### 3. Créer le premier administrateur

**Important** : L'admin doit d'abord créer un compte via l'application.

1. L'admin va sur votre application et se connecte avec Google
2. Notez son email
3. Exécutez dans Supabase SQL Editor :

```sql
-- Récupérer l'ID de l'utilisateur
SELECT id, email, name 
FROM dbasakan.users 
WHERE email = 'votre-admin@example.com';

-- Copier l'ID puis exécuter :
INSERT INTO dbasakan.admins (id, email, full_name, is_active)
VALUES (
  'paste-user-id-here',
  'votre-admin@example.com',
  'Nom Complet',
  true
);
```

### 4. Créer quelques résidences de test

```sql
-- Créer des résidences que l'admin pourra assigner
INSERT INTO dbasakan.residences (name, address, city, bank_account_rib)
VALUES 
  ('Résidence Les Palmiers', '123 Avenue Hassan II', 'Casablanca', NULL),
  ('Résidence Al Majd', '456 Rue Zerktouni', 'Rabat', NULL),
  ('Résidence Anfa', '789 Boulevard Anfa', 'Casablanca', NULL);
```

### 5. Déployer l'application

```bash
# Build et deploy
npm run build

# Vérifier qu'il n'y a pas d'erreurs de build
# Déployer sur votre plateforme (Vercel, etc.)
```

### 6. Tester le workflow complet

#### A. Test Syndic
1. Créer un nouveau compte syndic (Google OAuth)
2. Vérifier l'email → doit recevoir le code
3. Uploader un document → doit voir "En attente de vérification"

#### B. Test Admin
1. Se connecter en tant qu'admin → doit être redirigé vers `/admin`
2. Vérifier que le dashboard admin s'affiche
3. Aller sur "Documents à vérifier" → doit voir le document du syndic
4. Cliquer sur "Vérifier" → modal s'ouvre
5. Approuver avec une résidence → document marqué approuvé

#### C. Retour Syndic
1. Le syndic se reconnecte
2. Doit voir la page "En attente d'assignation"
3. Une fois la résidence assignée par l'admin → doit accéder au dashboard

#### D. Test Rejet
1. Admin rejette un document avec une raison
2. Syndic se reconnecte → doit pouvoir re-uploader
3. Upload nouveau document → workflow recommence

## Après le déploiement

### 1. Monitoring

Surveillez les logs pour :
- Erreurs de migration
- Erreurs d'authentification admin
- Erreurs de redirection middleware

### 2. Vérifications de sécurité

```sql
-- Vérifier les RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'dbasakan'
AND tablename IN ('admins', 'syndic_document_submissions');

-- Doit montrer les policies pour admins et documents
```

### 3. Backup

Avant de déployer en production :
```bash
# Backup de la base de données
npx supabase db dump > backup_before_admin_system.sql
```

## Rollback (en cas de problème)

Si vous devez revenir en arrière :

1. **Restaurer le code** :
```bash
git revert HEAD  # ou le commit spécifique
```

2. **Restaurer la base de données** :
```sql
-- Supprimer les nouvelles colonnes
ALTER TABLE dbasakan.syndic_document_submissions
DROP COLUMN IF EXISTS reviewed_by,
DROP COLUMN IF EXISTS reviewed_at,
DROP COLUMN IF EXISTS assigned_residence_id,
DROP COLUMN IF EXISTS rejection_reason;

-- Supprimer la table admins
DROP TABLE IF EXISTS dbasakan.admins CASCADE;
```

## Support

En cas de problème :
1. Consultez `docs/ADMIN_SYSTEM_OVERVIEW.md`
2. Consultez `docs/ADMIN_SETUP.md`
3. Vérifiez les logs de l'application
4. Vérifiez les logs Supabase

## Checklist finale

- [ ] Migration appliquée avec succès
- [ ] Premier admin créé et peut accéder à `/admin`
- [ ] Au moins une résidence créée
- [ ] Test workflow syndic complet : signup → email → document → attente
- [ ] Test workflow admin : review → approve → assign residence
- [ ] Syndic peut accéder au dashboard après assignation
- [ ] Test rejet de document fonctionne
- [ ] Pas d'erreurs dans les logs
- [ ] Backup de la BDD effectué
- [ ] Documentation mise à jour

## Prêt pour la production !

Une fois tous les tests passés, le système est prêt pour la production.

Les syndics ne pourront plus créer de résidences par eux-mêmes.
Tous les syndics existants avec des résidences continueront de fonctionner normalement.

