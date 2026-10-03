import {
  LayoutDashboard, School, Users, GraduationCap, BookOpenCheck,
  FileText, Wallet, Banknote, MessageSquare, BarChart3, CalendarClock,
  ClipboardList, IdCard, Megaphone, Calendar, Layers, Link2, UserCog,
} from "lucide-react";

/** Menu de navigation par rôle. Chaque item : { label, to, icon, roles? } */
export const NAV_SECTIONS = [
  {
    title: "Général",
    items: [
      { label: "Tableau de bord", to: "/", icon: LayoutDashboard },
      { label: "Établissements", to: "/etablissements", icon: School, roles: ["admin", "superadmin"] },
      { label: "Utilisateurs", to: "/utilisateurs", icon: UserCog, roles: ["admin", "superadmin"] },
      { label: "Années & Périodes", to: "/annees-scolaires", icon: Calendar, roles: ["admin", "superadmin"] },
      { label: "Classes & Niveaux", to: "/classes", icon: Layers, roles: ["admin", "superadmin"] },
      { label: "Emploi du temps", to: "/emploi-du-temps", icon: CalendarClock, roles: ["admin", "superadmin"] },
    ],
  },
  {
    title: "Scolarité",
    items: [
      { label: "Élèves", to: "/eleves", icon: Users, roles: ["admin", "superadmin"] },
      { label: "Liens parents-élèves", to: "/liens-parents-eleves", icon: Link2, roles: ["admin", "superadmin"] },
      { label: "Enseignants", to: "/enseignants", icon: GraduationCap, roles: ["admin", "superadmin"] },
      { label: "Notes & bulletins", to: "/academique/bulletins", icon: BookOpenCheck, roles: ["admin", "superadmin", "enseignant"] },
      { label: "Absences", to: "/absences", icon: ClipboardList, roles: ["admin", "superadmin", "enseignant", "surveillant"] },
      { label: "Cartes scolaires", to: "/cartes-scolaires", icon: IdCard, roles: ["admin", "superadmin"] },
      { label: "Documents", to: "/documents", icon: FileText, roles: ["admin", "superadmin"] },
    ],
  },
  {
    title: "Finances",
    items: [
      { label: "Facturation & frais", to: "/finance/factures", icon: Wallet, roles: ["admin", "superadmin", "comptable"] },
      { label: "Paie", to: "/paie", icon: Banknote, roles: ["admin", "superadmin", "comptable"] },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Messagerie", to: "/messages", icon: MessageSquare },
      { label: "Annonces", to: "/annonces", icon: Megaphone },
      { label: "Statistiques", to: "/statistiques", icon: BarChart3, roles: ["admin", "superadmin"] },
    ],
  },
];

/**
 * Onglets de la barre de navigation mobile (4 maximum, le 5e est toujours « Menu »).
 * Les chemins doivent exister dans NAV_SECTIONS ; l'icône et le libellé court viennent d'ici.
 */
export const MOBILE_TABS = {
  admin: [
    { label: "Accueil", to: "/", icon: LayoutDashboard },
    { label: "Élèves", to: "/eleves", icon: Users },
    { label: "Notes", to: "/academique/bulletins", icon: BookOpenCheck },
    { label: "Messages", to: "/messages", icon: MessageSquare, badge: "messages" },
  ],
  enseignant: [
    { label: "Accueil", to: "/", icon: LayoutDashboard },
    { label: "Notes", to: "/academique/bulletins", icon: BookOpenCheck },
    { label: "Absences", to: "/absences", icon: ClipboardList },
    { label: "Messages", to: "/messages", icon: MessageSquare, badge: "messages" },
  ],
  surveillant: [
    { label: "Accueil", to: "/", icon: LayoutDashboard },
    { label: "Absences", to: "/absences", icon: ClipboardList },
    { label: "Annonces", to: "/annonces", icon: Megaphone },
    { label: "Messages", to: "/messages", icon: MessageSquare, badge: "messages" },
  ],
  comptable: [
    { label: "Accueil", to: "/", icon: LayoutDashboard },
    { label: "Factures", to: "/finance/factures", icon: Wallet },
    { label: "Paie", to: "/paie", icon: Banknote },
    { label: "Messages", to: "/messages", icon: MessageSquare, badge: "messages" },
  ],
  eleve: [
    { label: "Accueil", to: "/", icon: LayoutDashboard },
    { label: "Annonces", to: "/annonces", icon: Megaphone },
    { label: "Messages", to: "/messages", icon: MessageSquare, badge: "messages" },
  ],
};
MOBILE_TABS.superadmin = MOBILE_TABS.admin;
MOBILE_TABS.parent = MOBILE_TABS.eleve;

const TITRES_EXTRA = [
  { pattern: /^\/eleves\/[^/]+$/, titre: "Dossier élève", retour: "/eleves" },
  { pattern: /^\/profil$/, titre: "Mon profil" },
];

/** Titre affiché dans la barre du haut sur mobile, et page « parente » pour le bouton retour. */
export function infosPage(pathname) {
  const extra = TITRES_EXTRA.find((t) => t.pattern.test(pathname));
  if (extra) return { titre: extra.titre, retour: extra.retour ?? null };
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((i) => i.to === pathname);
    if (item) return { titre: item.to === "/" ? "Gesti-Scolaire" : item.label, retour: null };
  }
  return { titre: "Gesti-Scolaire", retour: null };
}

/** Éléments du menu accessibles au rôle, par section. */
export function sectionsPourRole(role) {
  return NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || i.roles.includes(role)) }))
    .filter((s) => s.items.length);
}
