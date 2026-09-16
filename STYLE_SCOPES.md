# Style Scopes

Regola di progetto: gestionale e shop devono condividere direzione visiva, non CSS fragile.

- Gestionale: usare `data-ui-scope="management"` e classi gia presenti sotto `.shell`.
- Shop pubblico: usare `app/shop/shop.css` e selector sotto `.shop-route-layout[data-ui-scope="shop"]`.
- Login e stampa: mantenere isolati con `data-ui-scope="auth"` e `data-ui-scope="print"`.
- Le integrazioni shop visibili nel gestionale, come campanella e ordini shop, restano in `app/globals.css` sotto il blocco `Shop-to-management integration only`.
- Non aggiungere regole generiche nuove tipo `.button`, `.card`, `.field`, `.toggle-field` per lavorare sullo shop: vanno sempre scoperte sotto lo scope corretto.
