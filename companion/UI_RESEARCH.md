# Free UI Package Review

Reviewed October 17, 2026 for the existing sandboxed Electron/plain-JavaScript renderer. No subscriptions, CDN assets, hosted widget services or production database changes are needed for these UI choices.

| Package | Upstream license | Fit | Decision |
| --- | --- | --- | --- |
| [Radix Colors](https://www.radix-ui.com/colors/docs/overview/installation) | MIT | Framework-independent CSS scales for neutral surfaces, states and contrast. | Adopted; four static dark scales bundled locally. |
| [Inter Variable / Fontsource](https://fontsource.org/docs/getting-started/variable) | SIL OFL for the font | Readable desktop typography, local assets and a single variable weight file. Chinese uses the installed system font fallback. | Adopted; no Google Fonts request. |
| [Lucide](https://lucide.dev/guide/) | ISC | Consistent command/navigation icons, with tree-shaken imports. | Retained and extended. |
| [Chart.js](https://www.chartjs.org/docs/latest/getting-started/integration.html) | MIT | An inhouse win/loss form chart, accessible canvas label and matching textual results. | Adopted; only doughnut controller, arcs and tooltip registered. No animation. |
| [Floating UI](https://floating-ui.com/docs/tutorial) | MIT | Keyboard/focus and pointer tooltips that flip/shift near window edges. | Adopted; local DOM package, no React requirement. |
| [i18next](https://www.i18next.com/overview/getting-started) | MIT | Local English/Chinese resources, interpolation and a maintainable path to more locales. | Adopted; no translation API or remote language loader. |
| [Web Awesome Core](https://webawesome.com/license) | MIT; Pro is separate | Strong framework-independent component suite; suitable if future forms/dialogs become substantially more complex. | Not added now. A broad component migration would duplicate current native controls; free Core must not be confused with paid Pro. |
| [AG Grid Community](https://www.ag-grid.com/eula/community/) | MIT; Enterprise is separate | Useful for large, interactive player tables. Community includes sorting/filtering/pagination. | Deferred. Current standings are at most 500 bounded rows with 15-row pages; adopting an enterprise-oriented grid is unnecessary here. |
| [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction) | MIT | Accessible React primitives and the foundation for many shadcn components. | Not added: the desktop renderer is not React. Radix Colors provides value without rewriting it. |

## Applied Design

- ECL Central navigation, black/white with royal-blue selection, restrained emerald/coral outcomes, neutral table surfaces and bundled champion portraits.
- Dashboard separates account statistics, dated public ECL news/patches/events and personal inhouse form. Official League patch notes open externally rather than being scraped or presented as ECL content.
- Dedicated ranked ladder, search, sorting and pagination. Full website ladder is attempted; the published top-ten fallback is explicitly labelled.
- English/Chinese changes navigation, controls, native account views and privacy/help. Player names, biographies, source news and technical upstream diagnostics are not machine-translated.
- Static text is captured before user data arrives; only those nodes and explicit dynamic UI strings are translated. This avoids translating a player named "Dashboard", for example.
- The minified renderer bundle measured 273,994 bytes during implementation. Electron still dominates installer size; these packages do not turn the app into a tiny native executable.

## Validation

Local fonts load, sample avatars render, desktop/compact layouts have no horizontal overflow, both histories and ladder filter correctly, and language choice persists. Public sources are read-only, parsed as text using Cheerio in the main process, and never injected as executable HTML. Licenses for bundled UI assets/libraries are included under `dist/`.

Future candidates should earn their dependency cost through a concrete workflow. Do not add a full UI framework just for a different-looking button.
