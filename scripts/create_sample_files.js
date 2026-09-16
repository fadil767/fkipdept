import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

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
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
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
    (value >>> 24) & 255
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
  return Buffer.from(new Uint8Array(output));
}

function createXLSX(rows, sheetName = "Sheet1") {
  if (!rows || !rows.length) return Buffer.from([]);
  const headers = Object.keys(rows[0]);
  const lastColIndex = headers.length - 1;
  const lastColLetter = columnName(lastColIndex);
  const totalRows = rows.length + 1;

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

  const headerRowXml = `<row r="1" ht="28" customHeight="1">${headers
    .map((header, colIndex) => {
      const cellRef = `${columnName(colIndex)}1`;
      const s = isColCentered(header) ? 2 : 1;
      return `<c r="${cellRef}" t="inlineStr" s="${s}"><is><t>${xmlEscape(header)}</t></is></c>`;
    })
    .join("")}</row>`;

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

function createCSV(rows) {
  if (!rows || !rows.length) return "";
  const headers = Object.keys(rows[0]);
  const formatCell = (val) => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes(";")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headerLine = headers.map(formatCell).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => formatCell(row[h])).join(",")
  );
  return [headerLine, ...dataLines].join("\r\n");
}

// Data Contoh Dosen
const dosenRows = [
  {
    Lecturer_ID: "FKIP001",
    Name: "Prof. Dr. Hendra Setiawan, M.Pd.",
    Degree: "Prof. Dr.",
    Email: "hendra.setiawan@fkip.ut.ac.id",
    Phone: "0812-1100-2001",
    Rating: 5,
    Warning_Note: "",
    Expertise: "Strategi Pembelajaran di SD; Penelitian Tindakan Kelas (PTK); Kurikulum & Pembelajaran",
    Plotted_Course_Codes: "PDGK4105; IDIK4008",
    Plotted_Course_Names: "Strategi Pembelajaran di SD; Penelitian Tindakan Kelas (PTK)",
    Available_Slots: 2,
  },
  {
    Lecturer_ID: "FKIP002",
    Name: "Dian Kartika Putri, S.Pd., M.Pd.",
    Degree: "M.Pd.",
    Email: "dian.kartika@fkip.ut.ac.id",
    Phone: "0812-1100-2002",
    Rating: 4,
    Warning_Note: "",
    Expertise: "Evaluasi Pembelajaran; Profesi Keguruan",
    Plotted_Course_Codes: "MKDK4005; PDGK4301",
    Plotted_Course_Names: "Profesi Keguruan; Evaluasi Pembelajaran di SD",
    Available_Slots: 2,
  },
  {
    Lecturer_ID: "FKIP003",
    Name: "Bambang Prasetyo, M.Ed., Ph.D.",
    Degree: "M.Ed.",
    Email: "bambang.prasetyo@fkip.ut.ac.id",
    Phone: "0812-1100-2003",
    Rating: 4,
    Warning_Note: "",
    Expertise: "Pembelajaran Terpadu di SD; Media & Teknologi Pembelajaran",
    Plotted_Course_Codes: "PDGK4205; MKDK4001",
    Plotted_Course_Names: "Pembelajaran Terpadu di SD; Pengantar Pendidikan",
    Available_Slots: 2,
  },
  {
    Lecturer_ID: "FKIP004",
    Name: "Dr. Hj. Sri Wahyuni, M.Pd.",
    Degree: "Dr.",
    Email: "sri.wahyuni@fkip.ut.ac.id",
    Phone: "0812-1100-2004",
    Rating: 5,
    Warning_Note: "",
    Expertise: "Perkembangan Peserta Didik; Pembelajaran PKn di SD",
    Plotted_Course_Codes: "MKDK4002; PDGK4201",
    Plotted_Course_Names: "Perkembangan Peserta Didik; Pembelajaran PKn di SD",
    Available_Slots: 2,
  },
  {
    Lecturer_ID: "FKIP005",
    Name: "Rizky Ramadhan, S.Pd., M.Si.",
    Degree: "M.Si.",
    Email: "rizky.ramadhan@fkip.ut.ac.id",
    Phone: "0812-1100-2005",
    Rating: 4,
    Warning_Note: "",
    Expertise: "Pendidikan Matematika; Evaluasi Pembelajaran",
    Plotted_Course_Codes: "PDGK4108; PDGK4301",
    Plotted_Course_Names: "Matematika; Evaluasi Pembelajaran di SD",
    Available_Slots: 2,
  },
  {
    Lecturer_ID: "FKIP006",
    Name: "Anita Rahmawati, S.Pd., M.Pd.",
    Degree: "M.Pd.",
    Email: "anita.rahmawati@fkip.ut.ac.id",
    Phone: "0812-1100-2006",
    Rating: 3,
    Warning_Note: "Perlu konfirmasi jadwal tutorial sebelum penambahan kelas.",
    Expertise: "Keterampilan Berbahasa Indonesia SD; Strategi Pembelajaran di SD",
    Plotted_Course_Codes: "PDGK4101; PDGK4105",
    Plotted_Course_Names: "Keterampilan Berbahasa Indonesia; Strategi Pembelajaran di SD",
    Available_Slots: 2,
  },
  {
    Lecturer_ID: "FKIP007",
    Name: "Ahmad Fauzi, S.Pd., M.Pd.",
    Degree: "M.Pd.",
    Email: "ahmad.fauzi@fkip.ut.ac.id",
    Phone: "0812-1100-2007",
    Rating: 4,
    Warning_Note: "",
    Expertise: "Profesi Keguruan; Penelitian Tindakan Kelas (PTK)",
    Plotted_Course_Codes: "MKDK4005; IDIK4008",
    Plotted_Course_Names: "Profesi Keguruan; Penelitian Tindakan Kelas (PTK)",
    Available_Slots: 2,
  },
  {
    Lecturer_ID: "FKIP008",
    Name: "Maya Anggraini, S.Pd., M.Ed.",
    Degree: "M.Ed.",
    Email: "maya.anggraini@fkip.ut.ac.id",
    Phone: "0812-1100-2008",
    Rating: 5,
    Warning_Note: "",
    Expertise: "Pembelajaran Terpadu di SD; Pengantar Pendidikan",
    Plotted_Course_Codes: "MKDK4001; PDGK4205",
    Plotted_Course_Names: "Pengantar Pendidikan; Pembelajaran Terpadu di SD",
    Available_Slots: 2,
  },
];

