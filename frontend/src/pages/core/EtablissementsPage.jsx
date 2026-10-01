import CrudPage from "../../components/ui/CrudPage";
import { etablissementsApi } from "../../api/endpoints";

export default function EtablissementsPage() {
  return (
    <CrudPage
      title="Établissements"
      subtitle="Gestion multi-établissements"
      apiResource={etablissementsApi}
      fields={[
        { name: "nom", label: "Nom", required: true },
        { name: "sigle", label: "Sigle", required: true },
        {
          name: "type_etablissement", label: "Type", type: "select",
          options: [
            { value: "prescolaire", label: "Préscolaire" },
            { value: "primaire", label: "Primaire" },
            { value: "secondaire", label: "Secondaire" },
            { value: "mixte", label: "Mixte" },
          ],
        },
        { name: "ville", label: "Ville" },
        { name: "adresse", label: "Adresse" },
        { name: "telephone", label: "Téléphone" },
        { name: "email", label: "Email", type: "email" },
        { name: "devise", label: "Devise / slogan de l'établissement" },
        { name: "academie", label: "Académie d'enseignement (ex: Académie d'Enseignement de Bamako Rive Droite)" },
        { name: "cap", label: "Centre d'Animation Pédagogique - CAP (primaire/collège, optionnel)" },
        { name: "arrete_creation", label: "Arrêté de création (ex: N° 10-2235/MEALN-SG du 21/07/2010)" },
        { name: "arrete_ouverture", label: "Arrêté d'ouverture (ex: N° 2011-4993/MEALN-SG du 07/12/2011)" },
        { name: "directeur_nom", label: "Nom du directeur / proviseur" },
        {
          name: "directeur_titre", label: "Titre du directeur", type: "select",
          options: [
            { value: "Le Directeur", label: "Le Directeur" },
            { value: "Le Proviseur", label: "Le Proviseur" },
            { value: "La Directrice", label: "La Directrice" },
            { value: "La Proviseure", label: "La Proviseure" },
          ],
        },
        { name: "actif", label: "Établissement actif", type: "checkbox" },
      ]}
      columns={[
        { key: "nom", header: "Nom" },
        { key: "sigle", header: "Sigle" },
        { key: "ville", header: "Ville" },
        {
          key: "actif", header: "Statut",
          render: (r) => (
            <span className={`badge ${r.actif ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
              {r.actif ? "Actif" : "Inactif"}
            </span>
          ),
        },
      ]}
    />
  );
}
