import { strFromU8, unzip } from "fflate";

const isBlankRow = (row) =>
  !row ||
  Object.values(row).every((value) => String(value ?? "").trim() === "");

export async function readImportFile(
  file,
  { parseCSV, rowsToObjects, parseXLSX },
) {
  return file.name.toLowerCase().endsWith(".csv")
    ? rowsToObjects(parseCSV(await file.text()))
    : parseXLSX(file);
}

export function buildLecturerImportReview(rawRows, imported) {
  const nonBlankRows = rawRows.filter((row) => !isBlankRow(row));
  const duplicateIds = Object.entries(
    imported.reduce(
      (counts, item) => ({
        ...counts,
        [item.id]: (counts[item.id] || 0) + 1,
      }),
      {},
    ),
  )
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
  const missingNames = imported
    .filter((item) => !item.name)
    .map((item) => item.id);
  const rejectedCount = Math.max(0, nonBlankRows.length - imported.length);
  const issues = [
    rejectedCount
      ? `${rejectedCount} baris tidak kosong ditolak karena ID dosen tidak ditemukan.`
      : "",
    duplicateIds.length
      ? `ID dosen duplikat akan digabungkan: ${duplicateIds.join(", ")}.`
      : "",
    missingNames.length
      ? `${missingNames.length} baris yang diterima tidak memiliki nama dosen: ${missingNames.slice(0, 10).join(", ")}.`
      : "",
  ].filter(Boolean);

  return {
    imported,
    summary: [
      { label: "Baris Sumber", value: nonBlankRows.length },
      { label: "Baris Valid", value: imported.length },
      {
        label: "Peringatan",
        value: issues.length,
        tone: issues.length ? "warn" : "success",
      },
    ],
    issues,
    previewRows: imported.map((item) => ({
      ID: item.id,
      Nama: item.name,
      Gelar: item.degree,
      Penilaian: item.rating,
      "Slot Tersedia": item.available,
      "Bidang Keahlian": item.expertise,
    })),
  };
}

