import { javascript, JsonFile, JsonPatch, TextFile, typescript } from "projen";
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
  release: false,
  npmAccess: javascript.NpmAccess.PUBLIC,
  repository: "https://github.com/Tradedal/Unleaded.git",
  bin: { unleaded: "./lib/src/main.js" },
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
    version: "4.10.3",
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
    "@effect/platform-node@4.0.0-beta.100",
    "date-fns@^4.1.0",
    "effect@4.0.0-beta.100",
    "ink@^6.6.0",
    "ink-spinner@^5.0.0",
    "react@^19.2.4",
    "scheduler@^0.27.0",
  ],
});

project.setScript("prepare", "effect-tsgo patch");
project.setScript("postinstall", "effect-tsgo patch");

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
project.package.addField("version", "0.1.0");
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

new JsonFile(project, "release-please-config.json", {
  marker: false,
  obj: {
    $schema:
      "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
    packages: {
      ".": {
        "bump-patch-for-minor-pre-major": true,
        "changelog-path": "CHANGELOG.md",
        "include-component-in-tag": false,
        "package-name": "@tradedal/unleaded",
        "release-type": "node",
      },
    },
  },
});

new JsonFile(project, ".release-please-manifest.json", {
  marker: false,
  obj: { ".": "0.1.0" },
});

new TextFile(project, ".github/workflows/release.yml", {
  lines: [
    "name: release",
    "",
    "on:",
    "  push:",
    "    branches: [master]",
    "  workflow_dispatch:",
    "",
    "permissions:",
    "  contents: read",
    "",
    "jobs:",
    "  release-please:",
    "    if: github.ref_name == 'master'",
    "    runs-on: ubuntu-latest",
    "    permissions:",
    "      contents: write",
    "      pull-requests: write",
    "    outputs:",
    "      release_created: ${{ steps.release.outputs.release_created }}",
    "    steps:",
    "      - id: release",
    "        uses: googleapis/release-please-action@v5",
    "        with:",
    "          config-file: release-please-config.json",
    "          manifest-file: .release-please-manifest.json",
    "",
    "  publish-npm:",
    "    needs: release-please",
    "    if: needs.release-please.outputs.release_created == 'true'",
    "    runs-on: ubuntu-latest",
    "    permissions:",
    "      contents: read",
    "      id-token: write",
    "    steps:",
    "      - uses: actions/checkout@v5",
    "      - uses: actions/setup-node@v5",
    "        with:",
    "          node-version: 24.11.1",
    "          registry-url: https://registry.npmjs.org",
    "          package-manager-cache: false",
    "      - run: corepack enable",
    "      - run: yarn install --immutable",
    "      - run: yarn compile",
    "      - run: yarn test",
    "      - run: npm pack --dry-run",
    "      - run: npm publish --access public",
    "        env:",
    "          NPM_CONFIG_PROVENANCE: 'true'",
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
