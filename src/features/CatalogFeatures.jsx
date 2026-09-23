import { useMemo, useState } from "react";

export function createCatalogFeatures(deps) {
  const {
    Button,
    Card,
    DeleteConfirmation,
    FormGrid,
    Icons,
    Modal,
    PlainInput,
    SelectBox,
    TextInput,
    includes,
  } = deps;

  function CourseForm({ initial, onSave, onClose }) {
    const [form, setForm] = useState(
      initial || { code: "", title: "", credits: 3 },
    );
    return (
      <div className="space-y-4">
        <FormGrid>
          <PlainInput
            label="Kode Mata Kuliah"
            value={form.code}
            onChange={(value) =>
              setForm({ ...form, code: value.toUpperCase() })
            }
          />
          <PlainInput
            label="SKS"
            type="number"
            value={form.credits}
            onChange={(value) => setForm({ ...form, credits: value })}
          />
        </FormGrid>
        <PlainInput
          label="Nama Mata Kuliah"
          value={form.title}
          onChange={(value) => setForm({ ...form, title: value })}
        />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={!form.code || !form.title}
            onClick={() => onSave({ ...form, credits: Number(form.credits) })}
          >
            Simpan Mata Kuliah
          </Button>
        </div>
      </div>
    );
  }

  function Courses({
    courses,
    setCourses,
    setLecturers,
    setTermPlottings,
    setCourseClassPlans,
    canEdit = true,
    readOnly = false,
  }) {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState("code");
    const [modal, setModal] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [selectedCodes, setSelectedCodes] = useState(new Set());
    const [bulkDeleteTarget, setBulkDeleteTarget] = useState(null);
    const rows = useMemo(
      () =>
        courses
          .filter(
            (course) =>
              includes(course.code, query) ||
              includes(course.title, query) ||
              includes(course.credits, query),
          )
          .sort((a, b) => String(a[sort]).localeCompare(String(b[sort]))),
      [courses, query, sort],
    );
    const save = (item) => {
      setCourses((prev) =>
        prev.some((course) => course.code === item.code)
          ? prev.map((course) => (course.code === item.code ? item : course))
          : [item, ...prev],
      );
      setModal(null);
    };
    const remove = (code) => {
      setCourses((prev) => prev.filter((course) => course.code !== code));
      setLecturers((prev) =>
        prev.map((lecturer) => ({
          ...lecturer,
          plotted: lecturer.plotted.filter((item) => item !== code),
        })),
      );
      setTermPlottings((prev) =>
        prev.map((row) => ({
          ...row,
          plotted: row.plotted.filter((item) => item !== code),
        })),
      );
      setCourseClassPlans((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([termCode, plan]) => [
            termCode,
            {
              counts: Object.fromEntries(
                Object.entries(plan?.counts || {}).filter(
                  ([courseCode]) => courseCode !== code,
                ),
              ),
              assignments: Object.fromEntries(
                Object.entries(plan?.assignments || {}).filter(
                  ([courseCode]) => courseCode !== code,
                ),
              ),
            },
          ]),
        ),
      );
      setDeleteTarget(null);
    };

    const toggleSelectCourse = (code) => {
      setSelectedCodes((prev) => {
        const next = new Set(prev);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        return next;
      });
    };

    const isAllCoursesSelected =
      rows.length > 0 && rows.every((c) => selectedCodes.has(c.code));

    const toggleSelectAllCourses = () => {
      if (isAllCoursesSelected) {
        setSelectedCodes(new Set());
      } else {
        setSelectedCodes(new Set(rows.map((c) => c.code)));
      }
    };

    const removeMultiple = (codes) => {
      const codeSet = new Set(codes);
      setCourses((prev) => prev.filter((course) => !codeSet.has(course.code)));
      setLecturers((prev) =>
        prev.map((lecturer) => ({
          ...lecturer,
          plotted: lecturer.plotted.filter((item) => !codeSet.has(item)),
        })),
      );
      setTermPlottings((prev) =>
        prev.map((row) => ({
          ...row,
          plotted: row.plotted.filter((item) => !codeSet.has(item)),
        })),
      );
      setCourseClassPlans((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([termCode, plan]) => [
            termCode,
            {
              counts: Object.fromEntries(
                Object.entries(plan?.counts || {}).filter(
                  ([courseCode]) => !codeSet.has(courseCode),
                ),
              ),
              assignments: Object.fromEntries(
                Object.entries(plan?.assignments || {}).filter(
                  ([courseCode]) => !codeSet.has(courseCode),
                ),
              ),
            },
          ]),
        ),
      );
      setSelectedCodes(new Set());
      setBulkDeleteTarget(null);
    };
    return (
      <div className="space-y-5">
        {!readOnly && canEdit && (
          <div className="flex justify-end">
            <Button onClick={() => setModal({})}>
              <Icons.plus className="h-4 w-4" />
              Tambah Mata Kuliah
            </Button>
          </div>
        )}
        {readOnly && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            {Icons.eye && <Icons.eye className="h-4 w-4 text-slate-500 shrink-0" />}
            <span><strong>Mode Hanya Lihat:</strong> Anda sedang melihat katalog mata kuliah dalam mode pengamat. Penambahan, pengeditan, atau penghapusan data dibatasi untuk peran Administrator.</span>
          </div>
        )}
        <Card className="grid items-center gap-3 p-4 md:grid-cols-[auto_1fr_220px]">
          {!readOnly && canEdit && rows.length > 0 && (
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs select-none">
              <input
                type="checkbox"
                checked={isAllCoursesSelected}
                onChange={toggleSelectAllCourses}
                className="h-4 w-4 rounded border-slate-300 text-[#005baa] focus:ring-[#005baa]/20 cursor-pointer"
              />
              <span className="hidden sm:inline">Pilih Semua ({rows.length})</span>
            </label>
          )}
          <TextInput
            icon={Icons.search}
            value={query}
            onChange={setQuery}
            placeholder="Cari berdasarkan kode, nama mata kuliah, atau SKS..."
          />
          <SelectBox
            label="Urutkan"
            value={sort}
            onChange={setSort}
            options={["code", "title", "credits"]}
          />
        </Card>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="divide-y divide-slate-100">
            {rows.map((course) => (
              <div
                key={course.code}
                className="flex items-center justify-between gap-4 p-4 sm:px-5 transition-colors hover:bg-slate-50/60"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {!readOnly && canEdit && (
                    <input
                      type="checkbox"
                      checked={selectedCodes.has(course.code)}
                      onChange={() => toggleSelectCourse(course.code)}
                      className="h-4 w-4 rounded border-slate-300 text-[#005baa] focus:ring-[#005baa]/20 cursor-pointer shrink-0"
                      aria-label={`Pilih ${course.title}`}
                    />
                  )}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#005baa] border border-blue-200/60 shadow-2xs">
                    <Icons.book className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-[#005baa] bg-blue-50/80 border border-blue-200/60 px-2 py-0.5 rounded-lg">
                        {course.code}
                      </span>
                      <p className="font-bold text-sm text-[#102f52] truncate">
                        {course.title}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                        {course.credits} SKS
                      </span>
                    </div>
                  </div>
                </div>
                {!readOnly && canEdit && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setModal(course)}
                      title="Edit mata kuliah"
                      className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-[#005baa] hover:border-slate-300 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Icons.edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(course)}
                      title="Hapus mata kuliah"
                      className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Icons.trash className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {rows.length === 0 && (
            <div className="p-8 text-center">
              <Icons.book className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Tidak ada mata kuliah yang cocok dengan pencarian Anda.
              </p>
            </div>
          )}
        </div>
        {modal && (
          <Modal
            title={modal.code ? "Edit Mata Kuliah" : "Tambah Mata Kuliah"}
            onClose={() => setModal(null)}
          >
            <CourseForm
              initial={modal.code ? modal : null}
              onSave={save}
              onClose={() => setModal(null)}
            />
          </Modal>
        )}
        {selectedCodes.size > 0 && !readOnly && canEdit && (
          <div className="fixed bottom-6 inset-x-0 mx-auto z-40 max-w-md px-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900/95 text-white p-3.5 shadow-2xl backdrop-blur-md border border-slate-700/80 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2.5 pl-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/30 text-blue-400 font-extrabold text-xs">
                  {selectedCodes.size}
                </span>
                <span className="text-xs font-semibold text-slate-200">
                  Mata kuliah dipilih
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  className="h-8 px-3 text-xs font-bold"
                  onClick={() => setBulkDeleteTarget(Array.from(selectedCodes))}
                >
                  <Icons.trash className="h-3.5 w-3.5 mr-1" />
                  Hapus ({selectedCodes.size})
                </Button>
                <button
                  type="button"
                  onClick={() => setSelectedCodes(new Set())}
                  className="rounded-xl px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}
        {bulkDeleteTarget && (
          <DeleteConfirmation
            itemType="mata kuliah terpilih"
            itemLabel={`${bulkDeleteTarget.length} mata kuliah (${bulkDeleteTarget.slice(0, 5).join(", ")}${bulkDeleteTarget.length > 5 ? "..." : ""})`}
            detail="Tindakan ini akan menghapus mata kuliah terpilih dari katalog, seluruh alokasi plotting semester terkait, dan rencana kelas yang tersimpan."
            onConfirm={() => removeMultiple(bulkDeleteTarget)}
            onClose={() => setBulkDeleteTarget(null)}
          />
        )}
        {deleteTarget && (
          <DeleteConfirmation
            itemType="mata kuliah"
            itemLabel={`${deleteTarget.code} - ${deleteTarget.title}`}
            detail="Tindakan ini akan menghapus mata kuliah dari katalog, seluruh alokasi plotting semester, dan rencana kelas yang tersimpan."
            onConfirm={() => remove(deleteTarget.code)}
            onClose={() => setDeleteTarget(null)}
          />
        )}
      </div>
    );
  }

  function TermForm({ initial, onSave, onClose }) {
    const [form, setForm] = useState(
      initial || {
        name: "",
        code: "",
        ay: "2025/2026",
        semester: "Semester 1",
        active: false,
      },
    );
    return (
      <div className="space-y-4">
        <PlainInput
          label="Nama Periode / Semester"
          value={form.name}
          onChange={(value) => setForm({ ...form, name: value })}
        />
        <FormGrid>
          <PlainInput
            label="Kode Semester"
            value={form.code}
            onChange={(value) => setForm({ ...form, code: value })}
          />
          <PlainInput
            label="Tahun Akademik"
            value={form.ay}
            onChange={(value) => setForm({ ...form, ay: value })}
          />
        </FormGrid>
        <FormGrid>
          <PlainInput
            label="Semester"
            value={form.semester}
            onChange={(value) => setForm({ ...form, semester: value })}
          />
          <label className="mt-7 flex items-center gap-2 text-sm font-normal text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) =>
                setForm({ ...form, active: event.target.checked })
              }
            />{" "}
            Jadikan semester aktif
          </label>
        </FormGrid>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            disabled={!form.name || !form.code}
            onClick={() => onSave(form)}
          >
            Simpan Semester
          </Button>
        </div>
      </div>
    );
  }

  function Terms({
    terms,
    setTerms,
    setTermPlottings,
    setCourseClassPlans,
    onActiveTermChange,
    canEdit = true,
    readOnly = false,
  }) {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState("name");
    const [modal, setModal] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const rows = terms
      .filter((term) =>
        [
          term.name,
          term.code,
          term.ay,
          term.semester,
          term.active ? "active" : "inactive",
        ].some((value) => includes(value, query)),
      )
      .sort((a, b) => String(a[sort]).localeCompare(String(b[sort])));
    const save = (item) => {
      setTerms((prev) => {
        const next = prev.some((term) => term.code === item.code)
          ? prev.map((term) => (term.code === item.code ? item : term))
          : [item, ...prev];
        return item.active
          ? next.map((term) => ({ ...term, active: term.code === item.code }))
          : next;
      });
      if (item.active) onActiveTermChange(item.code);
      setModal(null);
    };
    const remove = (code) => {
      setTerms((prev) => prev.filter((term) => term.code !== code));
      setTermPlottings((prev) => prev.filter((row) => row.term_code !== code));
      setCourseClassPlans((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([termCode]) => termCode !== code),
        ),
      );
      setDeleteTarget(null);
    };
    return (
      <div className="space-y-5">
        {!readOnly && canEdit && (
          <div className="flex justify-end">
            <Button onClick={() => setModal({})}>
              <Icons.plus className="h-4 w-4" />
              Tambah Semester
            </Button>
          </div>
        )}
        {readOnly && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
            {Icons.eye && <Icons.eye className="h-4 w-4 text-slate-500 shrink-0" />}
            <span><strong>Mode Hanya Lihat:</strong> Anda sedang melihat data semester dalam mode pengamat. Penambahan, pengeditan, atau penghapusan data dibatasi untuk peran Administrator.</span>
          </div>
        )}
        <Card className="grid items-end gap-3 p-4 md:grid-cols-[1fr_220px]">
          <TextInput
            icon={Icons.search}
            value={query}
            onChange={setQuery}
            placeholder="Cari semester, kode, tahun akademik, atau status..."
          />
          <SelectBox
            label="Urutkan"
            value={sort}
            onChange={setSort}
            options={["name", "code", "ay", "semester"]}
          />
        </Card>
        <div className="space-y-3">
          {rows.map((term) => (
            <Card key={term.code} className="p-4 sm:p-5 transition-all hover:shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-2xs ${
                      term.active
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                        : "bg-slate-50 text-slate-400 border-slate-200"
                    }`}
                  >
                    <Icons.calendar className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-base text-[#102f52] leading-tight">
                        {term.name}
                      </p>
                      {term.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Semester Aktif
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                          Tidak Aktif
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 font-medium">
                      <span className="font-mono font-bold text-[#005baa] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/50 mr-1.5">
                        {term.code}
                      </span>
                      Tahun Akademik {term.ay} · {term.semester}
                    </p>
                  </div>
                </div>
                {!readOnly && canEdit && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setModal(term)}
                      title="Edit semester"
                      className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-[#005baa] hover:border-slate-300 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Icons.edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(term)}
                      title="Hapus semester"
                      className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors shadow-2xs cursor-pointer"
                    >
                      <Icons.trash className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
          {rows.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
              <Icons.calendar className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Tidak ada data semester yang cocok dengan pencarian Anda.
              </p>
            </div>
          )}
        </div>
        {modal && (
          <Modal
            title={modal.code ? "Edit Semester" : "Tambah Semester"}
            onClose={() => setModal(null)}
          >
            <TermForm
              initial={modal.code ? modal : null}
              onSave={save}
              onClose={() => setModal(null)}
            />
          </Modal>
        )}
        {deleteTarget && (
          <DeleteConfirmation
            itemType="semester"
            itemLabel={`${deleteTarget.name} (${deleteTarget.code})`}
            detail="Tindakan ini akan menghapus semester beserta seluruh data plotting dan rencana kelas terkait."
            onConfirm={() => remove(deleteTarget.code)}
            onClose={() => setDeleteTarget(null)}
          />
        )}
      </div>
    );
  }

  return { Courses, Terms };
}
