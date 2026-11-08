import base64
import csv
import datetime
import hashlib
import io
import json
import math
import statistics
import re
import sys
import zipfile
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation, localcontext

MAX_ROWS = 250000
MAX_CELLS = 2000000
MAX_TEXT = 12000000


def fail(message):
    raise ValueError(message)


def safe_archive(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        if len(archive.infolist()) > 3000 or sum(x.file_size for x in archive.infolist()) > 64000000:
            fail("El documento supera el límite de descompresión.")


def decimal_value(value):
    try:
        number = Decimal(str(value).strip())
        if not number.is_finite() or abs(number) >= Decimal("1e22") or number.as_tuple().exponent < -8:
            return None
        return number
    except (InvalidOperation, ValueError):
        return None


def normalized_table(records):
    records = iter(records)
    header = [str(x).strip() if x is not None else "" for x in next(records, [])]
    if not header or len(header) > 300 or "" in header or len(set(header)) != len(header):
        fail("La tabla requiere encabezados únicos, completos y hasta 300 columnas.")
    rows = []
    for row in records:
        if len(row) != len(header):
            fail("Fila irregular en la posición " + str(len(rows) + 2))
        if len(rows) >= MAX_ROWS or (len(rows) + 1) * len(header) > MAX_CELLS:
            fail("La tabla excede el límite de análisis.")
        rows.append(tuple("" if x is None else str(x) for x in row))
    return header, rows


def input_data(raw, kind, sheet):
    pages, sheets, table, warnings = [], [], None, []
    if kind == "text/csv":
        text = raw.decode("utf-8-sig")
        try:
            dialect = csv.Sniffer().sniff(text[:8192], delimiters=",;\t|")
        except csv.Error:
            dialect = csv.excel
        table = normalized_table(csv.reader(io.StringIO(text, newline=""), dialect, strict=True))
    elif kind.endswith("spreadsheetml.sheet"):
        from openpyxl import load_workbook
        safe_archive(raw)
        book = load_workbook(io.BytesIO(raw), read_only=True, data_only=True, keep_links=False)
        sheets = book.sheetnames
        ws = book[sheet or sheets[0]]
        if ws.max_row and ws.max_column and ws.max_row * ws.max_column > MAX_CELLS:
            fail("La hoja excede el límite de celdas.")
        table = normalized_table(ws.values)
        warnings.append("Excel aporta valores almacenados. Las fórmulas no se recalculan.")
        book.close()
    elif kind == "application/pdf":
        from pypdf import PdfReader
        pdf = PdfReader(io.BytesIO(raw), strict=False)
        if pdf.is_encrypted or len(pdf.pages) > 500:
            fail("PDF cifrado o con más de 500 páginas.")
        for i, page in enumerate(pdf.pages):
            value = page.extract_text() or ""
            pages.append(("p. " + str(i + 1), value))
            if not value.strip():
                warnings.append("Sin texto extraíble en p. " + str(i + 1))
        warnings.append("La extracción de texto no valida tablas ni realiza OCR.")
    elif kind.endswith("wordprocessingml.document"):
        from docx import Document
        safe_archive(raw)
        document = Document(io.BytesIO(raw))
        pages = [("párrafo " + str(i + 1), p.text) for i, p in enumerate(document.paragraphs)]
        for i, tbl in enumerate(document.tables):
            for j, row in enumerate(tbl.rows):
                pages.append((f"tabla {i + 1}, fila {j + 1}", " | ".join(c.text for c in row.cells)))
    elif kind == "application/json":
        value = json.loads(raw.decode("utf-8-sig"))
        if isinstance(value, list) and value and all(isinstance(row, dict) for row in value):
            header = list(dict.fromkeys(k for row in value for k in row))
            table = normalized_table([header] + [[row.get(k) for k in header] for row in value])
        else:
            pages = [("JSON", json.dumps(value, ensure_ascii=False, indent=2))]
    elif kind in ("text/plain", "text/markdown"):
        pages = [("texto", raw.decode("utf-8-sig"))]
    else:
        fail("Formato no admitido.")
    if sum(len(text) for _, text in pages) > MAX_TEXT:
        fail("Texto extraído demasiado extenso.")
    return table, pages, sheets, warnings


def profile(table):
    header, rows = table
    columns = []
    for i, name in enumerate(header):
        values = [r[i] for r in rows if r[i].strip()]
        numbers = [n for val in values if (n := decimal_value(val)) is not None]
        numeric = len(numbers)
        date_column = bool(re.search(r"(?:^|[ _-])(date|fecha)(?:$|[ _-])", name.casefold()))
        invalid_dates = 0
        if date_column:
            for val in values:
                try:
                    datetime.datetime.fromisoformat(val)
                except ValueError:
                    invalid_dates += 1
        outliers = None
        if len(numbers) >= 4:
            q1, _, q3 = statistics.quantiles(numbers, method="inclusive")
            half = Decimal("1.5") * (q3 - q1)
            outliers = sum(x < q1 - half or x > q3 + half for x in numbers)

        columns.append(dict(name=name, nulls=len(rows)-len(values), numeric=numeric,
                            distinct=len(set(values)), invalidDates=invalid_dates if date_column else None, outliersIQR=outliers, minimum=str(min(numbers)) if numbers else None,
                            maximum=str(max(numbers)) if numbers else None,
                            type="empty" if not values else "number" if numeric == len(values) else "mixed" if numeric else "text"))
    fingerprint = hashlib.sha256()
    for row in [header, *sorted(rows)]:
        fingerprint.update(json.dumps(row, ensure_ascii=False, separators=(",", ":")).encode("utf-8") + b"\n")
    return dict(rows=len(rows), columns=columns, duplicates=len(rows)-len(set(rows)), tableHash=fingerprint.hexdigest())


def analyze(table, plan):
    import duckdb
    header, rows = table
    metric, group, op = plan.get("metric"), plan.get("group_by"), plan["aggregation"]
    column = lambda name: header.index(name) if name in header else fail("Columna desconocida: " + str(name))
    mi = column(metric) if op != "count" else None
    cost_index = column(plan['subtract']) if plan.get('subtract') else None
    gi = column(group) if group else None
    filters = [(column(f["column"]), f["equals"]) for f in plan.get("filters", [])]
    currency_name = plan.get("currency_column") or next((name for name in header if name.casefold() in ("currency","currency_code","divisa","moneda","iso_currency")), None)
    ci = column(currency_name) if currency_name and op != "count" else None
    units = set()
    source, groups = [], defaultdict(list)
    for row in rows:
        if any(row[i] != value for i, value in filters):
            continue
        if ci is not None:
            units.add(row[ci].strip().upper())
        key = row[gi] if gi is not None else "Total"
        if plan.get("period") == "month":
            try:
                key = datetime.date.fromisoformat(key[:10]).strftime("%Y-%m")
            except ValueError:
                fail("Fecha inválida para la agrupación mensual.")
        value = Decimal(1) if mi is None else decimal_value(row[mi])
        if value is None:
            fail("La métrica contiene valores nulos, ambiguos o no numéricos.")
        if cost_index is not None:
            deduction = decimal_value(row[cost_index])
            if deduction is None:
                fail("La columna de deducción contiene un valor inválido.")
            value -= deduction
        groups[key].append(value)
        source.append((key, format(value, "f")))
    if ci is not None and (len(units) > 1 or "" in units):
        fail("Filtra una sola divisa antes de agregar.")
    if len(groups) > 5000:
        fail("Más de 5000 grupos. Aplica un filtro.")
    ops = {"sum":"sum(v)", "mean":"avg(v)", "count":"count(*)", "min":"min(v)", "max":"max(v)", "median":"median(v)", "stddev":"stddev_pop(v)"}
    expr = ops[op]
    with duckdb.connect(":memory:", config={"enable_external_access":"false","threads":"1","memory_limit":"128MB"}) as db:
        packed = json.dumps([{"g":k, "v":v} for k,v in source], ensure_ascii=False)
        result = db.execute("WITH t AS (SELECT unnest(from_json(?,'[{\"g\":\"VARCHAR\",\"v\":\"DECIMAL(38,8)\"}]')) AS r), vals AS (SELECT r.g AS g,r.v AS v FROM t) SELECT g," + expr + ",count(*) FROM vals GROUP BY g ORDER BY g", [packed]).fetchall()
    points = []
    for key, value, count in result:
        items = groups[key]
        exact = {"sum":sum, "mean":lambda x:sum(x)/len(x), "count":len, "min":min, "max":max, "median":statistics.median, "stddev":statistics.pstdev}[op](items)
        if count != len(items) or (not math.isclose(float(exact), float(value), rel_tol=1e-14, abs_tol=1e-12) if op in ("mean", "stddev") else exact != value):
            fail("La verificación independiente no coincide.")
        points.append(dict(label=key,value=format(Decimal(exact), "f"),rows=count))
    if sum(p["rows"] for p in points) != len(source):
        fail("Cobertura inconsistente.")
    return dict(points=points, rowsTotal=len(rows), rowsMatched=len(source), currency=next(iter(units), None), verified=True)


def main():
    request = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    file, action = request["file"], request["action"]
    raw = base64.b64decode(file["data"], validate=True)
    if len(raw) > 5000000:
        fail("Límite de archivo de 5 MB.")
    table, pages, sheets, warnings = input_data(raw, file["type"], request.get("sheet"))
    result = dict(source=file["name"], sha256=hashlib.sha256(raw).hexdigest(), sheets=sheets,
                  sheet=request.get("sheet") or (sheets[0] if sheets else None), warnings=warnings)
    if action == "analyze":
        if table is None:
            fail("Se requiere una tabla.")
        result.update(analyze(table, request["plan"]))
    elif action == "join":
        right = request["right"]
        rraw = base64.b64decode(right["data"], validate=True)
        other, _, _, issues = input_data(rraw, right["type"], request.get("right_sheet"))
        if not table or not other:
            fail("Se requieren dos tablas.")
        lhs, rows = table
        rhs, other_rows = other
        li, ri = lhs.index(request["left_key"]), rhs.index(request["right_key"])
        lookup = {}
        for row in other_rows:
            key = row[ri]
            if not key.strip() or key in lookup:
                fail("La clave derecha debe ser completa y única.")
            lookup[key] = row
        added = [i for i in range(len(rhs)) if i != ri]
        header = list(lhs) + ["right." + rhs[i] for i in added]
        if len(header) != len(set(header)) or len(header)*len(rows) > MAX_CELLS:
            fail("Conflicto de columnas o tabla combinada demasiado grande.")
        target = io.StringIO(newline="")
        writer = csv.writer(target)
        writer.writerow(header)
        matched = 0
        for row in rows:
            found = lookup.get(row[li])
            matched += int(found is not None)
            writer.writerow(list(row) + [found[i] if found is not None else "" for i in added])
            if target.tell() > 5000000:
                fail("La tabla combinada supera 5 MB.")
        output = target.getvalue().encode("utf-8")
        if len(output) > 5000000:
            fail("La tabla combinada supera 5 MB.")
        result.update(data=base64.b64encode(output).decode("ascii"), rowsTotal=len(rows),
                      matched=matched, rightSha256=hashlib.sha256(rraw).hexdigest(),
                      warnings=warnings + issues)
    elif action == "inspect":
        if table is not None:
            result.update(profile(table))
        else:
            result["sections"] = len(pages)
            result["characters"] = sum(len(text) for _, text in pages)
    elif action == "index":
        if table is not None:
            fail("Utiliza el análisis tabular para este archivo.")
        result["chunks"] = [dict(location=location, offset=pos, text=text[pos:pos+1000])
                            for location, text in pages for pos in range(0, len(text), 850) if text[pos:pos+1000].strip()]
    else:
        fail("Operación desconocida.")
    return result


if __name__ == "__main__":
    try:
        with localcontext() as ctx:
            ctx.prec = 48
            print(json.dumps(main(), ensure_ascii=True, allow_nan=False))
    except Exception as exc:
        print(json.dumps({"error":str(exc)[:500]}, ensure_ascii=True))
        sys.exit(1)
