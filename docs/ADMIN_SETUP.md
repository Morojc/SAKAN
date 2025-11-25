# Guide de configuration des administrateurs SAKAN

## Vue d'ensemble

Les administrateurs sont les utilisateurs qui gèrent le système SAKAN. Ils peuvent :
- Vérifier et approuver les documents des syndics
- Créer et gérer les résidences
- Assigner des résidences aux syndics
- Voir tous les syndics et résidences du système

## Ajout d'un administrateur

Pour des raisons de sécurité, les administrateurs sont ajoutés directement dans la base de données et non via l'interface de l'application.

### Étapes

#### 1. L'utilisateur doit d'abord se créer un compte

L'administrateur doit d'abord créer un compte normal dans l'application :
- Aller sur https://votre-domaine.com
- Se connecter avec Google OAuth
- Cela créera automatiquement un enregistrement dans les tables `auth.users` et `dbasakan.users`

#### 2. Récupérer l'ID de l'utilisateur

Connectez-vous à Supabase SQL Editor et exécutez :

\`\`\`sql
SELECT id, email, name 
FROM dbasakan.users 
WHERE email = 'admin@example.com';
\`\`\`

Notez l'`id` de l'utilisateur.

#### 3. Ajouter l'utilisateur à la table admins

Exécutez cette requête SQL dans Supabase SQL Editor :

\`\`\`sql
INSERT INTO dbasakan.admins (id, email, full_name, is_active)
VALUES (
  'user-id-from-step-2',  -- Remplacez par l'ID réel
  'admin@example.com',     -- Email de l'admin
  'Nom Complet Admin',     -- Nom complet
  true                      -- Est actif
);
\`\`\`

#### 4. Vérifier l'accès

L'administrateur peut maintenant :
1. Se déconnecter de l'application
2. Se reconnecter
3. Il sera automatiquement redirigé vers `/admin` au lieu de `/app`

## Désactiver un administrateur

Pour désactiver un administrateur sans supprimer son compte :

\`\`\`sql
UPDATE dbasakan.admins
SET is_active = false
WHERE email = 'admin@example.com';
\`\`\`

## Réactiver un administrateur

\`\`\`sql
UPDATE dbasakan.admins
SET is_active = true
WHERE email = 'admin@example.com';
\`\`\`

## Supprimer un administrateur

⚠️ **Attention** : Cette action est irréversible.

\`\`\`sql
DELETE FROM dbasakan.admins
WHERE email = 'admin@example.com';
\`\`\`

## Lister tous les administrateurs

\`\`\`sql
SELECT 
  a.id,
  a.email,
  a.full_name,
  a.is_active,
  a.created_at,
  a.last_login_at
FROM dbasakan.admins a
ORDER BY a.created_at DESC;
\`\`\`

## Workflow administrateur

### 1. Vérification des documents
1. L'admin se connecte à `/admin`
2. Clique sur "Documents à vérifier"
3. Voit la liste des documents en attente
4. Pour chaque document :
   - Clique sur "Voir document" pour examiner le fichier
   - Clique sur "Vérifier"
   - **Approuver** : Sélectionne une résidence à assigner
   - **Rejeter** : Indique la raison du rejet

### 2. Gestion des résidences
1. L'admin va sur "Résidences"
2. Clique sur "Nouvelle résidence"
3. Remplit les informations :
   - Nom de la résidence
   - Adresse
   - Ville
   - RIB (optionnel)
4. La résidence est créée et disponible pour assignation

### 3. Après approbation d'un document
Quand un admin approuve un document et assigne une résidence :
1. Le profil du syndic est marqué comme `verified = true`
2. La résidence est assignée au syndic (`residence_id`)
3. Le syndic est redirigé vers le dashboard principal
4. Le syndic peut maintenant gérer sa résidence

## Sécurité

- ✅ Les admins sont ajoutés manuellement via SQL (plus sécurisé)
- ✅ RLS (Row Level Security) est activé sur la table `admins`
- ✅ Les admins inactifs ne peuvent pas accéder au panneau d'administration
- ✅ Le middleware vérifie les permissions admin sur toutes les routes `/admin/*`
- ✅ Les actions admin nécessitent une vérification du statut admin actif

## Dépannage

### L'admin est redirigé vers `/app` au lieu de `/admin`

Vérifiez que :
1. L'utilisateur existe dans la table `admins`
2. Le champ `is_active` est `true`
3. L'ID dans `admins` correspond à l'ID dans `users`

\`\`\`sql
SELECT 
  u.id,
  u.email,
  a.id as admin_id,
  a.is_active
FROM dbasakan.users u
LEFT JOIN dbasakan.admins a ON u.id = a.id
WHERE u.email = 'admin@example.com';
\`\`\`

### L'admin ne voit pas les documents

Vérifiez les permissions RLS :
\`\`\`sql
-- Les admins actifs doivent pouvoir voir tous les documents
SELECT * FROM dbasakan.syndic_document_submissions LIMIT 1;
\`\`\`

Si vous obtenez une erreur de permission, vérifiez que les policies RLS sont correctement configurées.

## Migration

La migration qui crée la table `admins` est :
\`\`\`
supabase/migrations/20251124220000_create_admins_system.sql
\`\`\`

Assurez-vous qu'elle a bien été exécutée :
\`\`\`sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'dbasakan' 
  AND table_name = 'admins'
);
\`\`\`

Si le résultat est `false`, exécutez manuellement la migration.

