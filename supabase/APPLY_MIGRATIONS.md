# Guide d'application des migrations Supabase

## Migrations en attente

### Migration: `20250123020000_add_get_access_codes_by_email_rpc.sql`
**Statut**: ⚠️ Pas encore appliquée  
**Priorité**: HAUTE - Nécessaire pour éviter l'erreur "permission denied for table access_codes"

## Option 1: Via Supabase Dashboard (Recommandé)

1. Allez sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Cliquez sur **SQL Editor** dans le menu de gauche
4. Cliquez sur **New Query**
5. Copiez et collez le contenu du fichier:
   ```
   supabase/migrations/20250123020000_add_get_access_codes_by_email_rpc.sql
   ```
6. Cliquez sur **Run** (ou appuyez sur `Ctrl+Enter`)
7. Vérifiez qu'il n'y a pas d'erreurs dans la console

## Option 2: Via Supabase CLI (Si configuré)

```bash
# 1. Assurez-vous d'être lié à votre projet
npx supabase link --project-ref YOUR_PROJECT_REF

# 2. Appliquez toutes les migrations en attente
npx supabase db push

# 3. Vérifiez l'état
npx supabase db diff
```

## Option 3: Via psql (Connexion directe)

Si vous avez accès à psql:

```bash
# Connectez-vous à votre base de données
psql "postgresql://[USER]:[PASSWORD]@[HOST]:5432/postgres"

# Exécutez le fichier
\i supabase/migrations/20250123020000_add_get_access_codes_by_email_rpc.sql

# Vérifiez que la fonction existe
SELECT routine_name, routine_schema
FROM information_schema.routines
WHERE routine_schema = 'dbasakan'
AND routine_name = 'get_access_codes_by_email';
```

## Vérification après application

Pour vérifier que la migration a été appliquée avec succès:

1. Allez dans **SQL Editor** de Supabase Dashboard
2. Exécutez cette requête:

```sql
SELECT routine_name, routine_schema
FROM information_schema.routines
WHERE routine_schema = 'dbasakan'
AND routine_name = 'get_access_codes_by_email';
```

3. Vous devriez voir une ligne avec:
   - `routine_name`: `get_access_codes_by_email`
   - `routine_schema`: `dbasakan`

## Note importante

Le code actuel inclut un **fallback automatique** :
- Si la fonction RPC existe → utilise la fonction RPC (performant, sécurisé)
- Si la fonction RPC n'existe pas → essaie une requête directe (peut échouer avec RLS)

Une fois la migration appliquée, l'erreur "permission denied" disparaîtra et la fonction RPC sera utilisée automatiquement.

## Besoin d'aide?

Si vous rencontrez des problèmes:
1. Vérifiez que vous êtes connecté au bon projet Supabase
2. Vérifiez que vous avez les permissions nécessaires (Owner ou Admin)
3. Consultez les logs d'erreur dans la console Supabase

