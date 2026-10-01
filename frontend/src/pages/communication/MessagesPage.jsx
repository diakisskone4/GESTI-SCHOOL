import { useState, useMemo } from "react";
import {
  Send, User, Search, CheckCircle2, Reply, Check,
  Clock, Shield, GraduationCap, Users, HeartHandshake, Loader2, X, Trash2
} from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import { useFetch } from "../../hooks/useFetch";
import { useAuth } from "../../context/AuthContext";
import { useToast, extractErrorMessage } from "../../context/ToastContext";
import { messagesApi } from "../../api/endpoints";

const ROLE_BADGES = {
  superadmin: { label: "Super Admin", color: "bg-red-50 text-red-700 ring-red-500/20", icon: Shield },
  admin: { label: "Administration", color: "bg-blue-50 text-blue-700 ring-blue-500/20", icon: Shield },
  enseignant: { label: "Enseignant", color: "bg-emerald-50 text-emerald-700 ring-emerald-500/20", icon: GraduationCap },
  eleve: { label: "Élève", color: "bg-purple-50 text-purple-700 ring-purple-500/20", icon: Users },
  parent: { label: "Parent", color: "bg-amber-50 text-amber-700 ring-amber-500/20", icon: HeartHandshake },
  comptable: { label: "Comptable", color: "bg-cyan-50 text-cyan-700 ring-cyan-500/20", icon: Shield },
  surveillant: { label: "Surveillant", color: "bg-indigo-50 text-indigo-700 ring-indigo-500/20", icon: Shield },
};

