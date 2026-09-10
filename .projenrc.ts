import fs from "node:fs";
import {
  javascript,
  JsonFile,
  JsonPatch,
  ReleasableCommits,
  TextFile,
  typescript,
} from "projen";
import { ReleaseTrigger } from "projen/lib/release/index.js";
import {
  TypeScriptJsxMode,
  TypeScriptModuleDetection,
  TypeScriptModuleResolution,
  YarnChecksumBehavior,
  YarnNodeLinker,
} from "projen/lib/javascript/index.js";

const effectTsgoPackage = "@effect/tsgo@0.14.0";
const effectLanguageServicePackage = "@effect/language-service@^0.86.2";
const nativePreviewPackage = "@typescript/native-preview@7.0.0-dev.20250906.1";
const lintEffectPackage = "@catenarycloud/linteffect@0.0.7-dev.2";
const yarnVersion = "4.10.3";
const packageManifestPath = "package.json";
const currentPackageVersion = fs.existsSync(packageManifestPath)
  ? JSON.parse(fs.readFileSync(packageManifestPath, "utf8")).version ?? "0.0.0"
  : "0.0.0";

const effectLanguageServicePlugin = {
  name: "@effect/language-service",
  diagnosticSeverity: {
    globalDateInEffect: "error",
    globalDate: "warning",
    globalErrorInEffectCatch: "warning",
    globalFetch: "warning",
    globalFetchInEffect: "error",
    globalRandom: "error",
    globalTimers: "error",
    importFromBarrel: "warning",
    globalConsole: "warning",
    globalConsoleInEffect: "error",
    catchAllToMapError: "warning",
    anyUnknownInErrorContext: "error",
    layerMergeAllWithDependencies: "error",
    nodeBuiltinImport: "error",
    preferSchemaOverJson: "error",
    cryptoRandomUUID: "warning",
    cryptoRandomUUIDInEffect: "warning",
    deterministicKeys: "warning",
    effectDoNotation: "warning",
    newPromise: "warning",
    nestedEffectGenYield: "warning",
  },
  barrelImportPackages: ["effect", "@effect/*"],
  includeSuggestionsInTsc: true,
  ignoreEffectWarningsInTscExitCode: true,
  ignoreEffectSuggestionsInTscExitCode: true,
} as const;
const project = new typescript.TypeScriptAppProject({
  defaultReleaseBranch: "master",
  name: "Unleaded",
  packageName: "@tradedal/unleaded",
  description: "Fast, keyboard-driven CLI search for used-car listings.",
  authorName: "Roman Naumenko",
  authorUrl: "https://www.tradedal.com",
  packageManager: javascript.NodePackageManager.YARN_BERRY,
  projenrcTs: true,
  github: true,
  eslint: false,
  jest: false,
  majorVersion: 0,
  npmAccess: javascript.NpmAccess.PUBLIC,
  npmDistTag: "latest",
  release: true,
  releaseToNpm: true,
  releaseTrigger: ReleaseTrigger.workflowDispatch(),
  releasableCommits: ReleasableCommits.featuresAndFixes(),
  repository: "https://github.com/Tradedal/Unleaded.git",
  workflowNodeVersion: "24.11.1",
  npmignore: [
    "/.claude/",
    "/.yarn/",
    "/AGENTS.md",
    "/biome.jsonc",
    "/cache/",
    "/coverage/",
    "/design/",
    "/blocked-dealers.json",
    "/check-files.ts",
    "/test-reports/",
    "/vitest.config.ts",
    "/lib/**/*.test.js",
  ],
  yarnBerryOptions: {
    version: yarnVersion,
    zeroInstalls: false,
    yarnRcOptions: {
      checksumBehavior: YarnChecksumBehavior.UPDATE,
      enableImmutableInstalls: false,
      nodeLinker: YarnNodeLinker.NODE_MODULES,
    },
  },
  tsconfig: {
    compilerOptions: {
      // https://www.effect.solutions/tsconfig
      incremental: true,
      tsBuildInfoFile: ".tsbuildinfo",
      moduleDetection: TypeScriptModuleDetection.FORCE,
      verbatimModuleSyntax: true,
      strict: true,
      noUnusedLocals: true,
      noImplicitOverride: true,

      declaration: false,
      noImplicitReturns: true,
      experimentalDecorators: false,
      target: "ESNext",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      noEmit: false,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: TypeScriptModuleResolution.BUNDLER,
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: TypeScriptJsxMode.REACT_JSX,
      paths: {
        "@/*": ["./src/*"],
        "@/backend/*": ["../backend/amplify/*"],
      },
      rootDir: ".",
      outDir: "lib",
      // incremental: true // didn't work?!
    },
    exclude: ["src/**/*.test.ts"],
    include: ["next-env.d.ts", "src/**/*.tsx", "src/**/*.ts", "main.tsx"],
  },
  gitignore: ["blocked-dealers.json", "cache", "lib", "test-reports"],
  devDeps: [
    "@types/react@^19.0.0",
    "@biomejs/biome@2.4.12",
    "tsx@^4.23.13",
    "vitest@^3.2.4",
    effectTsgoPackage,
    lintEffectPackage,
    nativePreviewPackage,
    effectLanguageServicePackage,
  ],
  deps: [
    "@effect/atom-react@4.0.0-beta.100",
    "@effect/platform-node-shared@4.0.0-beta.100",
    "@effect/platform-node@4.0.0-beta.100",
    "date-fns@^4.1.0",
    "effect@4.0.0-beta.100",
    "ink@^6.6.0",
    "ink-spinner@^5.0.0",
    "react@^19.2.4",
    "scheduler@^0.27.0",
  ],
});

