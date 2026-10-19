import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity, ArrowRight, CalendarClock, GraduationCap, History, MoonStar, School, TrendingUp, Users,
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import { plateformeApi } from "../../api/endpoints";
import {
  BarreActualisation, ErreurChargement, STATUTS, Squelette, StatutBadge, dateFr, dateHeureFr, depuis, nombreFr,
  useDonneesConsole,
} from "./commun";

const COULEUR_SERIE = "#7048f0"; // violet de la marque (série unique)
const ENCRE_AXE = "#94a3b8";
const GRILLE = "#eef0f6";

const moisCourt = (cle) => {
  const [annee, mois] = cle.split("-").map(Number);
  return new Date(annee, mois - 1, 1).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
};
const moisLong = (cle) => {
  const [annee, mois] = cle.split("-").map(Number);
  return new Date(annee, mois - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
};

function Carte({ titre, icone: Icone, action, children, className = "" }) {
  return (
    <section className={`card flex flex-col p-5 ${className}`}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {Icone && <Icone size={16} className="text-slate-400" />} {titre}
        </h2>
        {action}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function LienVoir({ to, children = "Voir tout" }) {
  return (
    <Link to={to} className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
      {children} <ArrowRight size={13} />
    </Link>
  );
}

function Indicateur({ icone: Icone, libelle, valeur, detail, ton = "text-brand-600 bg-brand-50", to }) {
  const contenu = (
    <>
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${ton}`}><Icone size={18} /></div>
      <p className="text-2xl font-bold tabular-nums text-slate-800">{valeur}</p>
      <p className="mt-0.5 text-sm text-slate-500">{libelle}</p>
      {detail && <p className="mt-1 text-xs text-slate-400">{detail}</p>}
    </>
  );
  return to
    ? <Link to={to} className="card card-hover block p-4">{contenu}</Link>
    : <div className="card p-4">{contenu}</div>;
}

function Vide({ children }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}

function InfoBulleCroissance({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs shadow-[var(--shadow-card)]">
      <p className="mb-1 font-semibold capitalize text-slate-700">{moisLong(point.mois)}</p>
      <p className="text-slate-600"><span className="font-semibold tabular-nums text-slate-800">{point.nouveaux}</span> nouvel(s) établissement(s)</p>
      <p className="text-slate-500">{point.total} au total en fin de mois</p>
    </div>
  );
}

/** Répartition des accès : une barre segmentée (écart de 2px) + légende avec icône, libellé et nombre. */
function RepartitionAcces({ stats }) {
  const segments = [
    { cle: "actif", nombre: stats.par_statut.actif - stats.a_renouveler },
    { cle: "a_renouveler", nombre: stats.a_renouveler },
    { cle: "expire", nombre: stats.par_statut.expire },
    { cle: "suspendu", nombre: stats.par_statut.suspendu },
    { cle: "sans_abonnement", nombre: stats.par_statut.sans_abonnement },
  ];
  const total = stats.total_etablissements;
  if (!total) return <Vide>Aucun établissement pour le moment.</Vide>;
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img"
        aria-label={segments.map((s) => `${STATUTS[s.cle].label} : ${s.nombre}`).join(", ")}>
        {segments.filter((s) => s.nombre > 0).map((s) => (
          <div key={s.cle} title={`${STATUTS[s.cle].label} : ${s.nombre}`}
            style={{ flexGrow: s.nombre, backgroundColor: STATUTS[s.cle].couleur }} />
        ))}
      </div>
      <ul className="mt-4 space-y-1">
        {segments.map((s) => {
          const { label, icon: Icon, couleur } = STATUTS[s.cle];
          return (
            <li key={s.cle}>
              <Link to={`/console/etablissements?statut=${s.cle}`}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <Icon size={15} style={{ color: couleur }} />
                <span className="flex-1 text-slate-600">{label}</span>
                <span className="font-semibold tabular-nums text-slate-800">{s.nombre}</span>
                <span className="w-10 text-right text-xs tabular-nums text-slate-400">{Math.round((s.nombre / total) * 100)} %</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Capacite({ stats }) {
  const taux = stats.limite ? Math.min(100, Math.round((stats.total_etablissements / stats.limite) * 100)) : 0;
  const couleur = taux >= 90 ? STATUTS.suspendu.couleur : taux >= 75 ? STATUTS.a_renouveler.couleur : COULEUR_SERIE;
  return (
    <Link to="/console/etablissements" className="card card-hover col-span-2 block p-4">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><School size={18} /></div>
      <p className="text-2xl font-bold tabular-nums text-slate-800">
        {stats.total_etablissements}<span className="text-base font-medium text-slate-400"> / {stats.limite}</span>
      </p>
      <p className="mt-0.5 text-sm text-slate-500">Établissements sur le déploiement</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${taux}%`, backgroundColor: couleur }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-400">{stats.places_restantes} place(s) disponible(s) · {taux} % utilisé</p>
    </Link>
  );
}

function SqueletteTableau() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Squelette className="col-span-2 h-36" />
        {[1, 2, 3, 4].map((i) => <Squelette key={i} className="h-36" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Squelette className="h-80 lg:col-span-2" />
        <Squelette className="h-80" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Squelette className="h-64" />
        <Squelette className="h-64" />
      </div>
    </div>
  );
}

export default function ConsoleDashboard() {
  const { data: stats, erreur, enCours, majLe, actualiser } = useDonneesConsole(() => plateformeApi.statistiques(), []);

  const entete = (
    <PageHeader
      title="Tableau de bord"
      subtitle="Les établissements qui utilisent Gesti-Scolaire, leurs accès et leur activité."
      actions={<BarreActualisation enCours={enCours} majLe={majLe} erreur={erreur} onActualiser={actualiser} />}
    />
  );

  if (!stats) {
    return <div className="space-y-6">{entete}{erreur ? <ErreurChargement onReessayer={actualiser} /> : <SqueletteTableau />}</div>;
  }

  const maxEleves = Math.max(1, ...stats.top_eleves.map((e) => e.nb_eleves));
  const coupes = stats.par_statut.expire + stats.par_statut.suspendu;

  return (
    <div className="space-y-6">
      {entete}

      {/* --- Indicateurs clés --- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Capacite stats={stats} />
        <Indicateur icone={STATUTS.actif.icon} ton="bg-emerald-50 text-emerald-700" libelle="Accès actifs"
          valeur={stats.par_statut.actif} detail={`dont ${stats.a_renouveler} à renouveler · ${stats.nouveaux_ce_mois} nouveau(x) ce mois`} to="/console/etablissements?statut=actif" />
        <Indicateur icone={CalendarClock} ton="bg-amber-50 text-amber-700" libelle="À renouveler (30 j)"
          valeur={stats.a_renouveler} to="/console/etablissements?statut=a_renouveler" />
        <Indicateur icone={STATUTS.suspendu.icon} ton="bg-rose-50 text-rose-700" libelle="Accès coupés"
          valeur={coupes} detail={`${stats.par_statut.expire} expiré(s) · ${stats.par_statut.suspendu} désactivé(s)`}
          to={stats.par_statut.expire ? "/console/etablissements?statut=expire" : "/console/etablissements?statut=suspendu"} />
        <Indicateur icone={GraduationCap} libelle="Élèves gérés" valeur={nombreFr(stats.total_eleves)}
          detail={`${nombreFr(stats.total_utilisateurs)} comptes utilisateurs`} />
      </div>

      {/* --- Croissance et état des accès --- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Carte titre="Nouveaux établissements par mois" icone={TrendingUp} className="lg:col-span-2"
          action={<span className="text-xs text-slate-400">12 derniers mois</span>}>
          <div className="h-64 lg:h-full lg:min-h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.evolution} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={GRILLE} />
                <XAxis dataKey="mois" tickFormatter={moisCourt} tick={{ fontSize: 12, fill: ENCRE_AXE }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: ENCRE_AXE }} axisLine={false} tickLine={false} />
                <Tooltip content={<InfoBulleCroissance />} cursor={{ fill: "rgba(112, 72, 240, 0.06)" }} />
                <Bar dataKey="nouveaux" fill={COULEUR_SERIE} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Carte>

        <Carte titre="État des accès" icone={Activity}>
          <RepartitionAcces stats={stats} />
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Durée des accès</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {stats.par_duree.map((d) => (
                <div key={d.duree_mois} className="rounded-lg bg-slate-50 py-2">
                  <p className="text-base font-bold tabular-nums text-slate-800">{d.nombre}</p>
                  <p className="text-[11px] text-slate-500">{d.duree_mois} mois</p>
                </div>
              ))}
            </div>
          </div>
        </Carte>
      </div>

      {/* --- Échéances et volumes --- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Échéancier des accès" icone={CalendarClock}
          action={<LienVoir to="/console/etablissements?statut=a_renouveler" />}>
          {stats.echeancier.length === 0 ? <Vide>Aucune échéance dans les 60 prochains jours.</Vide> : (
            <ul className="-mx-2 max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {stats.echeancier.map((e) => {
                const statut = e.statut === "expire" ? "expire" : e.jours_restants <= 30 ? "a_renouveler" : "actif";
                return (
                  <li key={e.id}>
                    <Link to={`/console/etablissements?ouvrir=${e.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700">{e.nom}</p>
                        <p className="text-xs text-slate-400">{e.statut === "expire" ? "Expiré le" : "Fin le"} {dateFr(e.date_fin)}</p>
                      </div>
                      <span className="text-right text-sm font-semibold tabular-nums text-slate-700">
                        {e.jours_restants < 0 ? `${-e.jours_restants} j de retard` : `J-${e.jours_restants}`}
                      </span>
                      <StatutBadge statut={statut} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Carte>

        <Carte titre="Établissements par nombre d'élèves" icone={GraduationCap}
          action={<LienVoir to="/console/etablissements?tri=-nb_eleves" />}>
          {stats.top_eleves.length === 0 ? <Vide>Aucun élève enregistré pour le moment.</Vide> : (
            <ul className="space-y-3">
              {stats.top_eleves.map((e) => (
                <li key={e.id}>
                  <Link to={`/console/etablissements?ouvrir=${e.id}`} className="group block">
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate text-slate-700 group-hover:text-brand-700">{e.nom}</span>
                      <span className="font-semibold tabular-nums text-slate-800">{nombreFr(e.nb_eleves)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${(e.nb_eleves / maxEleves) * 100}%`, backgroundColor: COULEUR_SERIE }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      {/* --- Usage et activité de l'équipe --- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Carte titre="Actifs mais sans connexion depuis 30 jours" icone={MoonStar}
          action={<span className="text-xs text-slate-400">{stats.utilisateurs_actifs_7j} connecté(s) cette semaine · {stats.utilisateurs_actifs_30j} ce mois</span>}>
          {stats.inactifs.length === 0 ? <Vide>Tous les établissements actifs utilisent l'application.</Vide> : (
            <ul className="-mx-2 max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {stats.inactifs.map((e) => (
                <li key={e.id}>
                  <Link to={`/console/etablissements?ouvrir=${e.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-700">{e.nom}</span>
                      <span className="block text-xs text-slate-400">{[e.sigle, e.ville].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">Dernière connexion : {depuis(e.derniere_activite)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte titre="Activité de l'équipe" icone={History}
          action={<span className="flex items-center gap-1 text-xs text-slate-400"><Users size={13} /> {stats.nb_developpeurs} membre(s)</span>}>
          {stats.activite_recente.length === 0 ? <Vide>Aucune action pour le moment.</Vide> : (
            <ol className="max-h-72 space-y-3 overflow-y-auto">
              {stats.activite_recente.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                  <div className="min-w-0">
                    <p className="text-slate-700">
                      <span className="font-semibold">{a.action_label}</span>
                      {a.etablissement_nom && <> · {a.etablissement_nom}</>}
                    </p>
                    {a.details && <p className="truncate text-xs text-slate-500">{a.details}</p>}
                    <p className="text-xs text-slate-400">{a.auteur_nom} · {dateHeureFr(a.horodatage)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Carte>
      </div>
    </div>
  );
}
