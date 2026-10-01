"""Envoi de notifications SMS/Email. Les backends réels (Orange SMS API, Twilio, SMTP...)
se branchent ici ; par défaut tout est loggé en console (SMS_BACKEND=console)."""
import logging
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def envoyer_sms(telephone, contenu):
    if settings.SMS_BACKEND == "console" or not telephone:
        logger.info("[SMS SIMULÉ] -> %s: %s", telephone, contenu)
        return True, ""
    # TODO: brancher un fournisseur SMS réel (Orange, Twilio...) ici.
    logger.warning("Fournisseur SMS non configuré, message non envoyé à %s", telephone)
    return False, "Fournisseur SMS non configuré"


def envoyer_email(destinataire_email, sujet, contenu):
    try:
        send_mail(sujet, contenu, settings.DEFAULT_FROM_EMAIL, [destinataire_email], fail_silently=False)
        return True, ""
    except Exception as exc:
        logger.exception("Échec envoi email à %s", destinataire_email)
        return False, str(exc)


def notifier_utilisateur(utilisateur, titre, contenu, type_notification="autre", canal="interne"):
    """Crée une Notification et tente de l'envoyer via le canal choisi."""
    from django.utils import timezone
    from apps.communication.models import Notification

    notif = Notification.objects.create(
        destinataire=utilisateur, canal=canal, type_notification=type_notification,
        titre=titre, contenu=contenu,
    )
    ok, erreur = True, ""
    if canal == "sms":
        ok, erreur = envoyer_sms(utilisateur.telephone, contenu)
    elif canal == "email":
        ok, erreur = envoyer_email(utilisateur.email, titre, contenu)

    notif.statut = "envoyee" if ok else "echec"
    notif.erreur = erreur
    notif.envoyee_le = timezone.now() if ok else None
    notif.save()
    return notif
