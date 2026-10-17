import type { PrintPrinter, PrintProfile, PrintDestination } from "@prisma/client";
import { savePrintConfigurationAction as save } from "@/app/settings/printing/actions";
import { destinationUnavailable, profileDescription, supportedPrintProfile, printSides, printColors } from "@/lib/print-profiles";

type Bridge = { id: string; name: string; enabled: boolean };
type Destination = PrintDestination & { printer: PrintPrinter | null; profile: PrintProfile | null; bridge: Bridge };
function Toggle({ kind, id, enabled }: { kind: string; id: string; enabled: boolean }) {
  return <form action={save}><input type="hidden" name="operation" value="toggle" /><input type="hidden" name="kind" value={kind} />
    <input type="hidden" name="id" value={id} /><input type="hidden" name="enabled" value={String(!enabled)} />
    <button className="secondary" type="submit">{enabled ? "Disabilita" : "Abilita"}</button></form>;
}
function PrinterFields({ printer }: { printer?: PrintPrinter }) {
  return <form action={save} className="stack"><input type="hidden" name="operation" value="printer" /><input type="hidden" name="id" value={printer?.id || ""} />
    <label>Nome stampante<input name="name" defaultValue={printer?.name} placeholder="Es. Canon C7260 / iP-A2" maxLength={100} required /></label>
    <label>Preferita per<select name="preferredFor" defaultValue={printer?.preferredFor || "NONE"}><option value="NONE">Nessuna preferenza</option><option value="BW">Bianco e nero</option><option value="COLOR">Colore</option></select></label>
    <button type="submit" className="secondary">{printer ? "Salva stampante" : "Aggiungi stampante"}</button></form>;
}
export function PrintConfiguration({ printers, profiles, destinations, bridges }: {
  printers: PrintPrinter[]; profiles: PrintProfile[]; destinations: Destination[]; bridges: Bridge[];
}) {
  return <div className="stack">
    <section className="card card-pad stack"><h2>Stampanti e smistamento</h2>
      <p>La preferenza propone una stampante compatibile con il profilo scelto. Puoi sempre selezionare un’altra destinazione abilitata prima di approvare. Nessun invio è automatico senza approvazione.</p>
      <p>Disabilitando una stampante o un profilo si disabilitano anche le destinazioni associate. Per riprendere, riabilita e conferma esplicitamente le singole destinazioni: non ripartono da sole.</p>
      {printers.map(p => <article key={p.id} className="card card-pad stack"><h3>{p.name} · {p.enabled ? "Abilitata" : "Disabilitata"}</h3><PrinterFields printer={p} /><Toggle kind="printer" id={p.id} enabled={p.enabled} /></article>)}
      <details><summary>Aggiungi stampante</summary><PrinterFields /></details>
    </section>
    <section className="card card-pad stack"><h2>Profili di lavorazione</h2>
      <p>Descrivono impostazioni effettive della Hot Folder: salvarli qui non modifica Fiery. Tutti i profili usano la coda in attesa. Le copie sono fisse per profilo, non ottenute duplicando il PDF.</p>
      <p>Il profilo attuale conserva l’orientamento delle pagine PDF: non ruota né ridimensiona il documento.</p>
      <p>Il Bridge attualmente installato supporta solo il profilo A4 B/N, solo fronte, una copia già collaudato. Puoi preparare altri profili, ma non saranno inviabili fino all’aggiornamento del Bridge e al collaudo delle cartelle.</p>
      {profiles.map(p => <article key={p.id} className="card card-pad stack"><h3>{p.name}</h3><p>{profileDescription(p)}</p><code>{p.key}</code>
        <p>{!p.enabled ? "Disabilitato" : supportedPrintProfile(p) ? "Compatibile con il Bridge attuale" : "Preparato · invio non ancora supportato"}</p><Toggle kind="profile" id={p.id} enabled={p.enabled} /></article>)}
      <details><summary>Crea profilo</summary><form action={save} className="stack">
        <input type="hidden" name="operation" value="profile" />
        <label>Nome profilo<input name="name" maxLength={100} required placeholder="Es. A3 colore fronte/retro" /></label>
        <label>Codice immutabile<input name="key" pattern="[A-Z0-9][A-Z0-9_-]{0,79}" maxLength={80} required placeholder="A3_COLOR_DUPLEX_1_HOLD_V1" /></label>
        <label>Formato<select name="paperSize"><option>A4</option><option>A3</option></select></label>
        <label>Colore<select name="colorMode">{Object.entries(printColors).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Lati<select name="sides">{Object.entries(printSides).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Copie fisse nella Hot Folder<input name="copies" type="number" min={1} max={999} defaultValue={1} required /></label>
        <label>Carta / supporto<input name="paperStock" maxLength={100} placeholder="Vuoto: carta configurata nella Hot Folder" /></label>
        <p>Le proprietà sono immutabili: per cambiare formato, copie o carta crea un nuovo profilo, così i lavori già approvati non cambiano significato.</p>
        <button className="primary" type="submit">Crea profilo</button>
      </form></details>
    </section>
    <section className="card card-pad stack"><h2>Destinazioni e Hot Folders</h2>
      <p>Ogni destinazione collega una stampante, un profilo e un Bridge tramite una chiave logica. Il percorso Windows si configura soltanto sul PC. Le nuove destinazioni nascono disabilitate.</p>
      {destinations.map(d => {
        const activationBlock = destinationUnavailable({ ...d, enabled: true });
        return <article key={d.id} className="card card-pad stack"><h3>{d.name}</h3><p>{d.printer?.name || d.printerName} · {d.profile?.name || d.profileKey} · {d.bridge.name}</p>
          <p>Chiave locale: <code>{d.key}</code> · Profilo locale: <code>{d.profileKey}</code></p>
          <p>{destinationUnavailable(d) || "Abilitata per approvazione"}</p>
          {d.enabled ? <Toggle kind="destination" id={d.id} enabled /> : activationBlock ? <p>{activationBlock}</p> :
            <form action={save} className="stack"><input type="hidden" name="operation" value="toggle" /><input type="hidden" name="kind" value="destination" />
              <input type="hidden" name="id" value={d.id} /><input type="hidden" name="enabled" value="true" />
              <label><input type="checkbox" name="verified" required /> Ho configurato questa chiave e questo profilo nel Bridge e verificato la Hot Folder: una copia A4 B/N, solo fronte, coda in attesa.</label>
              <button className="secondary" type="submit">Abilita destinazione verificata</button></form>}
        </article>;
      })}
      <details><summary>Associa una Hot Folder</summary><form action={save} className="stack"><input type="hidden" name="operation" value="destination" />
        <label>Nome destinazione<input name="name" maxLength={100} required placeholder="Nome della Hot Folder" /></label>
        <label>Chiave logica sul PC<input name="key" pattern="[a-z0-9][a-z0-9_-]{0,79}" maxLength={80} required placeholder="c7260-a4-bn" /></label>
        <label>Stampante<select name="printerId" required defaultValue=""><option value="" disabled>Seleziona</option>{printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Profilo<select name="profileId" required defaultValue=""><option value="" disabled>Seleziona</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Bridge<select name="bridgeId" required defaultValue=""><option value="" disabled>Seleziona</option>{bridges.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <button type="submit" className="primary" disabled={!printers.length || !profiles.length || !bridges.length}>Crea destinazione disabilitata</button>
      </form></details>
      <p>Le associazioni sono immutabili: per cambiare stampante o profilo crea una nuova chiave e disabilita la precedente. La disabilitazione blocca nuove autorizzazioni di deposito; un invio già autorizzato può terminare.</p>
    </section>
  </div>;
}
