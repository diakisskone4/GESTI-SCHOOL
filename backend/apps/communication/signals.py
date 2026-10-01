"""Création automatique des notifications internes (cloche de la barre supérieure)."""
from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from apps.communication.models import Annonce, Message, Notification
from apps.students.models import Absence

User = get_user_model()


def _creer_notifications(destinataires, titre, contenu, type_notification):
    """Crée une notification interne (déjà « envoyée ») pour chaque destinataire, sans doublon."""
    maintenant = timezone.now()
    vus = set()
    notifications = []
    for user in destinataires:
        if user is None or user.pk in vus:
            continue
        vus.add(user.pk)
        notifications.append(Notification(
            destinataire=user, canal="interne", type_notification=type_notification,
            titre=titre[:200], contenu=contenu, statut="envoyee", envoyee_le=maintenant,
        ))
    Notification.objects.bulk_create(notifications)


@receiver(post_save, sender=Message)
def notifier_nouveau_message(sender, instance, created, **kwargs):
    if not created:
        return
    expediteur = instance.expediteur.get_full_name() or instance.expediteur.email
    _creer_notifications(
        [instance.destinataire],
        f"Nouveau message de {expediteur}",
        instance.objet or instance.contenu[:150],
        "message",
    )


def _destinataires_annonce(annonce):
    from apps.accounts.models import LienParentEleve

    users = User.objects.filter(is_active=True, etablissements=annonce.etablissement)
    if annonce.public_cible == "enseignants":
        return users.filter(role=User.Role.ENSEIGNANT)
    if annonce.public_cible == "eleves":
        return users.filter(role=User.Role.ELEVE)
    if annonce.public_cible == "parents":
        return users.filter(role=User.Role.PARENT)
    if annonce.public_cible == "classe" and annonce.classe_id:
        eleves = annonce.classe.inscriptions.filter(statut="active").values_list("eleve", flat=True)
        ids = set(User.objects.filter(profil_eleve__in=eleves).values_list("pk", flat=True))
        ids |= set(LienParentEleve.objects.filter(eleve__in=eleves).values_list("parent", flat=True))
        return User.objects.filter(pk__in=ids, is_active=True)
    return users


@receiver(post_save, sender=Annonce)
def notifier_nouvelle_annonce(sender, instance, created, **kwargs):
    if not created:
        return
    destinataires = _destinataires_annonce(instance)
    if instance.auteur_id:
        destinataires = destinataires.exclude(pk=instance.auteur_id)
    _creer_notifications(destinataires, f"Nouvelle annonce : {instance.titre}", instance.contenu[:300], "annonce")


@receiver(post_save, sender=Absence)
def notifier_absence(sender, instance, created, **kwargs):
    if not created:
        return
    eleve = instance.inscription.eleve
    nature = "un retard" if instance.type_evenement == "retard" else "une absence"
    contenu = f"{eleve.prenom} {eleve.nom} a {nature} enregistré(e) le {instance.date:%d/%m/%Y}."
    if instance.motif:
        contenu += f" Motif : {instance.motif}"
    destinataires = [lien.parent for lien in eleve.parents_lies.select_related("parent")]
    destinataires.append(eleve.user)
    _creer_notifications(destinataires, f"{instance.get_type_evenement_display()} de {eleve.prenom} {eleve.nom}", contenu, "absence")
