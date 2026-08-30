# Unleaded

Unleaded is the fastest, human-optimized way to search used-car listings from
the terminal. It puts live inventory in a keyboard-driven table where you can
filter, sort, compare, and open listing links without leaving the CLI.

There are no agents, MCPs, harnesses, or wrappers. Unleaded is a straight, fast
live CLI built for people who want to search cars, not operate a toolchain.

![Unleaded terminal UI](./media/unleaded.gif)

## Install

```bash
npm install --global @tradedal/unleaded
```

## Run a search

Set an [auto.dev](https://www.auto.dev/) or
[MarketCheck](https://www.marketcheck.com/) API key, then run `unleaded`:

```bash
export AUTO_DEV_API_KEY=your-key
unleaded -z 90089 -d 100 -e Electric -b Hyundai -m Ioniq
```

Use `--state CA` without a ZIP for a state-wide search. Run `unleaded --help`
for every search option.

## Terminal controls

The control bar shows every shortcut. Sort and filter with one key, page through
results, and press `q` to quit. Listings link directly to the vehicle page,
image, history report, and VIN search when those links are available.

![Controls](./media/controls.png)

Block dealers you do not want to see again:

```bash
unleaded block add "Example Motors"
unleaded block list
unleaded block remove "Example Motors"
unleaded block clear
```

## Development

```bash
yarn install
yarn compile
yarn test
```

Built with TypeScript, Effect, Effect Atom, and Ink. Licensed under
[Apache 2.0](./LICENSE).