project.release?.publisher?.publishToNpm({
  trustedPublishing: true,
});

project.postCompileTask.exec("chmod +x lib/src/main.js");

const generatedTsConfig = project.tryFindObjectFile("tsconfig.json");
if (generatedTsConfig) {
  generatedTsConfig.addOverride("compilerOptions.plugins", [
    effectLanguageServicePlugin,
  ]);
}

project.tryRemoveFile(".vscode/settings.json");
new TextFile(project, ".vscode/settings.json", {
  lines: [
    "{",
    '  "js/ts.tsdk.path": "node_modules/typescript/lib",',
    '  "js/ts.tsdk.promptToUseWorkspaceVersion": false,',
    '  "js/ts.experimental.useTsgo": true,',
    '  "editor.codeActionsOnSave": {',
    '    "source.fixAll.biome": "explicit",',
    '    "source.organizeImports.biome": "explicit"',
    "  },",
    '  "editor.insertSpaces": true,',
    '  "editor.tabSize": 2,',
    '  "editor.detectIndentation": false',
    "}",
  ],
});

project.package.addField("type", "module");
project.package.addField("bin", "./lib/src/main.js");
project.package.addVersion(currentPackageVersion);
project.package.addField("keywords", ["cars", "cli", "listings", "terminal"]);
project.npmignore?.addPatterns("/lib/**/*.test.js");
project.package.addField("homepage", "https://github.com/Tradedal/Unleaded#readme");
project.package.addField("bugs", "https://github.com/Tradedal/Unleaded/issues");
project.package.addField("files", ["lib", "README.md", "LICENSE"]);

project.testTask.reset();
project.testTask.exec("vitest run");

const testWatchTask = project.tasks.tryFind("test:watch");
if (testWatchTask) {
  testWatchTask.reset();
  testWatchTask.exec("vitest");
}

new JsonFile(project, "biome.jsonc", {
  marker: false,
  obj: {
    root: true,
    extends: ["@catenarycloud/linteffect"],
    assist: {
      enabled: true,
      actions: { recommended: false },
    },
    files: {
      includes: ["src/**/*.ts", "src/**/*.tsx", ".projenrc.ts"],
      ignoreUnknown: false,
    },
    formatter: {
      enabled: true,
      indentStyle: "space",
      indentWidth: 2,
    },
    javascript: {
      formatter: { quoteStyle: "double" },
    },
    linter: {
      enabled: true,
      rules: {
        recommended: true,
        style: { useConst: "error" },
      },
    },
    vcs: {
      clientKind: "git",
      enabled: true,
      useIgnoreFile: true,
    },
    $schema: "node_modules/@biomejs/biome/configuration_schema.json",
  },
});

new TextFile(project, "vitest.config.ts", {
  lines: [
    'import { defineConfig } from "vitest/config";',
    "",
    "export default defineConfig({",
    "  test: {",
    '    environment: "node",',
    '    include: ["src/**/*.{test,spec}.ts"],',
    "    passWithNoTests: true,",
    "    typecheck: {",
    "      enabled: true,",
    '      checker: "tsgo --noEmit",',
    '      tsconfig: "tsconfig.json",',
    "    },",
    "  },",
    "});",
  ],
});

