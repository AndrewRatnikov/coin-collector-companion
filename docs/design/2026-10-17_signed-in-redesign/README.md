# Reference files: signed-in redesign (2026-10-17)

These files are exported from the Claude Design canvas. Each `.dc.html` is a **template**: `{{holes}}`, `<sc-for>` and `<sc-if>` blocks, plus a `renderVals()` script with sample data and interaction logic. Read them for structure, copy and exact values. They don't run as plain HTML.

The stylesheet `<link href="/_blob/9289bb8d…">` in each file points to **`classical.css`** in this folder.

| File | Screen | Phase |
|---|---|---|
| `classical.css` | Every component class, token and state | 1 |
| `R_Foundations.dc.html` | Naming rule, numerals, placeholder coin, tokens | 1 |
| `R_Components.dc.html` | Component spec: coin card, toggles, list row, set card, badges, catalog result, toasts | 1, 8 |
| `R_NavDesktop.dc.html`, `R_NavMobile.dc.html` | Navigation, signed in and out | 2 |
| `R_MySets.dc.html`, `R_MySetsMobile.dc.html` | My sets (state enum: many, one, empty, loading, error) | 3 |
| `R_Set.dc.html`, `R_SetMobile.dc.html` | Set page | 4 |
| `R_AddCoins.dc.html`, `R_AddCoinsMobile.dc.html` | Add coins sheet | 5 |
| `R_Collection.dc.html`, `R_CollectionMobile.dc.html` | Collection | 6 |
| `R_Coin.dc.html`, `R_CoinMobile.dc.html` | Coin page | 7 |

The counts in the mocks (137 missing, 88 owned, and so on) are illustrative sample data. The 1909-S VDB specs on the coin page are illustrative too; the real values come from the catalog import.
