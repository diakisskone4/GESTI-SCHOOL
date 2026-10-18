"""Contrôle d'accès lié à l'abonnement de l'établissement.

Un établissement dont l'abonnement est expiré ou suspendu ne peut plus utiliser l'application :
toute requête de ses utilisateurs est refusée (code « abonnement_inactif »), connexion comprise.
L'équipe développeurs n'est jamais concernée.
"""
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework_simplejwt.authentication import JWTAuthentication

# Requêtes toujours permises : profil, changement d'établissement actif, déconnexion
CHEMINS_TOUJOURS_AUTORISES = ("/api/v1/auth/me/", "/api/v1/auth/logout/", "/api/v1/auth/refresh/")


class AbonnementInactif(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "abonnement_inactif"

    def __init__(self, message, etablissement=None):
        super().__init__({"detail": message, "code": "abonnement_inactif", "etablissement": etablissement})


def _message(etablissement, abonnement):
    if abonnement.statut == abonnement.STATUT_SUSPENDU:
        return f"L'accès de « {etablissement.nom} » à Gesti-Scolaire est suspendu. Contactez l'équipe Gesti-Scolaire."
    return (f"L'abonnement de « {etablissement.nom} » a expiré le {abonnement.date_fin:%d/%m/%Y}. "
            "Contactez l'équipe Gesti-Scolaire pour le renouveler.")


def verifier_acces(user):
    """Lève AbonnementInactif si l'établissement de l'utilisateur n'a plus accès."""
    from apps.plateforme.models import Abonnement
    from apps.core.tenancy import etablissements_famille_ids

    if not user or not user.is_authenticated or user.is_superuser or user.est_developpeur:
        return

    if user.est_eleve or user.est_parent:
        ids = etablissements_famille_ids(user) or list(user.etablissements.values_list("pk", flat=True))
        if not ids:
            return
        abonnements = list(Abonnement.objects.filter(etablissement_id__in=ids).select_related("etablissement"))
        # Établissements sans abonnement (anciennes données) : accès conservé
        if len(abonnements) < len(set(ids)) or any(a.donne_acces for a in abonnements):
            return
        a = abonnements[0]
        raise AbonnementInactif(_message(a.etablissement, a), a.etablissement.nom)

    etablissement_id = user.etablissement_courant_id
    if not etablissement_id:
        return
    abonnement = Abonnement.objects.filter(etablissement_id=etablissement_id).select_related("etablissement").first()
    if abonnement and not abonnement.donne_acces:
        raise AbonnementInactif(_message(abonnement.etablissement, abonnement), abonnement.etablissement.nom)


class JWTAuthentificationAbonnement(JWTAuthentication):
    """Authentification JWT + vérification de l'abonnement de l'établissement à chaque requête."""

    def authenticate(self, request):
        resultat = super().authenticate(request)
        if resultat is None:
            return None
        user, jeton = resultat
        # Liste des établissements en lecture : permet de basculer vers un autre établissement encore actif
        liste_etablissements = request.method == "GET" and request.path == "/api/v1/etablissements/"
        if not (request.path.startswith(CHEMINS_TOUJOURS_AUTORISES) or liste_etablissements):
            verifier_acces(user)
        return user, jeton
