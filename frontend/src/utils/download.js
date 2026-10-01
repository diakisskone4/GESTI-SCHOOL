import api from "../api/client";

/**
 * Télécharge (ou ouvre) un fichier protégé par JWT.
 * `path` est relatif à la base API (ex: "/bulletins/12/pdf/").
 */
export async function downloadAuthFile(path, filename, { open = true } = {}) {
  const response = await api.get(path, { responseType: "blob" });
  const blob = new Blob([response.data], { type: response.headers["content-type"] || "application/pdf" });
  const url = window.URL.createObjectURL(blob);

  if (open) {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "document.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  setTimeout(() => window.URL.revokeObjectURL(url), 30000);
}

/**
 * Récupère un fichier protégé par JWT et renvoie une URL blob locale, pour l'afficher
 * (ex: dans une balise <iframe>) sans déclencher de téléchargement ni ouvrir un nouvel onglet.
 * L'appelant est responsable de révoquer l'URL (window.URL.revokeObjectURL) une fois terminé.
 */
export async function fetchAuthBlobUrl(path) {
  const response = await api.get(path, { responseType: "blob" });
  const blob = new Blob([response.data], { type: response.headers["content-type"] || "application/pdf" });
  return window.URL.createObjectURL(blob);
}
