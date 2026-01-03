# CloudInfraGen VS Code Extension

Extension VS Code pour générer des modèles d'infrastructure cloud et du code Terraform à partir de descriptions en langage naturel.

## Prérequis

- Node.js (version 18 ou supérieure)
- Java 17 ou supérieur
- Maven 3.6 ou supérieur
- Le projet Java CloudInfraGen doit être accessible (dans le dossier parent par défaut)

## Installation

1. Installer les dépendances :
```bash
cd vscode-extension
npm install
```

2. Compiler l'extension :
```bash
npm run compile
```

3. Pour le développement, utiliser le mode watch :
```bash
npm run watch
```

## Utilisation

### Support du langage .nlp

L'extension fournit un support complet pour les fichiers `.nlp` (Natural Language Processing) :

1. **Syntax Highlighting** : Coloration syntaxique pour les mots-clés cloud (VPC, EC2, RDS, Lambda, etc.)
2. **Autocomplétion** : Suggestions automatiques pour :
   - Types de ressources cloud (VPC, EC2, RDS, Lambda, S3, etc.)
   - Providers (AWS, Azure, GCP)
   - Attributs de ressources (name, region, CIDR, etc.)
   - Mots-clés (create, add, deploy, configure, etc.)
3. **Snippets** : Modèles pré-configurés pour architectures communes :
   - `3tier` : Architecture 3-tier (web, app, database)
   - `serverless` : Architecture serverless avec Lambda
   - `microservices` : Architecture microservices avec conteneurs
   - `webapp` : Application web simple
   - Et des snippets pour ressources individuelles (VPC, EC2, RDS, Lambda, S3, etc.)
4. **Validation** : Vérification simple de la syntaxe et des références

### Commandes

L'extension fournit deux commandes :

1. **Generate Infrastructure from JSON** : Génère l'infrastructure à partir d'une entrée JSON saisie directement
2. **Generate Infrastructure from File** : Génère l'infrastructure à partir d'un fichier JSON

## Configuration

L'extension peut être configurée via les paramètres VS Code :

- `cloudinfragen.javaPath` : Chemin vers l'exécutable Java (par défaut: "java")
- `cloudinfragen.mavenPath` : Chemin vers l'exécutable Maven (par défaut: "mvn")
- `cloudinfragen.projectPath` : Chemin vers le projet Java CloudInfraGen (par défaut: "${workspaceFolder}/.." - dossier parent)

## Structure du projet

```
vscode-extension/
├── src/
│   └── extension.ts      # Code principal de l'extension
├── syntaxes/
│   └── nlp.tmLanguage.json  # Grammaire TextMate pour syntax highlighting
├── snippets/
│   └── nlp.json          # Snippets pour architectures communes
├── examples/
│   └── example.nlp       # Exemple de fichier .nlp
├── out/                  # Fichiers compilés (générés)
├── package.json          # Manifest de l'extension
├── tsconfig.json         # Configuration TypeScript
├── language-configuration.json  # Configuration du langage
└── .vscodeignore         # Fichiers à exclure du package
```

## Développement

### Scripts disponibles

- `npm run compile` : Compile le TypeScript
- `npm run watch` : Compile en mode watch
- `npm run lint` : Vérifie le code avec ESLint
- `npm run package` : Crée un package .vsix

### Débogage

1. Ouvrir le dossier `vscode-extension` dans VS Code
2. Appuyer sur F5 pour lancer une nouvelle fenêtre avec l'extension chargée
3. Utiliser les commandes de l'extension dans la nouvelle fenêtre

## Note

Le projet Java CloudInfraGen doit être dans le dossier parent ou accessible via le chemin configuré dans `cloudinfragen.projectPath`.