const buildWorkflow = project.github?.workflows.find(
  (workflow) => workflow.name === "build",
);
const buildJob = buildWorkflow?.getJob("build");
if (buildWorkflow && buildJob) {
  buildWorkflow.removeJob("self-mutation");
  buildWorkflow.updateJob("build", {
    ...buildJob,
    permissions: { contents: "read" },
    steps: [
      { uses: "actions/checkout@v5" },
      {
        uses: "actions/setup-node@v5",
        with: { "node-version": "24.11.1", "package-manager-cache": false },
      },
      { run: "corepack enable" },
      { run: "yarn install --immutable" },
      { run: "yarn compile" },
      { run: "yarn test" },
      { run: "npm pack --dry-run" },
    ],
  });
  buildWorkflow.file?.patch(JsonPatch.remove("/jobs/build/outputs"));
}
project.synth();

const releaseWorkflowPath = ".github/workflows/release.yml";
const releasePleaseWorkflow = `# ~~ Generated by projen. To modify, edit .projenrc.ts and run "npx projen".

name: release
on:
  push:
    branches:
      - master
      - dev
  workflow_dispatch: {}
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"
jobs:
  release_please:
    if: github.ref_name == 'master'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    outputs:
      release_created: \${{ steps.release.outputs.release_created }}
    steps:
      - id: release
        uses: googleapis/release-please-action@v5
        with:
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json
  release_please_dev:
    if: github.ref_name == 'dev'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    outputs:
      release_created: \${{ steps.release.outputs.release_created }}
    steps:
      - id: release
        uses: googleapis/release-please-action@v5
        with:
          config-file: release-please-config.dev.json
          manifest-file: .release-please-manifest.json
          target-branch: dev
  publish_npm:
    needs: release_please
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    env:
      CI: "true"
    if: \${{ needs.release_please.outputs.release_created == 'true' }}
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Install Specific Yarn Version
        run: corepack enable && corepack prepare yarn@${yarnVersion} --activate
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 24.11.1
          package-manager-cache: false
      - name: Install dependencies
        run: yarn install --immutable
      - name: Compile
        run: yarn compile
      - name: Test
        run: yarn test
      - name: Verify package
        run: npm pack --dry-run
      - name: Publish
        env:
          NPM_CONFIG_PROVENANCE: "true"
        run: npm publish --access public
  publish_npm_dev:
    needs: release_please_dev
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    env:
      CI: "true"
    if: github.ref_name == 'dev'
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Install Specific Yarn Version
        run: corepack enable && corepack prepare yarn@${yarnVersion} --activate
      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 24.11.1
          package-manager-cache: false
      - name: Install dependencies
        run: yarn install --immutable
      - name: Compile
        run: yarn compile
      - name: Test
        run: yarn test
      - name: Verify package
        run: npm pack --dry-run
      - name: Publish dev if missing
        env:
          NPM_CONFIG_PROVENANCE: "true"
        run: |-
          PACKAGE_NAME=$(node -p "require('./package.json').name")
          PACKAGE_VERSION=$(node -p "require('./package.json').version")
          case "$PACKAGE_VERSION" in
            *-dev*) ;;
            *) echo "Skipping non-dev version $PACKAGE_VERSION"; exit 0 ;;
          esac
          if npm view "$PACKAGE_NAME@$PACKAGE_VERSION" version >/dev/null 2>&1; then
            echo "$PACKAGE_NAME@$PACKAGE_VERSION is already published"
            exit 0
          fi
          npm publish --tag dev --access public
`;

fs.chmodSync(releaseWorkflowPath, 0o644);
fs.writeFileSync(releaseWorkflowPath, releasePleaseWorkflow);
fs.chmodSync(releaseWorkflowPath, 0o444);

const devReleasePleaseConfigPath = "release-please-config.dev.json";
const devReleasePleaseConfig = {
  $schema:
    "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  packages: {
    ".": {
      "bump-patch-for-minor-pre-major": true,
      "changelog-path": "CHANGELOG.md",
      "include-component-in-tag": false,
      "package-name": "@tradedal/unleaded",
      prerelease: true,
      "prerelease-type": "dev",
      "release-type": "node",
      versioning: "prerelease",
    },
  },
};

fs.writeFileSync(
  devReleasePleaseConfigPath,
  `${JSON.stringify(devReleasePleaseConfig, null, 2)}\n`,
);
