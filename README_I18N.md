# Internationalization (i18n) Setup

This project supports multiple languages: **French (fr)**, **English (en)**, and **Arabic (ar)**.

## Architecture

The i18n system uses a client-side React Context provider that:
- Loads translations from JSON files in the `messages/` directory
- Persists the selected language in localStorage
- Automatically sets RTL (Right-to-Left) direction for Arabic
- Provides a simple `t()` function for translations

## Usage

### In Client Components

```tsx
'use client';

import { useI18n } from '@/lib/i18n/client';

export function MyComponent() {
  const { t, locale, setLocale } = useI18n();

  return (
    <div>
      <h1>{t('documentUpload.title')}</h1>
      <p>{t('documentUpload.description')}</p>
      
      {/* With parameters */}
      <p>{t('documentUpload.pendingDesc', { date: '2024-01-01' })}</p>
    </div>
  );
}
```

### Translation Keys

Translation keys use dot notation to access nested objects:
- `common.signOut` → Accesses `common.signOut` in the JSON file
- `documentUpload.title` → Accesses `documentUpload.title` in the JSON file

### Adding New Translations

1. Add the translation key to all three language files:
   - `messages/fr.json` (French)
   - `messages/en.json` (English)
   - `messages/ar.json` (Arabic)

2. Use the key in your component:
   ```tsx
   {t('yourNamespace.yourKey')}
   ```

3. For parameters, use `{paramName}` in the translation string:
   ```json
   {
     "welcome": "Welcome, {name}!"
   }
   ```
   ```tsx
   {t('welcome', { name: 'John' })}
   ```

## Language Switcher

The `LanguageSwitcher` component is already integrated into the Header. It allows users to switch between:
- 🇫🇷 Français (French)
- 🇬🇧 English
- 🇸🇦 العربية (Arabic)

## RTL Support

Arabic automatically enables RTL (Right-to-Left) text direction. The system:
- Sets `dir="rtl"` on the `<html>` element when Arabic is selected
- Sets `dir="ltr"` for other languages

## File Structure

```
messages/
  ├── fr.json    # French translations
  ├── en.json    # English translations
  └── ar.json    # Arabic translations

lib/i18n/
  └── client.ts  # I18n provider and hook

components/i18n/
  └── LanguageSwitcher.tsx  # Language selection component
```

## Best Practices

1. **Keep translation keys organized**: Use namespaces (e.g., `documentUpload.*`, `common.*`)
2. **Don't hardcode text**: Always use the `t()` function for user-facing text
3. **Test all languages**: Ensure translations work in all three languages
4. **Handle missing translations**: The system falls back to the key name if a translation is missing
5. **Use parameters**: For dynamic content, use parameters instead of string concatenation

## Example: Document Upload Page

The document upload page (`app/app/document-upload/page.tsx`) has been fully internationalized and serves as a reference implementation.

