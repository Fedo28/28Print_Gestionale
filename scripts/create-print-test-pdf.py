"""Generate the non-sensitive A4 fixture used by the Bridge acceptance tests."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import Color

target = Path(__file__).resolve().parents[1] / "output/pdf/28print-fiery-test-a4.pdf"
target.parent.mkdir(parents=True, exist_ok=True)
pdf = canvas.Canvas(str(target), pagesize=A4, invariant=1)
pdf.setTitle("28PRINT - Prova Bridge A4")
pdf.setAuthor("28PRINT")
width, height = A4
pdf.setFillGray(0)
pdf.setFont("Helvetica-Bold", 24)
pdf.drawString(48, height - 70, "28PRINT / PROVA BRIDGE")
pdf.setFont("Helvetica", 12)
pdf.drawString(48, height - 98, "Documento sintetico. Nessun dato cliente.")
pdf.line(48, height - 118, width - 48, height - 118)
lines = [
    "Formato: A4 (210 x 297 mm)",
    "Profilo atteso: scala di grigi, solo fronte, una copia",
    "Destinazione iniziale: Canon IPC650 / Fiery G100",
    "Azione Hot Folder: ATTESA",
    "La consegna del file NON conferma una stampa fisica.",
]
for index, text in enumerate(lines):
    pdf.drawString(48, height - 160 - index * 28, text)
pdf.setFont("Helvetica-Bold", 13)
pdf.drawString(48, 450, "Controlli per l'operatore")
pdf.setFont("Helvetica", 11)
for index, text in enumerate([
    "1. Cercare il nome 28PRINT-<identificativo-lavoro>.pdf in Fiery.",
    "2. Verificare una sola presenza nella coda in attesa.",
    "3. Verificare formato, fronte/retro e numero di copie.",
    "4. Lasciare il lavoro in attesa durante il collaudo del Bridge.",
]):
    pdf.drawString(48, 420 - index * 25, text)
for index in range(5):
    pdf.setFillGray(index / 4)
    pdf.setStrokeGray(0)
    pdf.rect(48 + index * 98, 205, 88, 56, fill=1, stroke=1)
pdf.setFillGray(0)
pdf.setFont("Helvetica", 10)
pdf.drawString(48, 175, "Scala di grigi di controllo - nessuna impostazione di stampa incorporata")
pdf.setFont("Helvetica", 9)
pdf.drawString(48, 48, "28PRINT Bridge / Fase 2 / Documento di prova / Pagina 1 di 1")
pdf.showPage()
pdf.save()
print(target)
