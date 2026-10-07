# Development

Requires Node.js 22+ (the add-on runs Node 22: the Dockerfile's Alpine 3.22). The add-on itself has no npm
dependencies; `npm install` only brings the dev tools (ESLint, TypeScript as a checker), which aren't shipped.

```sh
npm install         # the dev tools
npm run dev         # http://localhost:3300, restarts on changes
npm test            # unit, HTTP and add-on packaging tests (Node's built-in test runner)
npm run lint        # ESLint (eslint.config.js)
npm run typecheck   # type checks the JavaScript from its JSDoc comments (tsconfig.json); nothing is compiled
npm run check       # all three, as the pull request checks do
```

| Variable     | Default            | Purpose                                 |
|--------------|--------------------|-----------------------------------------|
| `PORT`       | `3300`             | Port to listen on                       |
| `HOST`       | `0.0.0.0`          | Interface to bind                       |
| `STATE_FILE` | `data/coffee.json` | Where beans and brews are saved         |
| `CURRENCY`   | `€`                | The symbol prices are shown with        |

The server doesn't know about Home Assistant: in the add-on, `run.sh` sets these variables (`CURRENCY` from the
add-on's `currency` option).

To try it on your phone while developing, open `http://<your-pc-ip>:3300/` on the same Wi-Fi.

## Layout

This folder is a Home Assistant add-on (the files at the top) that contains the app (the rest).
See [_project_architecture.txt](_project_architecture.txt) for every file.

```
config.yaml, Dockerfile, run.sh     Home Assistant add-on
README.md, DOCS.md, CHANGELOG.md    add-on store page, Documentation tab, changelog

src/                      server (Node, no framework, no dependencies)
  server.js               entry point: load config and state, start HTTP, graceful shutdown
  config.js               environment variables
  app.js                  HTTP routes: page, static files, API
  coffee/state.js         state shape, repairing saved data, the view sent to screens
  coffee/actions.js       every action, validated (the only code that changes state)
  store.js                JSON file storage: debounced, atomic writes
  sse.js                  Server-Sent Events hub for live updates
  static.js               safe static file serving

public/                   browser (plain ES modules, no build step)
  index.html              the page (markup only)
  css/                    base.css (theme, shared components), coffee.css (everything else)
  js/app.js               entry: keeps the latest view, remembers the tab, which coffees' tries are open, wires the parts
  js/shared/              coffee.js (methods, roasts, verdicts, limits and helpers, also used by the server),
                          api, dom, format, storage
  js/ui/                  reusable pieces: back (phone back button), sheet (bottom sheets, swipe to close),
                          viewport (keeps sheets above the keyboard), toast (says what was done; no buttons), icons
  js/coffee/              hero (the logo and a greeting above the tabs),
                          board (the three tabs: a card per coffee per method, the bags), brew-sheet (log / change a brew),
                          bean-sheet (add / change / finish a coffee), specs (a brew's numbers on one line)

test/                     node:test suites
```

## How it works

**Data flow.** Screens send actions (`POST /api/actions`, e.g. `{ "type": "addBrew", "beanId": "…",
"method": "espresso", "grind": "12", "dose": 18, "out": 36, "seconds": 28, "verdict": "good" }`). The server validates
and applies the action, saves, and broadcasts the new view to every screen over `GET /api/events` (Server-Sent
Events). Screens never change anything locally; they only render the latest view.

**Actions:** `addBean`, `editBean` (any fields, including `finished`), `removeBean` (with its brews), `addBrew`,
`editBrew` (any fields, including its bean and method), `removeBrew`, `clearBrews` (a method's brews of some beans:
a coffee's bags). See `src/coffee/actions.js`. Every field is
checked before any is set, so a rejected action changes nothing. Optional fields are cleared with `null` or `''`.

**Beans and brews** (`Bean` and `Brew` in `public/js/shared/coffee.js`). Methods are `espresso` and `pourover`; a
brew's `out` is the espresso's yield or the pour over's water, `seconds` its time. Verdicts are `good`, `sour`,
`bitter` and `off`; sour and bitter carry the hint shown next time (grind finer / coarser). Numbers have limits
(`LIMITS`), and are kept to two decimals.

**Bags of a coffee.** A bean is one bag. "Bought again" adds a new bean copied from a finished one (on the page; the
server just sees `addBean`). Bags with the same name and roaster are the same coffee (`sameCoffee`, `bagIdsOf`):
filters, good settings (`goodSettings`) and a new bag's first brew look at all of them. Nothing links them in the data.

**Saved data** is versioned (`schema`). `normalizeState` repairs anything odd in the file on load
(unknown values fall back to empty; beans without a name and brews without a known bean or method are dropped), so a
bad edit can't break the app.

**Updates while a page is open:** every view carries the app version; a page that sees a new
version reloads itself.

**Phone and PC:** the page has the three columns in it always. Below 900px wide only the one picked by the tabs
shows; above, all three sit side by side and the tabs hide (`css/coffee.css`).

**What it's for.** You log tries until a coffee pours right, then come back for the settings. So the screens show
settings, not a diary: the "sweet spot" is a coffee's last brew that came out good (per method, with any bag of it), and
there are no counts of cups or brews.

**Remembered per device** (localStorage, `js/shared/storage.js`): the tab.

**Back button:** opening a sheet adds a history entry, so the phone's back button (and the Home Assistant app's)
closes it instead of leaving the page (`js/ui/back.js`). The brew sheet can open on top of the bean sheet.

**Paths are relative** (`api/actions`, `css/…`), so the app also works in the Home Assistant
sidebar, which serves it under `/api/hassio_ingress/<token>/`.

## Releasing a new version

1. Bump `version` in **both** `config.yaml` and `package.json` (a test fails if they differ).
2. Add an entry at the top of `CHANGELOG.md`.
3. Run `npm run check`, then open a pull request into `main`: it checks the version went up and runs lint, types
   and tests. Merging releases it: Home Assistant shows the update in the add-on store.

The beans and brews are kept in the add-on's `/data` folder across updates.

## Store images

`icon.png` (128×128) and `logo.png` (250×100) are what Home Assistant shows in the add-on store.
They are rendered from `public/img/logo.svg` and `art/store-logo.svg`, together with the home-screen
icons in `public/img/`; after changing either, run:

```sh
docker run --rm -v "$PWD:/addon" -w /addon alpine:3.20 sh art/render.sh
```

## Testing the add-on image locally

```sh
docker build --build-arg BUILD_ARCH=amd64 -t coffee-tracker .    # BUILD_FROM defaults to the Home Assistant base image
docker run --rm -p 3300:3300 -v coffee-tracker-data:/data coffee-tracker
```