function RoleBadge({ role }) {
  const conf = ROLE_BADGES[role] || { label: role || "Membre", color: "bg-slate-100 text-slate-700 ring-slate-500/20", icon: User };
  const Icon = conf.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${conf.color}`}>
      <Icon size={11} />
      <span>{conf.label}</span>
    </span>
  );
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { notify } = useToast();

  const { data, loading, reload } = useFetch(() => messagesApi.list(), []);
  const { data: rawUsers, loading: loadingUsers } = useFetch(() => messagesApi.destinataires(), [user]);
  const users = rawUsers || [];

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [objet, setObjet] = useState("");
  const [contenu, setContenu] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Recherche et filtrage des destinataires dans le modal
  const [recipientSearch, setRecipientSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("tous");

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchRole = roleFilter === "tous" || u.role === roleFilter;
      const searchLower = recipientSearch.toLowerCase();
      const matchText = !recipientSearch ||
        (u.full_name && u.full_name.toLowerCase().includes(searchLower)) ||
        (u.email && u.email.toLowerCase().includes(searchLower)) ||
        (u.role_label && u.role_label.toLowerCase().includes(searchLower));
      return matchRole && matchText;
    });
  }, [users, recipientSearch, roleFilter]);

  const openNewMessage = (recipient = null, prefillSubject = "") => {
    setSelectedRecipient(recipient);
    setObjet(prefillSubject);
    setContenu("");
    setRecipientSearch("");
    setRoleFilter("tous");
    setModalOpen(true);
  };

  const handleReply = (msg) => {
    const isSentByMe = msg.expediteur === user?.id;
    const recipientId = isSentByMe ? msg.destinataire : msg.expediteur;
    const recipientName = isSentByMe ? msg.destinataire_nom : msg.expediteur_nom;
    const recipientEmail = isSentByMe ? msg.destinataire_email : msg.expediteur_email;
    const recipientRole = isSentByMe ? msg.destinataire_role : msg.expediteur_role;

    const recipientObj = users.find((u) => u.id === recipientId) || {
      id: recipientId,
      full_name: recipientName,
      email: recipientEmail,
      role: recipientRole,
    };

    const replySubject = msg.objet?.startsWith("Re:") ? msg.objet : `Re: ${msg.objet || "Sans objet"}`;
    openNewMessage(recipientObj, replySubject);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedRecipient?.id) {
      notify("Veuillez sélectionner un destinataire.", "error");
      return;
    }
    setSaving(true);
    try {
      await messagesApi.create({
        destinataire: selectedRecipient.id,
        objet: objet || "Sans objet",
        contenu,
      });
      notify(`Message envoyé avec succès à ${selectedRecipient.full_name || selectedRecipient.email}.`, "success");
      setModalOpen(false);
      setSelectedRecipient(null);
      setObjet("");
      setContenu("");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleMarquerLu = async (msgId) => {
    try {
      await messagesApi.marquerLu(msgId);
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    }
  };

  const handleDelete = async (msg) => {
    if (!window.confirm("Supprimer définitivement ce message ?")) return;
    setDeletingId(msg.id);
    try {
      await messagesApi.remove(msg.id);
      notify("Message supprimé.", "success");
      reload();
    } catch (err) {
      notify(extractErrorMessage(err), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const messages = data?.results || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messagerie Interne"
        subtitle="Échanges sécurisés entre la direction, les enseignants, les élèves et les parents."
        actions={
          <button onClick={() => openNewMessage()} className="btn-primary">
            <Send size={16} /> Nouveau message
          </button>
        }
      />

      {/* Liste des messages */}
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="animate-spin text-brand-600" size={28} />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="card p-12 text-center text-slate-400">
            <User className="mx-auto mb-2 text-slate-300" size={36} />
            <p className="font-semibold text-slate-700">Aucun message pour l'instant</p>
            <p className="mt-1 text-sm">Démarrez une conversation en cliquant sur "Nouveau message".</p>
            <button onClick={() => openNewMessage()} className="btn-primary mt-4">
              <Send size={16} /> Écrire un message
            </button>
          </div>
        )}

        {messages.map((m) => {
          const sentByMe = m.expediteur === user?.id;
          const otherName = sentByMe ? (m.destinataire_nom || m.destinataire_email || "Destinataire") : (m.expediteur_nom || m.expediteur_email || "Expéditeur");
          const otherRole = sentByMe ? m.destinataire_role : m.expediteur_role;
          const otherEmail = sentByMe ? m.destinataire_email : m.expediteur_email;

          return (
            <div
              key={m.id}
              className={`card p-5 transition-all hover:shadow-md ${
                !m.lu && !sentByMe ? "border-brand-300 bg-brand-50/20 ring-1 ring-brand-400/30" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${
                    sentByMe ? "bg-slate-100 text-slate-700" : "bg-brand-100 text-brand-700"
                  }`}>
                    {otherName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-400">
                        {sentByMe ? "Envoyé à :" : "Reçu de :"}
                      </span>
                      <strong className="text-sm text-slate-900">{otherName}</strong>
                      <RoleBadge role={otherRole} />
                    </div>
                    {otherEmail && (
                      <div className="text-xs text-slate-400">{otherEmail}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={13} />
                    {new Date(m.created_at).toLocaleString("fr-FR", {
                      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                    })}
                  </span>

                  {!sentByMe && !m.lu && (
                    <button
                      onClick={() => handleMarquerLu(m.id)}
                      className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-100"
                    >
                      <Check size={12} /> Marquer lu
                    </button>
                  )}

                  <button
                    onClick={() => handleReply(m)}
                    className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Reply size={12} /> Répondre
                  </button>

                  <button
                    onClick={() => handleDelete(m)}
                    disabled={deletingId === m.id}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="pt-3">
                {m.objet && (
                  <h4 className="text-sm font-bold text-slate-900">{m.objet}</h4>
                )}
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {m.contenu}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- MODAL NOUVEAU MESSAGE AVEC SÉLECTION DE VRAIES PERSONNES --- */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nouveau message interne"
        width="max-w-2xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button
              className="btn-primary"
              disabled={saving || !selectedRecipient}
              form="msg-form"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              <Send size={15} />
              Envoyer le message
            </button>
          </>
        }
      >
        <form id="msg-form" onSubmit={handleSend} className="space-y-4">
          {/* SÉLECTEUR DE DESTINATAIRE INTELLIGENT (SANS JAMAIS MONTRER DE RAW ID) */}
          <div>
            <label className="label">Destinataire</label>

            {selectedRecipient ? (
              <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/50 p-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-xs">
                    {selectedRecipient.full_name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{selectedRecipient.full_name}</span>
                      <RoleBadge role={selectedRecipient.role} />
                    </div>
                    <span className="text-xs text-slate-500">{selectedRecipient.email}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRecipient(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                  title="Changer de destinataire"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3 space-y-3">
                {/* Filtres par rôle */}
                <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
                  {[
                    { id: "tous", label: "Tous" },
                    { id: "admin", label: "Administration" },
                    { id: "enseignant", label: "Enseignants" },
                    { id: "eleve", label: "Élèves" },
                    { id: "parent", label: "Parents" },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRoleFilter(r.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        roleFilter === r.id
                          ? "bg-brand-600 text-white shadow-xs"
                          : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>

                {/* Champ de recherche */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder="Rechercher par nom, prénom ou email..."
                    className="input pl-9 text-xs"
                  />
                </div>

                {/* Liste des utilisateurs réels */}
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {loadingUsers && (
                    <p className="py-4 text-center text-xs text-slate-400">Chargement des destinataires...</p>
                  )}

                  {!loadingUsers && filteredUsers.length === 0 && (
                    <p className="py-4 text-center text-xs text-slate-400">Aucun destinataire correspondant.</p>
                  )}

                  {filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedRecipient(u)}
                      className="flex w-full items-center justify-between rounded-xl bg-white p-2.5 text-left border border-slate-100 shadow-2xs hover:border-brand-300 hover:bg-brand-50/40 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-700 text-xs">
                          {u.full_name?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-900">{u.full_name}</p>
                          <p className="truncate text-[11px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                      <RoleBadge role={u.role} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="label">Objet du message</label>
            <input
              required
              className="input"
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              placeholder="Ex: Demande de renseignement, Informations classe..."
            />
          </div>

          <div>
            <label className="label">Contenu du message</label>
            <textarea
              required
              rows={5}
              className="input"
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              placeholder="Rédigez votre message ici..."
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
