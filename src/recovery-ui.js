import { exportSave, replaceSave, recoverBackup } from "./persistence.js";
export function bindRecovery(state, status, signal) {
  const options = { signal };
  document.querySelector("#export-save").addEventListener(
    "click",
    () => {
      try {
        const text = exportSave(localStorage);
        if (!text) {
          status.textContent = "No stored save to export.";
          return;
        }
        const url = URL.createObjectURL(
          new Blob([text], { type: "application/json" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "squirtle-frontier-save.json";
        a.click();
        URL.revokeObjectURL(url);
        status.textContent =
          "Stored save exported, including original bytes if damaged.";
      } catch (e) {
        status.textContent = e.message;
      }
    },
    options,
  );
  document.querySelector("#import-save").addEventListener(
    "change",
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        if (file.size > 2_000_000)
          throw new Error("Save exceeds 2 MB import limit.");
        const text = await file.text();
        if (signal.aborted) return;
        if (
          !confirm(
            "Replace the stored world with this file? The existing bytes will be retained in local quarantine.",
          )
        )
          return;
        const r = replaceSave(state, localStorage, text);
        if (r.ok) location.reload();
        else status.textContent = r.message;
      } catch (error) {
        status.textContent = error.message;
      } finally {
        e.target.value = "";
      }
    },
    options,
  );
  document.querySelector("#recover-save").addEventListener(
    "click",
    () => {
      if (
        !confirm(
          "Restore the previous backup? Current bytes will be kept in local quarantine.",
        )
      )
        return;
      const r = recoverBackup(state, localStorage);
      if (r.ok) location.reload();
      else status.textContent = r.message;
    },
    options,
  );
}
