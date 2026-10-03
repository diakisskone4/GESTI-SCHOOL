"""Permissions DRF basées sur les rôles métier de Gesti-Scolaire."""
from rest_framework.permissions import SAFE_METHODS, BasePermission


def _role(request):
    user = request.user
    return getattr(user, "role", None) if user and user.is_authenticated else None


class IsAdmin(BasePermission):
    """Autorise uniquement les administrateurs (établissement ou super)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.est_admin)


class IsAdminOuSurveillant(BasePermission):
    """Administrateurs et surveillants généraux (vie scolaire : absences, discipline)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.est_admin or request.user.est_surveillant))


class IsEnseignant(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.est_enseignant or request.user.est_admin))


class IsAdminOuComptable(BasePermission):
    """Autorise les administrateurs et les comptables/caissiers (gestion de la facturation)."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.est_admin or request.user.est_comptable))


class IsEleveOuParent(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.est_eleve or request.user.est_parent))


class IsAdminOrReadOnly(BasePermission):
    """Lecture pour tout utilisateur authentifié, écriture réservée aux admins."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.est_admin


class IsAdminOrEnseignantReadWrite(BasePermission):
    """Admin : tout ; Enseignant : lecture + écriture sur ses propres classes/matières ;
    Autres rôles : lecture seule."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.est_admin or request.user.est_enseignant


class IsSelfOrAdmin(BasePermission):
    """Un utilisateur peut lire/modifier ses propres données ; l'admin peut tout."""
    def has_object_permission(self, request, view, obj):
        if request.user.est_admin:
            return True
        owner = getattr(obj, "user", None) or getattr(obj, "utilisateur", None) or obj
        return owner == request.user


class HasEtablissementAccess(BasePermission):
    """Vérifie que l'objet appartient à un établissement auquel l'utilisateur a accès."""
    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser or request.user.role == "superadmin":
            return True
        etab = getattr(obj, "etablissement", None)
        if etab is None:
            return True
        return request.user.etablissements.filter(pk=etab.pk).exists()