// Data Contoh Plotting
const plottingRows = [
  {
    Idtutor: "FKIP001",
    Nama: "Prof. Dr. Hendra Setiawan, M.Pd.",
    Kelas: "PDGK4105.1",
    "Nama MK": "Strategi Pembelajaran di SD",
  },
  {
    Idtutor: "FKIP006",
    Nama: "Anita Rahmawati, S.Pd., M.Pd.",
    Kelas: "PDGK4105.2",
    "Nama MK": "Strategi Pembelajaran di SD",
  },
  {
    Idtutor: "FKIP001",
    Nama: "Prof. Dr. Hendra Setiawan, M.Pd.",
    Kelas: "IDIK4008.1",
    "Nama MK": "Penelitian Tindakan Kelas (PTK)",
  },
  {
    Idtutor: "FKIP007",
    Nama: "Ahmad Fauzi, S.Pd., M.Pd.",
    Kelas: "IDIK4008.2",
    "Nama MK": "Penelitian Tindakan Kelas (PTK)",
  },
  {
    Idtutor: "FKIP002",
    Nama: "Dian Kartika Putri, S.Pd., M.Pd.",
    Kelas: "MKDK4005.1",
    "Nama MK": "Profesi Keguruan",
  },
  {
    Idtutor: "FKIP007",
    Nama: "Ahmad Fauzi, S.Pd., M.Pd.",
    Kelas: "MKDK4005.2",
    "Nama MK": "Profesi Keguruan",
  },
  {
    Idtutor: "FKIP002",
    Nama: "Dian Kartika Putri, S.Pd., M.Pd.",
    Kelas: "PDGK4301.1",
    "Nama MK": "Evaluasi Pembelajaran di SD",
  },
  {
    Idtutor: "FKIP005",
    Nama: "Rizky Ramadhan, S.Pd., M.Si.",
    Kelas: "PDGK4301.2",
    "Nama MK": "Evaluasi Pembelajaran di SD",
  },
  {
    Idtutor: "FKIP003",
    Nama: "Bambang Prasetyo, M.Ed., Ph.D.",
    Kelas: "PDGK4205.1",
    "Nama MK": "Pembelajaran Terpadu di SD",
  },
  {
    Idtutor: "FKIP008",
    Nama: "Maya Anggraini, S.Pd., M.Ed.",
    Kelas: "PDGK4205.2",
    "Nama MK": "Pembelajaran Terpadu di SD",
  },
  {
    Idtutor: "FKIP003",
    Nama: "Bambang Prasetyo, M.Ed., Ph.D.",
    Kelas: "MKDK4001.1",
    "Nama MK": "Pengantar Pendidikan",
  },
  {
    Idtutor: "FKIP008",
    Nama: "Maya Anggraini, S.Pd., M.Ed.",
    Kelas: "MKDK4001.2",
    "Nama MK": "Pengantar Pendidikan",
  },
  {
    Idtutor: "FKIP004",
    Nama: "Dr. Hj. Sri Wahyuni, M.Pd.",
    Kelas: "MKDK4002.1",
    "Nama MK": "Perkembangan Peserta Didik",
  },
  {
    Idtutor: "FKIP004",
    Nama: "Dr. Hj. Sri Wahyuni, M.Pd.",
    Kelas: "PDGK4201.1",
    "Nama MK": "Pembelajaran PKn di SD",
  },
  {
    Idtutor: "FKIP005",
    Nama: "Rizky Ramadhan, S.Pd., M.Si.",
    Kelas: "PDGK4108.1",
    "Nama MK": "Matematika",
  },
  {
    Idtutor: "",
    Nama: "",
    Kelas: "PDGK4108.2",
    "Nama MK": "Matematika",
  },
  {
    Idtutor: "FKIP006",
    Nama: "Anita Rahmawati, S.Pd., M.Pd.",
    Kelas: "PDGK4101.1",
    "Nama MK": "Keterampilan Berbahasa Indonesia",
  },
];

// Target directories
const targetDirs = [
  path.join(rootDir, "templates"),
  path.join(rootDir, "public", "templates"),
];

targetDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const files = [
  {
    filename: "contoh_format_import_dosen.xlsx",
    content: createXLSX(dosenRows, "Data Dosen"),
  },
  {
    filename: "contoh_format_import_dosen.csv",
    content: createCSV(dosenRows),
  },
  {
    filename: "contoh_format_import_plotting.xlsx",
    content: createXLSX(plottingRows, "Plotting Dosen"),
  },
  {
    filename: "contoh_format_import_plotting.csv",
    content: createCSV(plottingRows),
  },
];

targetDirs.forEach((dir) => {
  files.forEach(({ filename, content }) => {
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, content);
    console.log(`Saved: ${filePath}`);
  });
});

console.log("All sample files generated successfully!");