export function buildPlottingImportReview(
  rawRows,
  imported,
  lecturers,
  courses,
) {
  const importedClassCount = Object.values(imported.counts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const issues = [
    imported.ignoredCourses.length
      ? `Mata kuliah tidak dikenal akan dilewati: ${imported.ignoredCourses.join(", ")}.`
      : "",
    imported.ignoredLecturers.length
      ? `Dosen tidak dikenal akan tetap tidak dialokasikan: ${imported.ignoredLecturers.join(", ")}.`
      : "",
  ].filter(Boolean);
  const lecturerById = new Map(
    lecturers.map((lecturer) => [lecturer.id, lecturer]),
  );
  const courseByCode = new Map(courses.map((course) => [course.code, course]));
  const previewRows = Object.entries(imported.assignments).flatMap(
    ([courseCode, ids]) =>
      ids.map((lecturerId, index) => ({
        Kelas: `${courseCode}.${index + 1}`,
        "Mata Kuliah": courseByCode.get(courseCode)?.title || courseCode,
        Dosen:
          lecturerById.get(lecturerId)?.name || lecturerId || "Belum Dialokasikan",
      })),
  );

  return {
    imported,
    importedClassCount,
    summary: [
      {
        label: "Baris Sumber",
        value: rawRows.filter((row) => !isBlankRow(row)).length,
      },
      { label: "Kelas Valid", value: importedClassCount },
      {
        label: "Peringatan",
        value: issues.length,
        tone: issues.length ? "warn" : "success",
      },
    ],
    issues,
    previewRows,
  };
}

export function createImportExportTools(deps) {
  const {
    buildLecturerExportRows,
    buildLecturerTemplateRows,
    buildPlottingExportRows,
    buildPlottingTemplateRows,
    normalizeLecturer,
  } = deps;

  async function writeBlobWithFileSystemAccess(filename, blob, type) {
    if (
      typeof window === "undefined" ||
      !window.showSaveFilePicker ||
      !window.isSecureContext
    )
      return { handled: false, cancelled: false };
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Spreadsheet", accept: { [type]: [".xlsx"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { handled: true, cancelled: false };
    } catch (error) {
      if (error?.name === "AbortError")
        return { handled: true, cancelled: true };
      return { handled: false, cancelled: false };
    }
  }

  function triggerAnchorDownload(filename, blob) {
    if (
      typeof document === "undefined" ||
      typeof URL === "undefined" ||
      typeof URL.createObjectURL !== "function"
    )
      throw new Error("Downloads are not available in this app window.");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  }

  async function downloadBlob(filename, content, type) {
    const blob =
      content instanceof Blob ? content : new Blob([content], { type });
    const pickerResult = await writeBlobWithFileSystemAccess(
      filename,
      blob,
      type,
    );
    if (pickerResult.handled)
      return {
        filename,
        cancelled: pickerResult.cancelled,
        method: "file-picker",
      };
    triggerAnchorDownload(filename, blob);
    return { filename, cancelled: false, method: "download" };
  }

  const xlsxContentType =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  function xmlEscape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function columnName(index) {
    let name = "";
    let current = index + 1;
    while (current > 0) {
      const remainder = (current - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      current = Math.floor((current - 1) / 26);
    }
    return name;
  }

  function crc32(bytes) {
    let crc = -1;
    for (const byte of bytes) {
      crc ^= byte;
      for (let i = 0; i < 8; i += 1)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ -1) >>> 0;
  }

  function writeUint16(target, value) {
    target.push(value & 255, (value >>> 8) & 255);
  }

  function writeUint32(target, value) {
    target.push(
      value & 255,
      (value >>> 8) & 255,
      (value >>> 16) & 255,
      (value >>> 24) & 255,
    );
  }

  function createZip(files) {
    const encoder = new TextEncoder();
    const output = [];
    const centralDirectory = [];
    let offset = 0;
    const now = new Date();
    const dosTime =
      (now.getHours() << 11) |
      (now.getMinutes() << 5) |
      Math.floor(now.getSeconds() / 2);
    const dosDate =
      ((now.getFullYear() - 1980) << 9) |
      ((now.getMonth() + 1) << 5) |
      now.getDate();

    files.forEach(({ name, content }) => {
      const nameBytes = encoder.encode(name);
      const dataBytes = encoder.encode(content);
      const checksum = crc32(dataBytes);
      const localHeader = [];
      writeUint32(localHeader, 0x04034b50);
      writeUint16(localHeader, 20);
      writeUint16(localHeader, 0);
      writeUint16(localHeader, 0);
      writeUint16(localHeader, dosTime);
      writeUint16(localHeader, dosDate);
      writeUint32(localHeader, checksum);
      writeUint32(localHeader, dataBytes.length);
      writeUint32(localHeader, dataBytes.length);
      writeUint16(localHeader, nameBytes.length);
      writeUint16(localHeader, 0);
      output.push(...localHeader, ...nameBytes, ...dataBytes);

      const centralHeader = [];
      writeUint32(centralHeader, 0x02014b50);
      writeUint16(centralHeader, 20);
      writeUint16(centralHeader, 20);
      writeUint16(centralHeader, 0);
      writeUint16(centralHeader, 0);
      writeUint16(centralHeader, dosTime);
      writeUint16(centralHeader, dosDate);
      writeUint32(centralHeader, checksum);
      writeUint32(centralHeader, dataBytes.length);
      writeUint32(centralHeader, dataBytes.length);
      writeUint16(centralHeader, nameBytes.length);
      writeUint16(centralHeader, 0);
      writeUint16(centralHeader, 0);
      writeUint16(centralHeader, 0);
      writeUint16(centralHeader, 0);
      writeUint32(centralHeader, 0);
      writeUint32(centralHeader, offset);
      centralDirectory.push(...centralHeader, ...nameBytes);
      offset = output.length;
    });

    const centralDirectoryOffset = output.length;
    output.push(...centralDirectory);
    const endRecord = [];
    writeUint32(endRecord, 0x06054b50);
    writeUint16(endRecord, 0);
    writeUint16(endRecord, 0);
    writeUint16(endRecord, files.length);
    writeUint16(endRecord, files.length);
    writeUint32(endRecord, centralDirectory.length);
    writeUint32(endRecord, centralDirectoryOffset);
    writeUint16(endRecord, 0);
    output.push(...endRecord);
    return new Uint8Array(output);
  }

  function createXLSX(rows, sheetName = "Lecturers") {
    if (!rows || !rows.length) return new Uint8Array();
    const headers = Object.keys(rows[0]);
    const lastColIndex = headers.length - 1;
    const lastColLetter = columnName(lastColIndex);
    const totalRows = rows.length + 1; // 1 header row + N data rows

    const isColCentered = (colName) =>
      [
        "Lecturer_ID",
        "ID",
        "Idtutor",
        "Degree",
        "Rating",
        "Available_Slots",
        "Available",
        "Kelas",
        "Class",
      ].includes(colName);

    const isColWrapped = (colName) =>
      [
        "Expertise",
        "Plotted_Course_Codes",
        "Plotted_Course_Names",
        "Warning_Note",
      ].includes(colName);

    const PRESET_WIDTHS = {
      Lecturer_ID: 16,
      Name: 34,
      Degree: 14,
      Email: 34,
      Phone: 18,
      Rating: 12,
      Warning_Note: 34,
      Expertise: 40,
      Plotted_Course_Codes: 26,
      Plotted_Course_Names: 44,
      Available_Slots: 16,
      Class: 16,
      Course: 38,
      Lecturer: 32,
      Idtutor: 16,
      Nama: 32,
      Kelas: 16,
      "Nama MK": 38,
    };

    const colsXml = headers
      .map((header, colIndex) => {
        let maxLen = String(header || "").length;
        for (const r of rows) {
          const val = String(r[header] ?? "");
          const lines = val.split(/[;\n]/);
          for (const line of lines) {
            if (line.trim().length > maxLen) {
              maxLen = line.trim().length;
            }
          }
        }
        const preset = PRESET_WIDTHS[header];
        const width = preset
          ? Math.max(preset, Math.min(maxLen + 4, 55))
          : Math.min(Math.max(maxLen + 4, 14), 50);
        return `<col min="${colIndex + 1}" max="${colIndex + 1}" width="${width}" customWidth="1"/>`;
      })
      .join("");

    // Header row (Row 1)
    const headerRowXml = `<row r="1" ht="28" customHeight="1">${headers
      .map((header, colIndex) => {
        const cellRef = `${columnName(colIndex)}1`;
        const s = isColCentered(header) ? 2 : 1;
        return `<c r="${cellRef}" t="inlineStr" s="${s}"><is><t>${xmlEscape(header)}</t></is></c>`;
      })
      .join("")}</row>`;

    // Data rows (Row 2 .. N+1)
    const dataRowsXml = rows
      .map((row, rowIndex) => {
        const rowNum = rowIndex + 2;
        const isZebra = rowIndex % 2 === 1;
        const cells = headers
          .map((header, colIndex) => {
            const cellRef = `${columnName(colIndex)}${rowNum}`;
            const value = row[header];

            let s = 3;
            if (isColCentered(header)) {
              s = isZebra ? 6 : 4;
            } else if (isColWrapped(header)) {
              s = isZebra ? 8 : 7;
            } else {
              s = isZebra ? 5 : 3;
            }

            if (typeof value === "number" && Number.isFinite(value)) {
              return `<c r="${cellRef}" s="${s}"><v>${value}</v></c>`;
            }
            return `<c r="${cellRef}" t="inlineStr" s="${s}"><is><t>${xmlEscape(value)}</t></is></c>`;
          })
          .join("");
        return `<row r="${rowNum}" ht="22" customHeight="1">${cells}</row>`;
      })
      .join("");

    const sheetData = headerRowXml + dataRowsXml;

    const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20" customHeight="1"/><cols>${colsXml}</cols><sheetData>${sheetData}</sheetData><autoFilter ref="A1:${lastColLetter}${totalRows}"/></worksheet>`;

    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF005BAA"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border><border><left style="thin"><color rgb="FF004B8D"/></left><right style="thin"><color rgb="FF004B8D"/></right><top style="thin"><color rgb="FF004B8D"/></top><bottom style="medium"><color rgb="FF003E7A"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="0"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="0"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>`;

    return createZip([
      {
        name: "[Content_Types].xml",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      },
      {
        name: "_rels/.rels",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      },
      {
        name: "xl/workbook.xml",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      },
      {
        name: "xl/_rels/workbook.xml.rels",
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      },
      {
        name: "xl/styles.xml",
        content: stylesXml,
      },
      { name: "xl/worksheets/sheet1.xml", content: worksheet },
    ]);
  }

  async function exportLecturersToXLSX(lecturers, courses) {
    const rows = buildLecturerExportRows(lecturers, courses);
    if (!rows.length) return null;
    const filenameDate = new Date().toISOString().slice(0, 10);
    const filename = `UT_FKIP_Daftar_Dosen_${filenameDate}.xlsx`;
    return downloadBlob(
      filename,
      createXLSX(rows, "Data Dosen"),
      xlsxContentType,
    );
  }

  async function exportLecturerTemplateToXLSX() {
    const filenameDate = new Date().toISOString().slice(0, 10);
    const filename = `UT_FKIP_Template_Dosen_${filenameDate}.xlsx`;
    return downloadBlob(
      filename,
      createXLSX(buildLecturerTemplateRows(), "Template Dosen"),
      xlsxContentType,
    );
  }

  async function exportPlottingToXLSX(
    lecturers,
    courses,
    plannedCounts,
    assignmentMap,
  ) {
    const rows = buildPlottingExportRows(
      lecturers,
      courses,
      plannedCounts,
      assignmentMap,
    );
    if (!rows.length) return null;
    const filenameDate = new Date().toISOString().slice(0, 10);
    const filename = `UT_FKIP_Plotting_Dosen_${filenameDate}.xlsx`;
    return downloadBlob(
      filename,
      createXLSX(rows, "Plotting Dosen"),
      xlsxContentType,
    );
  }

  async function exportPlottingTemplateToXLSX() {
    const filenameDate = new Date().toISOString().slice(0, 10);
    const filename = `UT_FKIP_Template_Plotting_${filenameDate}.xlsx`;
    const rows =
      typeof buildPlottingTemplateRows === "function"
        ? buildPlottingTemplateRows()
        : [
            {
              Idtutor: "FKIP001",
              Nama: "Prof. Dr. Hendra Setiawan, M.Pd.",
              Kelas: "PDGK4105.1",
              "Nama MK": "Strategi Pembelajaran di SD",
            },
            {
              Idtutor: "FKIP002",
              Nama: "Dian Kartika Putri, S.Pd., M.Pd.",
              Kelas: "MKDK4005.1",
              "Nama MK": "Profesi Keguruan",
            },
            {
              Idtutor: "",
              Nama: "",
              Kelas: "MKDK4001.1",
              "Nama MK": "Pengantar Pendidikan",
            },
          ];
    return downloadBlob(
      filename,
      createXLSX(rows, "Template Plotting"),
      xlsxContentType,
    );
  }

  function exportPlottingToPDF(
    lecturers,
    courses,
    plannedCounts,
    assignmentMap,
    currentTerm,
  ) {
    const lecturerById = new Map(lecturers.map((l) => [l.id, l]));

    const termLabel = currentTerm
      ? `${currentTerm.name || currentTerm.code} (Tahun Ajaran ${currentTerm.ay || "2026/2027"}, Semester ${currentTerm.semester || "Ganjil"})`
      : "Semester 2026/2027 Ganjil";

    const rows = [];
    let no = 1;
    let totalClasses = 0;
    let totalAssigned = 0;

    courses.forEach((course) => {
      const planned = Math.max(
        Number(plannedCounts?.[course.code] || 0),
        Number(assignmentMap?.[course.code]?.filter(Boolean).length || 0),
        Number(assignmentMap?.[course.code]?.length || 0),
      );
      if (!planned) return;
      const assignments = assignmentMap[course.code] || [];
      for (let i = 0; i < planned; i++) {
        totalClasses++;
        const lecturerId = assignments[i] || "";
        const lecturer = lecturerById.get(lecturerId);
        if (lecturer) totalAssigned++;
        rows.push({
          no: no++,
          courseCode: course.code,
          courseTitle: course.title,
          credits: course.credits || 3,
          classNum: `${course.code}.${i + 1}`,
          lecturerId: lecturer ? lecturer.id : "-",
          lecturerName: lecturer
            ? `${lecturer.name}${lecturer.degree ? ` (${lecturer.degree})` : ""}`
            : "Belum Dialokasikan",
          status: lecturer ? "Teralokasi" : "Belum Terisi",
        });
      }
    });

    if (rows.length === 0) {
      alert("Tidak ada rencana kelas tutorial yang terdaftar untuk dicetak.");
      return;
    }

    const printDate = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const rowsHtml = rows
      .map(
        (r, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-size: 11px;">${r.no}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-family: monospace; font-size: 11px; font-weight: bold; color: #005baa;">${r.courseCode}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; font-weight: 500;">${r.courseTitle}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-size: 11px;">${r.credits}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-family: monospace; font-size: 11px; font-weight: bold;">${r.classNum}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-family: monospace; text-align: center; font-size: 11px;">${r.lecturerId}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; font-weight: 600; color: #0f172a;">${r.lecturerName}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px 8px; text-align: center; font-size: 10px; font-weight: bold; color: ${r.status === "Teralokasi" ? "#166534" : "#991b1b"}; background: ${r.status === "Teralokasi" ? "#f0fdf4" : "#fef2f2"};">${r.status}</td>
        </tr>
      `
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rekapitulasi Plotting Tutorial FKIP UT - ${termLabel}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 15mm 15mm;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      color: #0f172a;
      line-height: 1.3;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .print-bar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #fff;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 9999;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
      font-family: Arial, sans-serif;
    }
    .print-bar span {
      font-size: 13px;
      font-weight: 600;
    }
    .print-bar-actions {
      display: flex;
      gap: 10px;
    }
    .print-btn {
      background: #005baa;
      color: #ffffff;
      border: none;
      padding: 7px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
    }
    .print-btn:hover {
      background: #004580;
    }
    .close-btn {
      background: #334155;
      color: #ffffff;
      border: none;
      padding: 7px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
    }
    .close-btn:hover {
      background: #475569;
    }
    .content-wrap {
      padding: 20px 25px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #000;
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      right: 0;
      height: 1px;
      background: #000;
    }
    .header-logo {
      width: 70px;
      height: 70px;
      object-fit: contain;
    }
    .header-text {
      flex: 1;
      text-align: center;
    }
    .header-text h3 {
      font-size: 12px;
      margin: 0;
      font-weight: normal;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .header-text h2 {
      font-size: 15px;
      margin: 2px 0;
      font-weight: bold;
      text-transform: uppercase;
      color: #005baa;
    }
    .header-text h1 {
      font-size: 14px;
      margin: 2px 0;
      font-weight: bold;
      text-transform: uppercase;
    }
    .header-text p {
      font-size: 10px;
      margin: 2px 0 0;
      color: #334155;
      font-family: Arial, sans-serif;
    }
    .doc-title {
      text-align: center;
      margin: 18px 0 12px;
    }
    .doc-title h4 {
      margin: 0;
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      text-decoration: underline;
    }
    .doc-title p {
      margin: 3px 0 0;
      font-size: 11px;
      font-family: Arial, sans-serif;
      color: #475569;
    }
    .meta-table {
      width: 100%;
      margin-bottom: 12px;
      font-family: Arial, sans-serif;
      font-size: 11px;
      border-collapse: collapse;
    }
    .meta-table td {
      padding: 3px 0;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-family: Arial, sans-serif;
      margin-bottom: 24px;
    }
    .data-table th {
      border: 1px solid #64748b;
      background: #005baa;
      color: #fff;
      padding: 7px 8px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .signature-section {
      margin-top: 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-family: Arial, sans-serif;
      page-break-inside: avoid;
    }
    .qr-box {
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      border-radius: 6px;
      background: #f8fafc;
      text-align: center;
      font-size: 9px;
      color: #475569;
    }
    .sign-box {
      text-align: center;
      min-width: 220px;
      font-size: 11px;
    }
    .sign-space {
      height: 60px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .content-wrap { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <span>📄 Pratinjau Rekapitulasi Plotting FKIP UT — Siap Dicetak</span>
    <div class="print-bar-actions">
      <button class="print-btn" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
      <button class="close-btn" onclick="window.close()">Tutup Pratinjau</button>
    </div>
  </div>

  <div class="content-wrap">
    <div class="header">
      <img src="/logo.png" class="header-logo" alt="Logo UT" onerror="this.style.display='none'" />
      <div class="header-text">
        <h3>KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI</h3>
        <h2>UNIVERSITAS TERBUKA</h2>
        <h1>FAKULTAS KEGURUAN DAN ILMU PENDIDIKAN (FKIP)</h1>
        <p>Jalan Cabe Raya, Pondok Cabe, Pamulang, Tangerang Selatan 15418, Banten</p>
        <p>Telepon: (021) 7490941 | Laman: www.ut.ac.id | Pos-el: fkip@ecampus.ut.ac.id</p>
      </div>
    </div>

    <div class="doc-title">
      <h4>REKAPITULASI PENETAPAN PLOTTING KELAS TUTORIAL</h4>
      <p>PROGRAM STUDI PENDIDIKAN — FAKULTAS KEGURUAN DAN ILMU PENDIDIKAN (FKIP)</p>
    </div>

    <table class="meta-table">
      <tr>
        <td style="width: 18%; font-weight: bold;">Semester / Periode</td>
        <td style="width: 2%;">:</td>
        <td style="width: 45%;">${termLabel}</td>
        <td style="width: 15%; font-weight: bold;">Tanggal Terbit</td>
        <td style="width: 2%;">:</td>
        <td style="width: 18%;">${printDate}</td>
      </tr>
      <tr>
        <td style="font-weight: bold;">Total Rencana Kelas</td>
        <td>:</td>
        <td><strong>${totalClasses} Kelas</strong> (${totalAssigned} teralokasi, ${totalClasses - totalAssigned} belum terisi)</td>
        <td style="font-weight: bold;">Status Sistem</td>
        <td>:</td>
        <td><span style="color: #005baa; font-weight: bold;">Dokumen Resmi FKIP</span></td>
      </tr>
    </table>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 4%;">No</th>
          <th style="width: 12%;">Kode MK</th>
          <th style="width: 28%;">Nama Mata Kuliah</th>
          <th style="width: 6%;">SKS</th>
          <th style="width: 11%;">Kelas</th>
          <th style="width: 11%;">ID Tutor</th>
          <th style="width: 20%;">Nama Tutor Pengampu</th>
          <th style="width: 8%;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="signature-section">
      <div class="qr-box">
        <div style="font-weight: bold; margin-bottom: 3px;">VERIFIKASI SISTEM DIGITAL</div>
        <div>ID: FKIP-PLOT-${Date.now().toString(36).toUpperCase()}</div>
        <div>Dokumen Sah & Tersinkronisasi Otomatis</div>
        <div style="margin-top: 4px; font-size: 8px; color: #64748b;">Dicetak melalui Dashboard FKIP UT</div>
      </div>
      <div class="sign-box">
        <div>Tangerang Selatan, ${printDate}</div>
        <div style="margin-top: 4px;">Mengetahui,</div>
        <div style="font-weight: bold;">Ketua Program Studi FKIP</div>
        <div class="sign-space"></div>
        <div style="font-weight: bold; text-decoration: underline;">Dr. Hendra Gunawan, M.Ed.</div>
        <div style="font-size: 10px; color: #475569;">NIP. 19780512 200501 1 002</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

    let printWin = null;
    try {
      printWin = window.open("", "_blank");
    } catch {
      printWin = null;
    }

    if (printWin && !printWin.closed) {
      try {
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
        setTimeout(() => {
          try {
            printWin.focus();
            printWin.print();
          } catch {
            // Document onload will trigger print
          }
        }, 600);
        return { success: true, method: "pdf-window" };
      } catch {
        // Fall back to hidden iframe
      }
    }

    // Fallback: use invisible iframe if pop-up was blocked
    let printFrame = document.getElementById("pdf-print-fallback-iframe");
    if (!printFrame) {
      printFrame = document.createElement("iframe");
      printFrame.id = "pdf-print-fallback-iframe";
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "none";
      document.body.appendChild(printFrame);
    }
    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (err) {
          console.error("Iframe print error:", err);
        }
      }, 600);
      return { success: true, method: "pdf-iframe" };
    }
    return { success: true, method: "pdf-print" };
  }

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"' && quoted && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(cell);
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    row.push(cell);
    if (row.some((value) => value !== "")) rows.push(row);
    return rows;
  }

  function rowsToObjects(rows) {
    const [headers = [], ...body] = rows;
    return body.map((row) =>
      headers.reduce(
        (acc, header, index) => ({
          ...acc,
          [String(header || "").trim()]: row[index] ?? "",
        }),
        {},
      ),
    );
  }

  function readZipEntries(buffer) {
    return new Promise((resolve, reject) => {
      unzip(new Uint8Array(buffer), (error, unzipped) => {
        if (error) {
          reject(new Error("Could not read this XLSX file."));
          return;
        }
        try {
          resolve(
            Object.fromEntries(
              Object.entries(unzipped).map(([name, data]) => [
                name,
                strFromU8(data),
              ]),
            ),
          );
        } catch {
          reject(new Error("This XLSX file contains invalid spreadsheet data."));
        }
      });
    });
  }

  function parseSharedStrings(xml) {
    if (!xml) return [];
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return Array.from(doc.querySelectorAll("si")).map((item) =>
      Array.from(item.querySelectorAll("t"))
        .map((node) => node.textContent || "")
        .join(""),
    );
  }

  function parseWorksheet(xml, sharedStrings) {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    return Array.from(doc.querySelectorAll("sheetData row")).map((row) => {
      const cells = [];
      Array.from(row.querySelectorAll("c")).forEach((cell) => {
        const ref = cell.getAttribute("r") || "";
        const column =
          ref
            .replace(/\d/g, "")
            .split("")
            .reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
        const type = cell.getAttribute("t");
        const valueNode = cell.querySelector("v");
        const inlineNode = cell.querySelector("is t");
        const rawValue =
          valueNode?.textContent || inlineNode?.textContent || "";
        cells[column] =
          type === "s" ? sharedStrings[Number(rawValue)] || "" : rawValue;
      });
      return cells.map((value) => value ?? "");
    });
  }

  async function parseXLSX(file) {
    const entries = await readZipEntries(await file.arrayBuffer());
    const worksheetName = entries["xl/worksheets/sheet1.xml"]
      ? "xl/worksheets/sheet1.xml"
      : Object.keys(entries).find(
          (name) => name.startsWith("xl/worksheets/") && name.endsWith(".xml"),
        );
    if (!worksheetName)
      throw new Error("No worksheet found in this XLSX file.");
    return rowsToObjects(
      parseWorksheet(
        entries[worksheetName],
        parseSharedStrings(entries["xl/sharedStrings.xml"]),
      ),
    );
  }

  function splitList(value) {
    return String(value || "")
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function getImportedValue(row, names) {
    const entries = Object.entries(row);
    const match = entries.find(([key]) =>
      names.some((name) => key.trim().toLowerCase() === name.toLowerCase()),
    );
    return match?.[1] ?? "";
  }

  function hasImportedValue(row, names) {
    return String(getImportedValue(row, names)).trim() !== "";
  }

  function isImportRowBlank(row) {
    return Object.values(row).every(
      (value) => String(value ?? "").trim() === "",
    );
  }

  function mapImportedLecturers(rows, courses) {
    return rows
      .filter((row) => !isImportRowBlank(row))
      .map((row, index) => {
        const plotted = splitList(
          getImportedValue(row, [
            "Plotted_Course_Codes",
            "Plotted Course Codes",
            "Plotted Courses",
            "Plotted",
            "Courses",
          ]),
        );
        const knownPlotted = plotted.filter(
          (code) =>
            !courses.length || courses.some((course) => course.code === code),
        );
        const importedId = String(
          getImportedValue(row, ["Lecturer_ID", "Lecturer ID", "ID"]),
        ).trim();
        const availableKeys = [
          "Available_Slots",
          "Available Slots",
          "Available",
        ];
        const importedAvailable = Number(getImportedValue(row, availableKeys));
        const ratingKeys = [
          "Rating",
          "Teaching_Rating",
          "Teaching Rating",
          "Performance Rating",
        ];
        const importedRating = Number(getImportedValue(row, ratingKeys));
        const warningNoteKeys = [
          "Warning_Note",
          "Warning Note",
          "Warning",
          "Notice",
        ];
        return {
          ...normalizeLecturer({
            id: importedId || `imported-${Date.now()}-${index + 1}`,
            degree: String(getImportedValue(row, ["Degree"])).trim(),
            name: String(getImportedValue(row, ["Name", "Full Name"])).trim(),
            email: String(getImportedValue(row, ["Email"])).trim(),
            phone: String(getImportedValue(row, ["Phone"])).trim(),
            expertise: splitList(getImportedValue(row, ["Expertise"])),
            plotted: knownPlotted,
            available: Number.isFinite(importedAvailable)
              ? importedAvailable
              : 0,
            rating: Number.isFinite(importedRating) ? importedRating : 0,
            warning_note: String(getImportedValue(row, warningNoteKeys)).trim(),
          }),
          _hasImportedAvailable: hasImportedValue(row, availableKeys),
          _hasImportedRating: hasImportedValue(row, ratingKeys),
          _hasImportedWarningNote: hasImportedValue(row, warningNoteKeys),
        };
      });
  }

  return {
    exportLecturersToXLSX,
    exportLecturerTemplateToXLSX,
    exportPlottingToXLSX,
    exportPlottingTemplateToXLSX,
    exportPlottingToPDF,
    parseCSV,
    rowsToObjects,
    parseXLSX,
    splitList,
    getImportedValue,
    hasImportedValue,
    isImportRowBlank,
    mapImportedLecturers,
  };
}
