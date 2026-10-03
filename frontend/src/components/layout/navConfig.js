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
