"use client";
import { useState } from "react";
export type PrintDestinationOption = { id: string; name: string; printerName: string; profileId: string; profileName: string; description: string; recommended: boolean };
export function PrintDestinationPicker({ options }: { options: PrintDestinationOption[] }) {
  const [profileId, setProfileId] = useState(options[0]?.profileId || "");
  const [manualId, setManualId] = useState("");
  const eligible = options.filter(o => o.profileId === profileId);
  const chosen = eligible.find(o => o.id === manualId) || eligible.find(o => o.recommended) || eligible[0];
  const profiles = options.filter((o, i) => options.findIndex(other => other.profileId === o.profileId) === i);
  if (!options.length) return <p role="alert">Nessuna stampante con profilo abilitato e supportato dal Bridge.</p>;
  return <div className="stack">
    <label>Profilo di stampa<select value={profileId} onChange={e => { setProfileId(e.target.value); setManualId(""); }}>
      {profiles.map(p => <option key={p.profileId} value={p.profileId}>{p.profileName}</option>)}
    </select></label>
    <label>Stampante / Hot Folder<select name="destinationId" required value={chosen?.id || ""} onChange={e => setManualId(e.target.value)}>
      {eligible.map(o => <option key={o.id} value={o.id}>{o.printerName} · {o.name}{o.recommended ? " — consigliata" : ""}</option>)}
    </select></label>
    <p>{chosen?.description}</p>
    <p>La scelta è una proposta modificabile. Il PDF sarà consegnato solo dopo la tua approvazione; le impostazioni vengono applicate dalla Hot Folder.</p>
  </div>;
}
